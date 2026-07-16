<script setup lang="ts">
import clockImg from '@/assets/images/common/clock.png'
import {
  AI_MAX_RESPONSE_TIME_MS,
  ANSWER_CHAR_LIMIT,
  ANSWER_TIME_SECONDS,
  TOTAL_ROUNDS,
} from '@/config/game'
import {
  ANSWER_REVEAL_DURATION_MS,
  ROUND_SYNC_MAX_DELAY_MS,
  ROUND_SYNC_MIN_DELAY_MS,
  TIMER_TICK_MS,
} from '@/config/timing'
import { supabase } from '@/lib/supabaseClient'
import { toRound } from '@/mappers/roundMapper'
import { findRound, updateRoundSubmission } from '@/services/roundService'
import { fetchVectors } from '@/services/scoringService'
import { useGlobalStore } from '@/stores/global'
import { useMatchStore } from '@/stores/match'
import { useQuizStore } from '@/stores/quiz'
import { useRoundStore } from '@/stores/round'
import { useUserStore } from '@/stores/user'
import type { RoundRecord } from '@/types/database'
import { calculateFallbackScore, cosineSimilarity, formatTime } from '@/utils/helpers'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect, type Ref } from 'vue'
import { useRoute } from 'vue-router'

const globalStore = useGlobalStore()

// 只放行一次的通行票（避免彈窗後再次被攔）
// const allowOnce = ref(false)

// onBeforeRouteLeave((to: any, _from, next) => {
//   // 兩種情況放行：
//   // A) 這次導航是「我們自己允許的」一次性放行
//   // B) 目標路由帶了 state.allowLeave（程式內觸發、預先授權）
//   if (allowOnce.value || to?.state?.allowLeave) return next()

//   // 其他情況一律攔下：打開你的彈窗、取消導航（背景遊戲繼續）
//   globalStore.setIsBackToLoginModalOpen(true)
//   return next(false)
// })

// function keepPlaying() {
//   // Yes：繼續遊戲
//   globalStore.setIsBackToLoginModalOpen(false)
// }

// function abandonAndExit() {
//   // No：放棄並回首頁
//   globalStore.setIsBackToLoginModalOpen(false)
//   allowOnce.value = true
//   safeReplace({ path: '/', state: { allowLeave: true } })
// }

import PlayerInfo from '@/components/common/PlayerInfo.vue'
import { safePush, safeReplace, usePageGuard } from '@/utils/usePageGuard'
import DescribeSection from './components/DescribeSection.vue'
import QuestionSection from './components/QuestionSection.vue'

usePageGuard({
  onReloadAttempt: () => {
    globalStore.setIsBackToLoginModalOpen(true)
  },
})

const userStore = useUserStore()
const matchStore = useMatchStore()
const quizStore = useQuizStore()
const roundStore = useRoundStore()

const { userInfo, opponentInfo } = storeToRefs(userStore)
const { quizList } = storeToRefs(quizStore)
const { myRoundList, opponentRoundList, phantomRoundList } = storeToRefs(roundStore)

const route = useRoute()
const matchId = route.params.matchId

const currentRound = myRoundList.value.length
const currentQuiz = quizList.value[currentRound - 1]
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const currentQuizImage = supabaseUrl + currentQuiz?.imageUrl
const myCumulativeScore = computed(() =>
  myRoundList.value.reduce((acc, round) => acc + round.score + round.bonus, 0),
)
const opponentCumulativeScore = computed(() =>
  opponentRoundList.value.reduce((acc, round) => acc + round.score + round.bonus, 0),
)

const myCreatedAt = new Date(myRoundList.value[currentRound - 1]?.createdAt ?? 0).getTime()
const opponentCreatedAt = new Date(
  opponentRoundList.value[currentRound - 1]?.createdAt ?? 0,
).getTime()

//預設雙方進入 Round 的時間差不超過 3 秒
const createdDiff = Math.abs(opponentCreatedAt - myCreatedAt)
const delayTimeMs = Math.min(
  ROUND_SYNC_MAX_DELAY_MS,
  Math.max(ROUND_SYNC_MIN_DELAY_MS, createdDiff),
)

