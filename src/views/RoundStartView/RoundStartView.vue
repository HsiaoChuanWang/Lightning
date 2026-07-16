<script setup lang="ts">
import StarIcon from '@/assets/icons/StarIcon.vue'
import QuestionDisplay from '@/components/common/QuestionDisplay.vue'
import { TOTAL_ROUNDS } from '@/config/game'
import {
  QUESTION_PREVIEW_DURATION_MS,
  ROUND_READY_POLL_INTERVAL_MS,
  ROUND_READY_TIMEOUT_MS,
  ROUND_TITLE_DURATION_MS,
} from '@/config/timing'
import { abandonMatch } from '@/services/matchService'
import { createRound as insertRound, findRound } from '@/services/roundService'
import { useGlobalStore } from '@/stores/global'
import { useMatchStore } from '@/stores/match'
import { useQuizStore } from '@/stores/quiz'
import { useRoundStore } from '@/stores/round'
import { useUserStore } from '@/stores/user'
import { sleep } from '@/utils/helpers'
import { safePush, safeReplace, usePageGuard } from '@/utils/usePageGuard'
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const globalStore = useGlobalStore()

usePageGuard({
  onReloadAttempt: () => {
    globalStore.setIsBackToLoginModalOpen(true)
  },
})

const userStore = useUserStore()
const quizStore = useQuizStore()
const roundStore = useRoundStore()
const matchStore = useMatchStore()

const route = useRoute()
const matchId = route.params.matchId
const { quizList } = storeToRefs(quizStore)

const { quizSetId } = matchStore.matchData
const { myRoundList, phantomRoundList } = storeToRefs(roundStore)
const { userInfo, opponentInfo } = storeToRefs(userStore)

const currentRound = roundStore.myRoundList.length
const nextRound = currentRound + 1

const nextRoundQuiz = quizList.value[currentRound]
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const currentQuizImage = supabaseUrl + nextRoundQuiz?.imageUrl

const currentStage = ref<'round' | 'question'>('round')

async function createNewRound() {
  try {
    const quizId = quizStore.quizList[currentRound]?.quizId
    const newRound = await insertRound({
      matchId,
      userId: userStore.userInfo.userId,
      quizSetId,
      quizId,
      round: nextRound,
    })

    roundStore.updateRoundList(newRound)
  } catch (error) {
    safeReplace(`/`)
    console.error('[createNewRound] 發生錯誤:', error)
    throw error
  }
}

async function waitForBothRounds() {
  const start = Date.now()

  while (Date.now() - start < ROUND_READY_TIMEOUT_MS) {
    const myRound = await findRound(matchId, userInfo.value.userId, nextRound)
    const opponentRound = await findRound(matchId, opponentInfo.value.opponentId, nextRound)

    if (myRound && opponentRound) {
      // 寫入 opponentRound
      roundStore.updateOpponentRoundList(opponentRound)

      return true
    }

    await sleep(ROUND_READY_POLL_INTERVAL_MS)
  }

  return false
}

async function waitForMyRounds() {
  const start = Date.now()

  while (Date.now() - start < ROUND_READY_TIMEOUT_MS) {
    const myRound = await findRound(matchId, userInfo.value.userId, nextRound)

    if (myRound) {
      const currentPhantomData = phantomRoundList.value[currentRound]

      // 寫入 opponentRound
      roundStore.updateOpponentRoundList({
        roundId: currentPhantomData.roundId,
        round: currentPhantomData.round,
        input: currentPhantomData.input,
        score: 0,
        bonus: 0,
        timeTakenMs: currentPhantomData.timeTakenMs,
        submittedAt: null,
        createdAt: currentPhantomData.createdAt,
      })

      return true
    }

    await sleep(ROUND_READY_POLL_INTERVAL_MS)
  }

  return false
}

