<script setup lang="ts">
import LoadingModal from '@/components/common/LoadingModal.vue'
import PlayAgainModal from '@/components/common/PlayAgainModal.vue'
import { supabase } from '@/lib/supabaseClient'
import router from '@/router'
import { useGlobalStore } from '@/stores/global'
import { useMatchStore } from '@/stores/match'
import { useQuizStore } from '@/stores/quiz'
import { useRevengeStore } from '@/stores/revenge'
import { useRoundStore } from '@/stores/round'
import { useUserStore } from '@/stores/user'
import { cosineSimilarity, sleep } from '@/utils/helpers'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { onBeforeUnmount, onUnmounted, ref } from 'vue'

const prompt = ref('請分別描述圖片的內容，不需要特別分點')
const imageUrl = ref('https://i.imgur.com/9suDcj2.jpeg')
const imageUrlList = ref<string[]>([
  'https://i.imgur.com/9suDcj2.jpeg',
  'https://i.imgur.com/00PdolV.jpeg',
])
const answer = ref('')
const loading = ref(false)

const handleAskGemini = async () => {
  if (loading.value) return
  loading.value = true
  answer.value = '連線中，請稍候...'

  try {
    const res = await fetch('/api/describe-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt.value,
        imageList: imageUrlList.value,
      }),
    })

    const data = await res.json()
    if (res.ok) {
      answer.value = data.text
    } else {
      answer.value = `錯誤：${data.error}`
      console.error(data.details)
    }
  } catch (error) {
    console.error('Fetch Error:', error)
    answer.value = '連線失敗，請檢查網路或後端配置。'
  } finally {
    loading.value = false
  }
}

// 新增的狀態變數，用於取得向量
const textForVector1 = ref('a girl in window with red skirt')
const textForVector2 = ref(
  'a girl in window with red skirts out of it sss, a boy is really love her ',
)
const vectorsResult = ref<string | null>(null) // 用於顯示向量結果
const similarityScore = ref<number | null>(null) // 用於顯示餘弦相似度分數

/**
 * 新增的函式：處理獲取向量的請求
 * 並且在獲取後計算相似度
 */
const handleGetVectors = async () => {
  loading.value = true
  vectorsResult.value = '連線中，請稍候...'
  similarityScore.value = null

  try {
    const res = await fetch('/api/vectors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text1: textForVector1.value,
        text2: textForVector2.value,
      }),
    })

    const data = await res.json()
    if (res.ok) {
      // 成功時將結果格式化為 JSON 字串顯示
      vectorsResult.value = JSON.stringify(data, null, 2)

      // 步驟 3: 成功取得向量後，使用 cosineSimilarity 函式計算分數
      if (data.vector1 && data.vector2) {
        similarityScore.value = cosineSimilarity(data.vector1, data.vector2)
      } else {
        vectorsResult.value += '\n錯誤：後端未回傳有效的向量。'
      }
    } else {
      vectorsResult.value = `錯誤：${data.error}`
      console.error(data.details)
    }
  } catch (error) {
    console.error('Fetch Error:', error)
    vectorsResult.value = '連線失敗，請檢查網路或後端配置。'
  } finally {
    loading.value = false
  }
}

const globalStore = useGlobalStore()
const roundStore = useRoundStore()
const matchStore = useMatchStore()

const { isPlayAgainModalOpen } = storeToRefs(globalStore)
const { isMatchCanceled } = storeToRefs(matchStore)

const userName = ref('')
const isMatched = ref(false)

let matchSubscription: RealtimeChannel | null = null