let roundChannel: RealtimeChannel | null = null
let timer: ReturnType<typeof setInterval> | null = null

function stopTimer() {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

const gameStartTime = ref<number | null>(null)
const myScoreWithoutThisRound = ref(0)
const opponentScoreWithoutThisRound = ref(0)
const remainingTime = ref(ANSWER_TIME_SECONDS)
const inputValue = ref('')
const isButtonDisabled = ref(false)
const roundFinished = ref(false)
const isWaitingForScore = ref(false)
const showAnswer = ref(false)
const opponentSubmitted = computed(() => !!opponentRoundList.value[currentRound - 1]?.submittedAt)

function animateScoreTransition(
  thisRoundScoreRef: Ref<number>, // 要被動畫改變的變數（ref）
  thisRoundScore: number, // 動畫起始值（通常是目前顯示的分數）
  cumulativeScore: number, // 動畫最終值（通常是最新總分）
): Promise<void> {
  return new Promise((resolve) => {
    const step = () => {
      const diff = cumulativeScore - thisRoundScoreRef.value

      if (Math.abs(diff) > 0) {
        thisRoundScoreRef.value += Math.sign(diff) * Math.max(1, Math.floor(Math.abs(diff) / 10))
        requestAnimationFrame(step)
      } else {
        thisRoundScoreRef.value = cumulativeScore
        resolve()
      }
    }

    thisRoundScoreRef.value = thisRoundScore
    requestAnimationFrame(step)
  })
}

function calcBonus(timeTakenMs: number) {
  const totalMs = ANSWER_TIME_SECONDS * TIMER_TICK_MS
  const remainingMs = Math.max(totalMs - timeTakenMs, 0)
  const remainingSec = remainingMs / TIMER_TICK_MS
  return Math.round(remainingSec * 0.5)
}

async function updateMyRound(newScore: number) {
  try {
    const roundId = myRoundList.value[currentRound - 1]?.roundId

    const now = Date.now()
    const timeTakenMs = gameStartTime.value ? now - gameStartTime.value : 0

    roundStore.updateMyCurrentRoundData({
      input: inputValue.value,
      score: newScore,
      bonus: calcBonus(timeTakenMs),
      timeTakenMs: timeTakenMs,
      submittedAt: new Date().toISOString(),
    })

    await updateRoundSubmission({
      matchId,
      roundId,
      round: currentRound,
      input: inputValue.value,
      score: newScore,
      bonus: calcBonus(timeTakenMs),
      timeTakenMs,
      submittedAt: new Date().toISOString(),
    })
  } catch (error) {
    alert('submit失敗，請稍後再試')

    safeReplace(`/`)

    console.error('[updateMyRound] 發生錯誤：', error)
    throw error
  }
}

//處理對方如果沒有 submit 或漏聽
async function getOpponentRoundData() {
  try {
    const opponentRoundData = await findRound(matchId, opponentInfo.value.opponentId, currentRound)

    if (!opponentRoundData) {
      console.warn('[getOpponentRoundData] 找不到對方 round，補一筆空資料到 pinia')

      const fallbackRound = {
        roundId: uuidv4(),
        round: currentRound,
        input: '',
        score: 0,
        bonus: 0,
        timeTakenMs: 0,
        submittedAt: null,
        createdAt: new Date().toISOString(),
      }

      roundStore.updateOpponentCurrentRoundData(fallbackRound)
      return
    }

    roundStore.updateOpponentCurrentRoundData(opponentRoundData)
  } catch (error) {
    console.error('[getOpponentRoundData] 發生錯誤：', error)
    throw error
  }
}

function getRandomTimeTakenMs(maxim = AI_MAX_RESPONSE_TIME_MS): number {
  return Math.floor(Math.random() * (maxim + 1))
}

const getVector = async (userAnswer: string) => {
  isWaitingForScore.value = true

  try {
    const data = await fetchVectors(quizStore.quizList[currentRound - 1].answer, userAnswer)
    if (data) {
      // 步驟 3: 成功取得向量後，使用 cosineSimilarity 函式計算分數
      if (data.vector1 && data.vector2) {
        console.log(cosineSimilarity(data.vector1, data.vector2), 'cosineSimilarity')
        return Math.round(cosineSimilarity(data.vector1, data.vector2))
      }
    }
  } catch (error) {
    console.error('[getVector] failed:', error)
  } finally {
    isWaitingForScore.value = false
  }

  return Math.round(calculateFallbackScore(quizStore.quizList[currentRound - 1].answer, userAnswer))
}

async function handleSubmit() {
  isButtonDisabled.value = true

  const now = Date.now()
  const timeTakenMs = gameStartTime.value ? now - gameStartTime.value : 0
  const newScore = await getVector(inputValue.value)
  roundStore.updateMyCurrentRoundData({
    input: inputValue.value,
    score: newScore,
    bonus: calcBonus(timeTakenMs),
    timeTakenMs: timeTakenMs,
    submittedAt: new Date().toISOString(),
  })

  await updateMyRound(newScore ?? 0)
}

onMounted(async () => {
  if (matchStore.matchData.opponentType === 'phantom') {
    const phantomData = phantomRoundList.value[currentRound - 1]
    const delay = phantomData?.timeTakenMs ?? AI_MAX_RESPONSE_TIME_MS

    setTimeout(() => {
      roundStore.updateOpponentCurrentRoundData({
        roundId: phantomData.roundId,
        round: phantomData.round,
        input: phantomData.input,
        score: phantomData.score,
        bonus: phantomData.bonus,
        timeTakenMs: phantomData.timeTakenMs,
        submittedAt: new Date().toISOString(),
        createdAt: phantomData.createdAt,
      })
    }, delay)
  }

  if (matchStore.matchData.opponentType === 'ai') {
    const aiTimeTakenMs = getRandomTimeTakenMs()
    const roundData = opponentRoundList.value[currentRound - 1]
    const submittedAt = new Date(Date.now() + aiTimeTakenMs).toISOString()

    const aiRound = {
      roundId: roundData.roundId,
      round: roundData.round,
      input: roundStore.aiResponseList[currentRound - 1],
      score: await getVector(roundStore.aiResponseList[currentRound - 1]),
      bonus: calcBonus(aiTimeTakenMs),
      timeTakenMs: aiTimeTakenMs,
      submittedAt,
      createdAt: roundData.createdAt,
    }

    setTimeout(() => {
      roundStore.updateOpponentCurrentRoundData(aiRound)
    }, aiTimeTakenMs)
  }
})

onMounted(() => {
  myScoreWithoutThisRound.value = myRoundList.value
    .slice(0, currentRound)
    .reduce((acc, round) => acc + round.score + round.bonus, 0)

  opponentScoreWithoutThisRound.value = opponentRoundList.value
    .slice(0, currentRound)
    .reduce((acc, round) => acc + round.score + round.bonus, 0)

  gameStartTime.value = Date.now()

  timer = setInterval(async () => {
    if (remainingTime.value > 0) {
      remainingTime.value--

      if (remainingTime.value !== 0) return

      stopTimer()

      if (!isStartAnswer.value) {
        isStartAnswer.value = true
      }
      if (!isButtonDisabled.value) {
        await handleSubmit()
      }

      return
    }

    stopTimer()
  }, TIMER_TICK_MS)
})

/**
 * 監聽對手在 rounds 資料表上的 UPDATE 事件。
 * 對手提交答案後，讓雙方都能即時得知對手已提交、答案內容、分數與時間獎勵。
 */
onMounted(() => {
  roundChannel = supabase
    .channel('opponent-round-listener')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rounds',
        filter: `user_id=eq.${opponentInfo.value.opponentId}`,
      },
      (payload) => {
        const opponentRoundData = payload.new

        roundStore.updateOpponentCurrentRoundData(toRound(opponentRoundData as RoundRecord))
      },
    )
    .subscribe()
})