async function waitForAiRounds() {
  const start = Date.now()

  while (Date.now() - start < ROUND_READY_TIMEOUT_MS) {
    const myRound = await findRound(matchId, userInfo.value.userId, nextRound)

    //fetch AI to answer

    if (myRound) {
      // 寫入 opponentRound
      roundStore.updateOpponentRoundList({
        roundId: uuidv4(),
        round: nextRound,
        input: '',
        score: 0,
        bonus: 0,
        timeTakenMs: 0,
        submittedAt: null,
        createdAt: new Date().toISOString(),
      })

      return true
    }

    await sleep(ROUND_READY_POLL_INTERVAL_MS)
  }

  return false
}

onMounted(async () => {
  if (!userInfo.value.userId) {
    safeReplace(`/`)
    return
  }

  try {
    await createNewRound()

    await sleep(ROUND_TITLE_DURATION_MS)

    currentStage.value = 'question'

    await sleep(QUESTION_PREVIEW_DURATION_MS)

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
      safePush({ path: `/game/${matchId}`, state: { allowLeave: true } })
    } else {
      const isPlayerOne = matchStore.matchData.playerOneId === userStore.userInfo.userId

      await abandonMatch(String(matchId), isPlayerOne)

      safeReplace(`/`)
    }
  } catch (err) {
    console.error('[round-start] 初始化錯誤', err)
    safeReplace(`/`)
  }
})

const repeatCount = 4
const space = ' '.repeat(5)
const text = `QUESTION ${myRoundList.value.length + 1}${space}`.repeat(repeatCount)
const chars = text.split('')
const step = 360 / chars.length
const radius = 'min(50vh, 50vw)'
</script>

<template>
  <div class="round-start-view">
    <div class="circle-text bungee-regular-36">
      <span
        v-for="(char, index) in chars"
        :key="index"
        class="char"
        :style="{
          transform: `rotate(${index * step}deg) translate(${radius}) rotate(90deg)`,
        }"
      >
        {{ char }}
      </span>
    </div>

    <div class="round-card" v-if="currentStage === 'round'">
      <p class="bungee-regular-92">Round {{ nextRound }}</p>
    </div>

    <div class="question-card" v-if="currentStage === 'question'">
      <div class="question-head">
        <StarIcon color="var(--color-mustard-600)" size="48" />
        <p class="bungee-regular-36">QUESTION</p>
      </div>

      <QuestionDisplay
        :current-quiz-image="currentQuizImage"
        :current-round="nextRound"
        :total-rounds="TOTAL_ROUNDS"
      />
    </div>
  </div>
</template>

<style scoped>
.round-start-view {
  min-height: 100vh;
  background-image:
    url('@/assets/images/common/lightningBackground.png'),
    linear-gradient(to bottom, var(--color-teal-500), var(--color-teal-400));
  background-size:
    auto 100%,
    cover;
  background-position: left, center;
  background-repeat: repeat, no-repeat;

  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  position: relative;
}

.circle-text {
  position: absolute;

  color: var(--color-neutral-50);
}

.char {
  position: absolute;

  transform-origin: 0 0;
}

.round-card {
  width: 466px;
  height: 138px;
  background-color: var(--color-neutral-50);
  border: 4px solid var(--color-blue-500);
  transform: rotate(-5deg);
  box-shadow: var(--shadow-5);

  display: flex;
  justify-content: center;
  align-items: center;
}

.question-card {
  width: 420px;
  padding: 35px 40px;
  background-color: var(--color-neutral-50);
  border-radius: 32px 20px;
  box-shadow: var(--shadow-6);

  display: flex;
  flex-direction: column;
  gap: 30px;
}

.question-head {
  display: flex;
  align-items: center;
  gap: 16px;
}

.question-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 15px;
}

.img-container {
  width: 340px;
  height: 340px;
  padding: 10px;
  border: 2px solid var(--color-blue-500);
  border-radius: 8px;
}

.img-container img {
  width: 100%;
  border-radius: 8px;
}

.dot-container {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.dot-container {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.dot {
  width: 16px;
  height: 16px;
  border-radius: 16px;
  background-color: var(--color-neutral-1000);
}

.dot.active {
  background-color: var(--color-red-400);
  border: 1px solid var(--color-neutral-900);
}
</style>