async function subscribeToMatch(userId: string) {
  if (matchSubscription) {
    supabase.removeChannel(matchSubscription)
    matchSubscription = null
  }

  matchSubscription = supabase
    .channel(`match-channel-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'matches',
      },
      (payload) => {
        isMatched.value = true
        const { player_one_id, player_two_id } = payload.new

        if (player_one_id === userId || player_two_id === userId) {
          console.log('收到配對:', payload.new)

          const matchStore = useMatchStore()
          matchStore.setMatchData({
            matchId: payload.new.match_id,
            playerOneId: player_one_id,
            playerTwoId: player_two_id,
            opponentType: payload.new.opponent_type,
            quizSetId: payload.new.quiz_set_id,
            isComplete: false,
            status: 'in_progress',
          })

          router.push(`/start-challenge/${payload.new.match_id}`)
        }
      },
    )
    .subscribe()
}

onUnmounted(() => {
  if (matchSubscription) supabase.removeChannel(matchSubscription)
})

function getRandomQuizSetId(totalSets = 1): number {
  // return Math.floor(Math.random() * totalSets) + 1
  return totalSets
}

async function initUser(userName: string): Promise<{
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

    const userId = uuidv4()

    const { error: insertUserError } = await supabase.from('users').insert([
      {
        user_id: userId,
        user_name: userName,
        avatar_url: '',
        win_count: 0,
        loss_count: 0,
        total_matches: 0,
      },
    ])
    if (insertUserError) throw new Error('[初始化使用者] 寫入資料失敗：' + insertUserError.message)

    const userInfo = { userId, avatarUrl: '', userName }
    localStorage.setItem(`user_info_${userName}`, JSON.stringify(userInfo))

    return userInfo
  } catch (error) {
    console.error('[初始化使用者失敗]', error)
    throw error
  }
}

async function checkExistingMatch(userId: string): Promise<boolean> {
  const { data: existingMatch } = await supabase
    .from('matches')
    .select('*')
    .or(`player_one_id.eq.${userId},player_two_id.eq.${userId}`)
    .eq('status', 'in_progress')
    .maybeSingle()

  if (existingMatch) {
    matchStore.setMatchData({
      matchId: existingMatch.match_id,
      playerOneId: existingMatch.player_one_id,
      playerTwoId: existingMatch.player_two_id,
      opponentType: existingMatch.opponent_type,
      quizSetId: existingMatch.quiz_set_id,
      isComplete: false,
      status: 'in_progress',
    })

    router.push(`/start-challenge/${existingMatch.match_id}`)

    return true
  }

  return false
}

async function enterMatchingPool(userId: string) {
  try {
    const { error: enterMatchingPoolError } = await supabase
      .from('matching_pool')
      .insert([{ user_id: userId }])

    if (enterMatchingPoolError)
      throw new Error('[enterMatchingPool] 寫入失敗: ' + enterMatchingPoolError.message)
  } catch (error) {
    console.error('加入玩家池失敗:', error)
    throw error
  }
}

async function tryFindHumanOpponent(myId: string, timeout = 10000) {
  const start = Date.now()

  while (Date.now() - start < timeout) {
    if (isMatchCanceled.value) return

    console.log('humman')

    const { data: matchedData, error } = await supabase.rpc('match_users', {
      my_id: myId,
      quiz_set_id: getRandomQuizSetId(),
    })

    if (error) {
      throw new Error(`[match_users] RPC 錯誤：${error.message}`)
    }

    if (matchedData && matchedData.length > 0) {
      const match = matchedData[0]
      const matchStore = useMatchStore()

      matchStore.setMatchData({
        matchId: match.match_id,
        playerOneId: match.player_one_id,
        playerTwoId: match.player_two_id,
        opponentType: 'human',
        quizSetId: match.returned_quiz_set_id,
        isComplete: false,
        status: 'in_progress',
      })

      router.push(`/start-challenge/${match.match_id}`)
      return true
    }

    await sleep(1000)
  }

  return false
}

async function tryFindPhantomOpponent(myId: string, timeout = 10000) {
  const start = Date.now()

  try {
    while (Date.now() - start < timeout) {
      if (isMatchCanceled.value) return

      console.log('phantom')

      const { data: myMatches, error: matchError } = await supabase
        .from('matches')
        .select('match_id')
        .or(`player_one_id.eq.${myId},player_two_id.eq.${myId}`)

      if (matchError) throw new Error('[尋找曾經玩過的對手 id 失敗] ' + matchError.message)

      const playedMatchIds = Array.isArray(myMatches)
        ? myMatches.map((matched) => matched.match_id).filter(Boolean)
        : []

      let query = supabase
        .from('matches')
        .select('player_one_id, quiz_set_id, match_id')
        .eq('is_player_one_complete', true)
        .neq('player_one_id', myId)

      if (playedMatchIds.length === 1) {
        query = query.neq('match_id', playedMatchIds[0])
      } else if (playedMatchIds.length > 1) {
        query = query.not('match_id', 'in', `(${playedMatchIds.join(',')})`)
      }

      const { data: selectedCandidate, error: candidateError } = await query.limit(1)
      if (candidateError) throw new Error('[選一位幻影選手失敗] ' + candidateError.message)

      if (selectedCandidate && selectedCandidate.length > 0) {
        let { data } = await supabase
          .from('rounds')
          .select(`*`)
          .eq('match_id', selectedCandidate[0].match_id)
          .eq('user_id', selectedCandidate[0].player_one_id)
          .order('round', { ascending: true })

        const dataList = data?.map((item) => {
          return {
            roundId: item.round_id,
            round: item.round,
            input: item.input,
            score: item.score,
            timeTakenMs: item.time_taken_ms,
            submittedAt: item.submitted_at,
            createdAt: item.created_at,
          }
        })

        roundStore.setPhantomRoundList(dataList ? dataList : [])

        return selectedCandidate[0]
      }

      await sleep(1000)
    }

    return null
  } catch (error) {
    console.error('[幻影配對失敗]', error)
    throw error
  }
}

async function tryAIOpponent(timeout = 10000) {
  console.log('[AI配對] 未找到真人或幻影對手，開始建立 AI 對戰...')
  try {
    if (isMatchCanceled.value) return

    console.log('ai')

    const aiOpponentId = uuidv4()

    // 模擬處理延遲
    await sleep(Math.min(1500, timeout))

    return aiOpponentId
  } catch (error) {
    console.error('[AI配對失敗]', error)
    throw error
  }
}

async function createMatch(
  myId: string,
  playerTwoId: string,
  opponentType: OpponentType,
  quizSetId: number,
) {
  const matchId = uuidv4()

  try {
    const matchStore = useMatchStore()
    matchStore.setMatchData({
      matchId: matchId,
      playerOneId: myId,
      playerTwoId: playerTwoId,
      opponentType: opponentType,
      quizSetId: quizSetId,
      isComplete: false,
      status: 'in_progress',
    })

    // 被匹配的真人，也要立即移出
    const { data: existing, error: isUserAlreadyMatched } = await supabase
      .from('matches')
      .select('match_id')
      .or(`player_one_id.eq.${myId},player_two_id.eq.${myId}`)
      .eq('opponent_type', 'human')
      .eq('status', 'in_progress')
      .limit(1)

    if (isUserAlreadyMatched) throw isUserAlreadyMatched

    if (existing.length > 0) {
      console.warn('[createMatch] 自己已經有一場對戰進行中，跳過建立')
      await supabase.from('matching_pool').delete().eq('user_id', myId)
      return
    }

    const { error: insertMatchesError } = await supabase.from('matches').insert([
      {
        match_id: matchId,
        player_one_id: myId,
        player_two_id: playerTwoId,
        opponent_type: opponentType,
        quiz_set_id: quizSetId,
        is_player_one_complete: false,
        is_player_two_complete: false,
        status: 'in_progress',
        created_at: new Date().toISOString(),
      },
    ])

    if (insertMatchesError) {
      throw new Error(`[建立對戰] 寫入 matches 失敗：${insertMatchesError.message}`)
    }

    const { error: deleteError } = await supabase
      .from('matching_pool')
      .delete()
      .in('user_id', [myId, playerTwoId])

    if (deleteError) {
      throw new Error(`[建立對戰] 刪除 matching_pool 失敗：${deleteError.message}`)
    }
  } catch (err) {
    console.error('[建立對戰失敗]', err)
    throw err
  }
}

async function handleStart() {
  if (!userName.value) {
    alert('請輸入 User Name')
    return
  }

  const userStore = useUserStore()
  userStore.clearUser()
  userStore.clearOpponent()

  const matchStore = useMatchStore()
  matchStore.clearMatchData()
  matchStore.setIsMatchCanceled(false)

  const quizStore = useQuizStore()
  quizStore.clearQuizList()

  const roundStore = useRoundStore()
  roundStore.restRoundList()
  roundStore.restOpponentRoundList()

  const revengeStore = useRevengeStore()
  revengeStore.clearRevengeInfo()

  if (matchSubscription) {
    supabase.removeChannel(matchSubscription)
    matchSubscription = null
  }

  try {
    const userInfo = await initUser(userName.value)

    const userStore = useUserStore()
    userStore.setMyCurrentId(userInfo.userId)
    globalStore.setIsLoadingModalOpen(true)

    const isExistingMatch = await checkExistingMatch(userInfo.userId)

    if (isExistingMatch) return

    await subscribeToMatch(userInfo.userId)

    // 加入配對池
    await enterMatchingPool(userInfo.userId)

    // 嘗試真人配對
    const humanOpponent = await tryFindHumanOpponent(userInfo.userId)
    if (humanOpponent) return

    if (isMatched.value) return

    // 嘗試幻影配對
    const phantomOpponent = await tryFindPhantomOpponent(userInfo.userId)
    if (phantomOpponent) {
      await createMatch(
        userInfo.userId,
        phantomOpponent.player_one_id,
        'phantom',
        phantomOpponent.quiz_set_id,
      )
      return
    }

    // 嘗試 AI 對手
    const aiOpponent = await tryAIOpponent()

    if (aiOpponent) {
      await createMatch(userInfo.userId, aiOpponent, 'ai', getRandomQuizSetId())
    }
  } catch (e) {
    console.error('配對流程失敗:', e)
    alert('配對失敗')
  }
}

onBeforeUnmount(async () => {
  globalStore.setIsLoadingModalOpen(false)
})
</script>

<template>
  <div class="login-view">
    <h1>Login</h1>

    <div>
      <label for="username">User Name: </label>
      <input id="username" v-model="userName" type="text" />
    </div>

    <button @click="handleStart">Start !</button>

    <LoadingModal />

    <button @click="handleAskGemini">test</button>
    <h3>Gemini 回應：</h3>
    <p v-if="answer">{{ answer }}</p>
    <p v-else>點擊按鈕來測試連線...</p>

    <button @click="handleGetVectors">test02</button>

    <h3 v-if="vectorsResult">向量結果：</h3>

    <h3 v-if="similarityScore !== null">相似度分數：</h3>
    <p v-if="similarityScore !== null">{{ similarityScore }}</p>
  </div>
  <PlayAgainModal v-if="isPlayAgainModalOpen" />
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