// 離開作答頁時停止倒數並解除 rounds Realtime channel，避免背景持續接收對手更新。
onBeforeUnmount(() => {
  stopTimer()

  if (roundChannel) {
    supabase.removeChannel(roundChannel)
  }
})

watch(showAnswer, (isShown) => {
  if (isShown) {
    stopTimer()
  }
})

watchEffect(() => {
  const myRound = myRoundList.value[currentRound - 1]
  const opponentRound = opponentRoundList.value[currentRound - 1]

  const mySubmitted = !!myRound?.submittedAt
  const opponentSubmitted = !!opponentRound?.submittedAt
  const timeOver = remainingTime.value === 0

  const bothSubmitted = mySubmitted && opponentSubmitted
  // When time runs out, wait for auto-submit to finish before revealing the answers.
  const shouldEndRound = bothSubmitted || (timeOver && mySubmitted)

  if (!roundFinished.value && shouldEndRound) {
    roundFinished.value = true
    stopTimer()

    const shouldFetchOpponentRound = mySubmitted && !opponentSubmitted && timeOver

    setTimeout(async () => {
      if (shouldFetchOpponentRound) {
        await getOpponentRoundData()
      }

      showAnswer.value = true

      await Promise.all([
        animateScoreTransition(
          myScoreWithoutThisRound,
          myScoreWithoutThisRound.value,
          myCumulativeScore.value,
        ),
        animateScoreTransition(
          opponentScoreWithoutThisRound,
          opponentScoreWithoutThisRound.value,
          opponentCumulativeScore.value,
        ),
      ])

      // allowOnce.value = true

      setTimeout(() => {
        safePush(`/round-result/${matchId}`)
      }, ANSWER_REVEAL_DURATION_MS)
    }, delayTimeMs)
  }
})

