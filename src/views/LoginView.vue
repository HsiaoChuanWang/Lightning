<script setup lang="ts">
import { supabase } from '@/lib/supabaseClient'
import router from '@/router'
import { useQuizStore } from '@/stores/quiz'
import { useUserStore } from '@/stores/user'
import { v4 as uuidv4 } from 'uuid'
import { ref } from 'vue'

const userName = ref('')
const selectedFile = ref<File | null>(null)

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
  }
}

async function uploadFileToSupabase(
  bucketName: string,
  folderPath: string,
  file: File,
): Promise<string> {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${uuidv4()}.${fileExt}`
    const filePath = `${folderPath}/${fileName}`

    const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, file)
    if (uploadError) throw new Error('上傳失敗: ' + uploadError.message)

    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath)
    if (!data?.publicUrl) throw new Error('無法取得圖片網址')

    return data.publicUrl
  } catch (error) {
    console.error('[上傳圖片失敗]', error)
    throw error
  }
}

async function initUser(
  userName: string,
  selectedFile: File,
): Promise<{
  userId: string
  avatarUrl: string
  userName: string
}> {
  try {
    const cachedUserStr = localStorage.getItem(`user_info_${userName}`)
    if (cachedUserStr) {
      const cachedUserInfo = JSON.parse(cachedUserStr)
      if (cachedUserInfo.userName === userName) {
        return cachedUserInfo
      }
    }

    const avatarUrl = await uploadFileToSupabase('storage', 'avatars', selectedFile)
    const userId = uuidv4()

    const { error } = await supabase
      .from('users')
      .insert([{ user_id: userId, user_name: userName, avatar_url: avatarUrl }])
    if (error) throw new Error('[初始化使用者] 寫入資料失敗：' + error.message)

    const userInfo = { userId, avatarUrl, userName }
    localStorage.setItem(`user_info_${userName}`, JSON.stringify(userInfo))
    return userInfo
  } catch (error) {
    console.error('[初始化使用者失敗]', error)
    throw error
  }
}

async function enterMatchingPool(userId: string) {
  try {
    const { error } = await supabase.from('matching_pool').insert([{ user_id: userId }])
    if (error) throw new Error('[enterMatchingPool] 寫入失敗: ' + error.message)
  } catch (error) {
    console.error('加入玩家池失敗:', error)
    throw error
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function tryFindHumanOpponent(myId: string, timeout = 10000) {
  const start = Date.now()
  try {
    while (Date.now() - start < timeout) {
      const { data: candidates, error } = await supabase
        .from('matching_pool')
        .select('*')
        .neq('user_id', myId)
        .order('joined_at', { ascending: true })
        .limit(1)

      if (error) throw new Error('[tryFindHumanOpponent] 寫入失敗: ' + error.message)

      if (candidates && candidates.length > 0) {
        const { data: userInfo, error: userError } = await supabase
          .from('users')
          .select('user_id, user_name, avatar_url')
          .eq('user_id', candidates[0].user_id)

        if (userError) throw new Error('[查詢userInfo失敗] ' + userError.message)

        const userStore = useUserStore()
        userStore.setOpponent({
          opponentId: userInfo[0].user_id,
          opponentName: userInfo[0].user_name,
          opponentAvatarUrl: userInfo[0].avatar_url,
        })

        return candidates[0]
      }
      await sleep(1000)
    }
    return null
  } catch (error) {
    console.error('[找真人對手失敗]', error)
    throw error
  }
}

async function tryFindPhantomOpponent(myId: string, timeout = 10000) {
  const start = Date.now()

  try {
    while (Date.now() - start < timeout) {
      const { data: myMatches, error: matchError } = await supabase
        .from('matches')
        .select('match_id')
        .or(`player_one_id.eq.${myId},player_two_id.eq.${myId}`)

      if (matchError) throw new Error('[找過的幻影對手查詢失敗] ' + matchError.message)

      const playedMatchIds = myMatches?.map((matched) => matched.match_id) ?? []

      let query = supabase
        .from('matches')
        .select('player_one_id, quiz_set_id, match_id')
        .eq('status', 'completed')
        .neq('player_one_id', myId)

      if (playedMatchIds.length > 0) {
        query = query.not('match_id', 'in', playedMatchIds)
      }

      const { data: candidates, error: candidateError } = await query.limit(1)

      if (candidates && candidates.length > 0) {
        const { data: userInfo, error: userError } = await supabase
          .from('users')
          .select('user_id, user_name, avatar_url')
          .eq('user_id', candidates[0].player_one_id)

        if (userError) throw new Error('[查詢userInfo失敗] ' + userError.message)

        const userStore = useUserStore()
        userStore.setOpponent({
          opponentId: userInfo[0].user_id,
          opponentName: userInfo[0].user_name,
          opponentAvatarUrl: userInfo[0].avatar_url,
        })

        return candidates[0]
      }

      await sleep(1000)
    }

    return null
  } catch (error) {
    console.error('[幻影配對失敗]', error)
    throw error
  }
}

async function tryAIOpponent(myId: string, timeout = 10000) {
  const start = Date.now()
  console.log('[AI配對] 未找到真人或幻影對手，開始建立 AI 對戰...')
  try {
    const aiOpponentId = uuidv4()

    const userStore = useUserStore()
    userStore.setOpponent({
      opponentId: aiOpponentId,
      opponentName: '泡泡醬',
      opponentAvatarUrl: 'https://media.tenor.com/6depeYBIOBMAAAAe/you-better-not-be-careful.png',
    })

    // 模擬處理延遲
    await sleep(Math.min(1500, timeout))

    // 從 quizzes 表中撈出所有 quiz_set_id（distinct）
    const { data, error } = await supabase.from('quizzes').select('quiz_set_id')

    if (error) throw new Error('[AI配對] 讀取 quiz_set_id 失敗：' + error.message)
    if (!data || data.length === 0) throw new Error('[AI配對] 無可用的 quiz_set_id')

    // 從中隨機挑一組
    const randomIndex = Math.floor(Math.random() * data.length)
    const quizSetId = data[randomIndex].quiz_set_id

    return {
      opponent_id: aiOpponentId,
      quiz_set_id: quizSetId,
    }
  } catch (error) {
    console.error('[AI配對失敗]', error)
    throw error
  }
}

async function createMatch(
  playerOneId: string,
  playerTwoId: string,
  opponentType: string,
  quizSetId: number,
) {
  const matchId = uuidv4()

  try {
    const { error: insertError } = await supabase.from('matches').insert([
      {
        match_id: matchId,
        player_one_id: playerOneId,
        player_two_id: playerTwoId,
        opponent_type: opponentType,
        quiz_set_id: quizSetId,
        is_player_one_complete: false,
        is_player_two_complete: false,
        status: 'in_progress',
        created_at: new Date().toISOString(),
      },
    ])

    if (insertError) {
      throw new Error(`[建立對戰] 寫入 matches 失敗：${insertError.message}`)
    }

    const { error: deleteError } = await supabase
      .from('matching_pool')
      .delete()
      .eq('user_id', playerOneId)

    if (deleteError) {
      throw new Error(`[建立對戰] 刪除 matching_pool 失敗：${deleteError.message}`)
    }

    const { data: quizList, error: quizError } = await supabase
      .from('quizzes')
      .select('*')
      .eq('quiz_set_id', quizSetId)
      .order('order', { ascending: true })

    if (quizError) {
      throw new Error(`[建立對戰] 載入題目失敗：${quizError.message}`)
    }

    const quizStore = useQuizStore()
    quizStore.setQuizSet(quizSetId, quizList)
  } catch (err) {
    console.error('[建立對戰失敗]', err)
    throw err
  }
}

async function handleStart(event: Event) {
  if (!userName.value) {
    alert('請輸入 User Name')
    return
  }
  if (!selectedFile.value) {
    alert('請選擇上傳的圖片')
    return
  }

  try {
    const userStore = useUserStore()

    const userInfo = await initUser(userName.value, selectedFile.value)
    userStore.setUser(userInfo)

    // 加入配對池
    await enterMatchingPool(userInfo.userId)

    // 嘗試真人配對
    const humanOpponent = await tryFindHumanOpponent(userInfo.userId)
    if (humanOpponent) {
      await createMatch(userInfo.userId, humanOpponent.user_id, 'human', 1)
      await supabase
        .from('matching_pool')
        .delete()
        .in('user_id', [userInfo.userId, humanOpponent.user_id])
      router.push('/game')
      return
    }

    // 嘗試幻影配對
    const phantomOpponent = await tryFindPhantomOpponent(userInfo.userId)
    if (phantomOpponent) {
      await createMatch(
        userInfo.userId,
        phantomOpponent.player_one_id,
        'phantom',
        phantomOpponent.quiz_set_id,
      )
      await supabase.from('matching_pool').delete().eq('user_id', userInfo.userId)
      router.push('/game')
      return
    }

    // 嘗試 AI 對手
    const aiOpponent = await tryAIOpponent(userInfo.userId)
    await createMatch(userInfo.userId, aiOpponent.opponent_id, 'ai', aiOpponent.quiz_set_id)

    router.push('/game')
  } catch (e) {
    console.error('配對流程失敗:', e)
    alert('配對失敗')
  }
}

const userStore = useUserStore()

console.log('Current User:', userStore.userName)
console.log('Current opponent:', userStore.opponentName)
</script>

<template>
  <div class="login-view">
    <h1>Login</h1>

    <div>
      <label for="username">User Name: </label>
      <input id="username" v-model="userName" type="text" />
    </div>

    <div>
      <label for="file">Upload Image: </label>
      <input id="file" type="file" accept="image/*" @change="handleFileChange" />
    </div>

    <button @click="handleStart">Start !</button>

    <!-- <LoadingModal /> -->
  </div>
</template>

<style>
@media (min-width: 1024px) {
  .login-view {
    min-height: 100vh;
    display: flex;
    align-items: self-start;
    flex-direction: column;
    justify-content: center;
    gap: 20px;
  }
}
</style>
