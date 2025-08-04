<script setup lang="ts">
import { supabase } from '@/lib/supabaseClient'
import router from '@/router'
import { useMatchStore } from '@/stores/match'
import { useQuizStore } from '@/stores/quiz'
import { useRoundStore } from '@/stores/round'
import { useUserStore } from '@/stores/user'
import { sleep } from '@/utils/helpers'
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'

const userStore = useUserStore()
const quizStore = useQuizStore()
const roundStore = useRoundStore()
const matchStore = useMatchStore()

const route = useRoute()
const matchId = route.params.matchId

const { quizSetId } = matchStore.matchData
const { myRoundList, phantomRoundList } = storeToRefs(roundStore)
const { userInfo, opponentInfo } = storeToRefs(userStore)

const currentRound = roundStore.myRoundList.length

async function createNewRound() {
  try {
    const roundNumber = currentRound + 1
    const roundId = uuidv4()
    const createdAt = new Date().toISOString()

    const quizId = quizStore.quizList[currentRound]?.quizId

    const newRound = {
      round_id: roundId,
      match_id: matchId,
      user_id: userStore.userInfo.userId,
      quiz_set_id: quizSetId,
      quiz_id: quizId,
      round: roundNumber,
      input: '',
      score: 0,
      time_taken_ms: 0,
      submitted_at: null,
      created_at: createdAt,
    }

    const { error } = await supabase.from('rounds').insert([newRound])
    if (error) throw new Error(`[createNewRound] 新增 round 失敗：${error.message}`)

    roundStore.updateRoundList({
      roundId,
      round: roundNumber,
      input: '',
      score: 0,
      timeTakenMs: 0,
      submittedAt: null,
      createdAt,
    })
  } catch (error) {
    router.replace(`/`)
    console.error('[createNewRound] 發生錯誤:', error)
    throw error
  }
}

async function waitForBothRounds() {
  const start = Date.now()

  while (Date.now() - start < 30000) {
    const { data: myRound } = await supabase
      .from('rounds')
      .select('created_at')
      .eq('match_id', matchId)
      .eq('round', currentRound + 1)
      .eq('user_id', userInfo.value.userId)
      .maybeSingle()

    const { data: opponentRound } = await supabase
      .from('rounds')
      .select('*')
      .eq('match_id', matchId)
      .eq('round', currentRound + 1)
      .eq('user_id', opponentInfo.value.opponentId)
      .maybeSingle()

    if (myRound && opponentRound) {
      // 寫入 opponentRound
      roundStore.updateOpponentRoundList({
        roundId: opponentRound.round_id,
        round: opponentRound.round,
        input: opponentRound.input,
        score: opponentRound.score,
        timeTakenMs: opponentRound.time_taken_ms,
        submittedAt: opponentRound.submitted_at,
        createdAt: opponentRound.created_at,
      })

      return true
    }

    await sleep(500)
  }

  return false
}

async function waitForMyRounds() {
  const start = Date.now()

  while (Date.now() - start < 30000) {
    const { data: myRound } = await supabase
      .from('rounds')
      .select('created_at')
      .eq('match_id', matchId)
      .eq('round', currentRound + 1)
      .eq('user_id', userInfo.value.userId)
      .maybeSingle()

    if (myRound) {
      const currentPhantomData = phantomRoundList.value[currentRound]

      // 寫入 opponentRound
      roundStore.updateOpponentRoundList({
        roundId: currentPhantomData.roundId,
        round: currentPhantomData.round,
        input: currentPhantomData.input,
        score: 0,
        timeTakenMs: currentPhantomData.timeTakenMs,
        submittedAt: null,
        createdAt: currentPhantomData.createdAt,
      })

      return true
    }

    await sleep(500)
  }

  return false
}

async function waitForAiRounds() {
  const start = Date.now()

  while (Date.now() - start < 30000) {
    const { data: myRound } = await supabase
      .from('rounds')
      .select('created_at')
      .eq('match_id', matchId)
      .eq('round', currentRound + 1)
      .eq('user_id', userInfo.value.userId)
      .maybeSingle()

    //fetch AI to answer

    if (myRound) {
      // 寫入 opponentRound
      roundStore.updateOpponentRoundList({
        roundId: uuidv4(),
        round: currentRound,
        input: '',
        score: 0,
        timeTakenMs: 0,
        submittedAt: null,
        createdAt: new Date().toISOString(),
      })

      return true
    }

    await sleep(500)
  }

  return false
}

onMounted(async () => {
  if (!userInfo.value.userId) {
    router.replace(`/`)
    return
  }

  try {
    await createNewRound()

    let bothReady = false

    switch (matchStore.matchData.opponentType) {
      case 'human':
        bothReady = await waitForBothRounds()
        break
      case 'phantom':
        bothReady = await waitForMyRounds()
        break
      case 'ai':
        bothReady = await waitForAiRounds()
        break
    }

    if (bothReady) {
      router.push(`/game/${matchId}`)
    }
  } catch (err) {
    console.error('[round-start] 初始化錯誤', err)
    alert('初始化回合，請稍後再試')
    router.replace(`/`)
  }
})
</script>

<template>
  <div class="round-view">
    <h1>Round {{ myRoundList.length }}</h1>
  </div>
</template>

<style>
.round-view {
  min-height: 100vh;
  min-width: 100vw;
  border: 1px solid #ccc;
}
.users-box {
  display: flex;
  gap: 24px;
}
.user-box {
  border: 1px solid red;
}
</style>