const isStartAnswer = ref(false)
const isSubmitHidden = computed(() => remainingTime.value === 0 || isButtonDisabled.value)
const isStartHidden = computed(() => remainingTime.value === 0 || isStartAnswer.value)
const timeProgress = computed(() => {
  const percent = (remainingTime.value / ANSWER_TIME_SECONDS) * 100
  return Math.max(0, Math.floor(percent))
})
</script>

<template>
  <div class="game-view">
    <div class="header">
      <div class="clock">
        <img :src="clockImg" class="clock-img" />
      </div>

      <div class="time-bar">
        <p v-if="remainingTime !== 0" class="time-indicator quantico-bold-40">
          {{ formatTime(remainingTime, true) }}
        </p>
        <p v-if="remainingTime === 0" class="time-indicator quantico-bold-40">Time's up!</p>

        <div
          class="time-left-bar"
          v-show="remainingTime !== 0"
          :style="{
            width: timeProgress + '%',
          }"
        >
          <div class="time-left-inner" />
        </div>
      </div>

      <div class="score-section">
        <div class="score my-score">
          <PlayerInfo
            icon-size="36px"
            icon-color="var(--color-red-200)"
            :value="myScoreWithoutThisRound"
            value-color="var(--color-neutral-100)"
            value-typo="bungee-regular-32"
            width="100%"
            value-align="space-between"
            :wrap-text="false"
          />
        </div>

        <div class="score opponent-score">
          <PlayerInfo
            icon-size="36px"
            icon-color="var(--color-blue-1000)"
            :value="opponentScoreWithoutThisRound"
            value-color="var(--color-neutral-100)"
            value-typo="bungee-regular-32"
            width="100%"
            value-align="space-between"
            :wrap-text="false"
          />
        </div>
      </div>
    </div>

    <div class="main">
      <QuestionSection
        :current-quiz-image="currentQuizImage"
        :current-round="currentRound"
        :total-rounds="TOTAL_ROUNDS"
        :correct-answer="currentQuiz?.answer ?? ''"
        :show-answer="showAnswer"
      />

      <n-divider vertical class="divider" />

      <DescribeSection
        :my-name="userInfo.userName"
        :my-answer="myRoundList[myRoundList.length - 1]?.input ?? ''"
        :opponent-name="opponentInfo.opponentName"
        :opponent-answer="opponentRoundList[opponentRoundList.length - 1]?.input ?? ''"
        :opponent-submitted="opponentSubmitted"
        :count-chars="inputValue.length"
        :chars-limit="ANSWER_CHAR_LIMIT"
        :input-value="inputValue"
        :is-start-answer="isStartAnswer"
        :is-start-hidden="isStartHidden"
        :is-submit-hidden="isSubmitHidden"
        @update:inputValue="(value) => (inputValue = value)"
        @startAnswer="isStartAnswer = true"
        @submitAnswer="handleSubmit"
        :show-answer="showAnswer"
      />

      <div v-if="roundFinished && !showAnswer" class="time-up-container">
        <div class="time-up-wrap">
          <div class="time-up"><p class="bungee-regular-92">TIME'S UP!</p></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-view {
  width: 100vw;
  height: 100vh;
  min-height: 100vh;
  padding: 0 48px 36px;
  background-image:
    url('@/assets/images/common/lightningBackground.png'),
    linear-gradient(to bottom, var(--color-neutral-1100), var(--color-blue-800));
  background-size:
    auto 100%,
    cover;
  background-position: center, center;
  background-repeat: no-repeat, no-repeat;

  display: flex;
  flex-direction: column;
  gap: 17px;
  align-items: center;
}

