<script setup lang="ts">
import { supabase } from '@/lib/supabaseClient'
import { useMatchStore } from '@/stores/match'
import { useQuizStore } from '@/stores/quiz'
import { useRoundStore, type Round } from '@/stores/round'
import { useUserStore } from '@/stores/user'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

const userStore = useUserStore()
const matchStore = useMatchStore()
const quizStore = useQuizStore()
const roundStore = useRoundStore()

const { userInfo, opponentInfo } = storeToRefs(userStore)
const { quizList } = storeToRefs(quizStore)
const { myRoundList, opponentRoundList } = storeToRefs(roundStore)

const currentRound = myRoundList.value.length
const currentQuiz = quizList.value[currentRound - 1]
const currentMyScore = computed(() =>
  myRoundList.value.reduce((acc, round) => acc + round.score, 0),
)
const currentOpponentScore = computed(() =>
  opponentRoundList.value.reduce((acc, round) => acc + round.score, 0),
)

let roundChannel: RealtimeChannel | null = null

const startTime = ref<number | null>(null)
const displayedMyScore = ref(0)
const displayedOpponentScore = ref(0)
const remainingTime = ref(30)
const inputValue = ref('')
const isButtonDisabled = ref(false)

function animateScore(displayedScore: Ref<number>, target: number) {
  const step = () => {
    if (displayedScore.value < target) {
      displayedScore.value += Math.ceil((target - displayedScore.value) / 10)
      requestAnimationFrame(step)
    } else {
      displayedScore.value = target
    }
  }
  requestAnimationFrame(step)
}

async function updateMyRound() {
  try {
    const roundId = myRoundList.value[currentRound].roundId
    const now = Date.now()
    const timeTakenMs = startTime.value ? now - startTime.value : 0
    const newScore = calculateScore()

    roundStore.updateMyCurrentRoundData({
      input: inputValue.value,
      score: newScore,
      timeTakenMs: timeTakenMs,
      submittedAt: new Date().toISOString(),
    })

    const { error: updateRoundsTableError } = await supabase
      .from('rounds')
      .update({
        input: inputValue,
        score: newScore,
        time_taken_ms: timeTakenMs,
        submitted_at: new Date().toISOString(),
      })
      .eq('match_id', matchStore.matchData.matchId)
      .eq('round_id', roundId)
      .eq('round', currentRound)

    if (updateRoundsTableError) {
      throw new Error('[updateMyRound] 更新資料庫失敗：' + updateRoundsTableError.message)
    }
  } catch (error) {
    console.error('[updateMyRound] 發生錯誤：', error)
    throw error
  }
}

function getOpponentCurrentRoundData() {
  const opponentScore = Math.floor(Math.random() * 100)
}

function calculateScore() {
  return Math.floor(Math.random() * 100)
}

function calculateTotalScore(rounds: Round[]) {
  return rounds.reduce((acc, round) => acc + round.score, 0)
}

function handleInputChange(e: Event) {
  inputValue.value = (e.target as HTMLTextAreaElement).value
}

async function handleSubmit() {
  isButtonDisabled.value = true

  const now = Date.now()
  const timeTakenMs = startTime.value ? now - startTime.value : 0
  const newScore = calculateScore()
  roundStore.updateMyCurrentRoundData({
    input: inputValue.value,
    score: newScore,
    timeTakenMs: timeTakenMs,
    submittedAt: new Date().toISOString(),
  })

  await updateMyRound()
}

function startScoreAnimation() {
  animateScore(displayedMyScore, currentMyScore.value)
  animateScore(displayedOpponentScore, currentOpponentScore.value)
}

onMounted(() => {
  displayedMyScore.value = calculateTotalScore(myRoundList.value)
  displayedOpponentScore.value = calculateTotalScore(opponentRoundList.value)

  startTime.value = Date.now()

  const timer = setInterval(() => {
    if (remainingTime.value > 0) {
      remainingTime.value--
    } else {
      clearInterval(timer)
    }
  }, 1000)
})

onMounted(() => {
  roundChannel = supabase
    .channel('opponent-round-listener')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rounds',
        filter: `match_id=eq.${matchStore.matchData.matchId},user_id=eq.${opponentInfo.value.opponentId},round=eq.${currentRound}`,
      },
      (payload) => {
        const opponentRoundData = payload.new

        roundStore.updateOpponentRoundList({
          roundId: opponentRoundData.round_id,
          round: opponentRoundData.round,
          input: opponentRoundData.input,
          score: opponentRoundData.score,
          timeTakenMs: opponentRoundData.time_taken_ms,
          submittedAt: opponentRoundData.submitted_at,
          createdAt: opponentRoundData.created_at,
        })
      },
    )
    .subscribe()
})

onBeforeUnmount(() => {
  if (roundChannel) {
    supabase.removeChannel(roundChannel)
  }
})

// 重整頁面，需要重新登入
// onMounted(() => {
//   const userStore = useUserStore()
//   if (!userStore.userInfo.userId) {
//     router.replace('/')
//   }
// })
</script>

<template>
  <div class="game-view">
    <div class="flex-wrapper">
      <h1>Game {{ currentRound }}</h1>
      <h1>倒數計時 {{ remainingTime }}</h1>
    </div>

    <img :src="currentQuiz?.imageUrl" class="img-box" />

    <div class="flex-wrapper">
      <div>
        <div>
          <p>My Name: {{ userInfo.userName }}</p>
          <p>My 目前累積的Score: {{ displayedMyScore }}</p>
        </div>

        <div>
          <label for="inputValue">My Input: </label>
          <textarea id="inputValue" v-model="inputValue" @input="handleInputChange"></textarea>
        </div>
        <button @click="$router.push('/home')">Submit !</button>
      </div>

      <div>
        <p class="opponent-text">Opponent Name: {{ opponentInfo.opponentName }}</p>
        <p class="opponent-text">Opponent 目前累積的Score: {{ displayedOpponentScore }}</p>
      </div>
    </div>
  </div>
</template>

<style>
.game-view {
  min-height: 100vh;
  min-width: 100vw;
  border: 1px solid #ccc;
}
.flex-wrapper {
  display: flex;
  gap: 16px;
}
.users-box {
  border: 1px solid #ccc;
}
.img-box {
  width: 300px;
  height: auto;
}
.opponent-text {
  color: red;
  font-weight: bold;
}
</style>
