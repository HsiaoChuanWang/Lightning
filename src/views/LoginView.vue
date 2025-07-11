<script setup lang="ts">
import { supabase } from '@/lib/supabaseClient'
import router from '@/router'
import { useMatchStore } from '@/stores/match'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { onUnmounted, ref } from 'vue'

const userName = ref('')

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
        const { player_one_id, player_two_id } = payload.new

        if (player_one_id === userId || player_two_id === userId) {
          console.log('收到配對:', payload.new)

          // // 被動方也應從配對池移除（避免遺留）
          // supabase.from('matching_pool').delete().eq('user_id', userId)

          router.push(`/round`)
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
        lose_count: 0,
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
  const { data: existingMatch, error: matchCheckError } = await supabase
    .from('matches')
    .select('match_id')
    .or(`player_one_id.eq.${userId},player_two_id.eq.${userId}`)
    .eq('opponent_type', 'human')
    .eq('status', 'in_progress')
    .limit(1)

  if (matchCheckError) {
    throw new Error('[checkExistingMatch] 檢查配對狀態失敗：' + matchCheckError.message)
  }

  return !!(existingMatch && existingMatch.length > 0)
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function tryFindHumanOpponent(myId: string, timeout = 10000) {
  const start = Date.now()
  try {
    while (Date.now() - start < timeout) {
      const { data: candidateList, error: findHumanOpponentError } = await supabase
        .from('matching_pool')
        .select('*')
        .neq('user_id', myId)
        .order('joined_at', { ascending: true })
        .limit(1)

      if (findHumanOpponentError)
        throw new Error('[tryFindHumanOpponent] 寫入失敗: ' + findHumanOpponentError.message)

      if (candidateList && candidateList.length > 0) {
        return candidateList[0]
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

    // const { data: quizList, error: quizError } = await supabase
    //   .from('quizzes')
    //   .select('*')
    //   .eq('quiz_set_id', quizSetId)
    //   .order('order', { ascending: true })

    // if (quizError) {
    //   throw new Error(`[建立對戰] 載入題目失敗：${quizError.message}`)
    // }

    // const quizStore = useQuizStore()
    // quizStore.setQuizSet(quizSetId, quizList)
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

  try {
    const userInfo = await initUser(userName.value)

    if (await checkExistingMatch(userInfo.userId)) {
      console.log('[handleStart] 你有遊戲進行中')
      return
    }

    await subscribeToMatch(userInfo.userId)

    // 加入配對池
    await enterMatchingPool(userInfo.userId)

    // 嘗試真人配對
    const humanOpponent = await tryFindHumanOpponent(userInfo.userId)
    if (humanOpponent) {
      await createMatch(userInfo.userId, humanOpponent.user_id, 'human', getRandomQuizSetId())

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
      return
    }

    // 嘗試 AI 對手
    const aiOpponent = await tryAIOpponent()
    await createMatch(userInfo.userId, aiOpponent, 'ai', getRandomQuizSetId())
  } catch (e) {
    console.error('配對流程失敗:', e)
    alert('配對失敗')
  }
}
</script>

<template>
  <div class="login-view">
    <h1>Login</h1>

    <div>
      <label for="username">User Name: </label>
      <input id="username" v-model="userName" type="text" />
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