.header {
  width: 100%;
  height: 80px;
  padding: 0 14px;
  background-color: var(--color-blue-900);
  box-shadow: var(--shadow-7);
  border-radius: 0 0 28px 28px;

  display: flex;
  gap: 18px;
  justify-content: space-between;
  align-items: center;
}

.clock {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background-color: var(--color-red-900);

  display: flex;
  justify-content: center;
  align-items: center;
}

.clock-img {
  width: 35px;
}

.time-bar {
  flex: 1 0 0;
  height: 56px;
  background-color: var(--color-neutral-50);
  border-radius: 12px;
  box-shadow: var(--shadow-8);

  position: relative;
}

.time-left-bar {
  position: absolute;
  z-index: 1;
  top: 0;
  right: 0;
  transition: width 0.3s linear;
  padding: 27px 7px 5px;

  height: 100%;
  border-radius: 12px;
  background-color: var(--color-yellow-300);
}

.time-left-inner {
  width: 100%;
  height: 100%;
  border-radius: 4px 4px 8px 8px;
  background-color: var(--color-yellow-500);
}

.time-indicator {
  position: absolute;
  z-index: 2;
  height: 100%;

  color: var(--color-neutral-1600);
  margin-left: 16px;

  display: flex;
  justify-content: center;
  align-items: center;
}

.score-section {
  width: fit-content;
  height: 54px;

  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center;
}

.score {
  width: 142px;
  height: 100%;
  padding: 8px 16px;
  border-radius: 16px;
}

.my-score {
  background-color: var(--color-neutral-900);
}

.opponent-score {
  background-color: var(--color-blue-600);
}

.main {
  width: 100%;
  max-width: 1440px;
  flex: 1 0 0;
  background-color: var(--color-neutral-1200);
  padding: 30px 24px;
  border: 2px solid var(--color-neutral-700);
  border-radius: 40px 20px;

  display: flex;

  position: relative;
}

.divider {
  align-self: flex-end;
  width: 2px;
  height: calc(100% - 72px);
  background-color: var(--color-neutral-1400);
  margin: 0 34px 0 43px;
}

.time-up-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-5deg) translateZ(0);
}

.time-up-wrap {
  display: inline-block;
  overflow: hidden;
  padding: 4px;
}

.time-up {
  color: var(--color-neutral-900);
  background-color: var(--color-neutral-50);
  border: 4px solid var(--color-blue-500);
  box-shadow: var(--shadow-5);
  padding: 18px 35px;
  white-space: nowrap;

  /* 消除 rotate 造成的鋸齒 */
  margin: -1px;
}
</style>
