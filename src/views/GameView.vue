<script setup lang="ts">
import { supabase } from '@/lib/supabaseClient'
import router from '@/router'
import { useMatchStore } from '@/stores/match'
import { useQuizStore } from '@/stores/quiz'
import { useRoundStore } from '@/stores/round'
import { useUserStore } from '@/stores/user'
import { cosineSimilarity } from '@/utils/helpers'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, onBeforeUnmount, onMounted, ref, watchEffect, type Ref } from 'vue'
import { useRoute } from 'vue-router'

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
  myRoundList.value.reduce((acc, round) => acc + round.score, 0),
)
const opponentCumulativeScore = computed(() =>
  opponentRoundList.value.reduce((acc, round) => acc + round.score, 0),
)

const myCreatedAt = new Date(myRoundList.value[currentRound - 1]?.createdAt ?? 0).getTime()
const opponentCreatedAt = new Date(
  opponentRoundList.value[currentRound - 1]?.createdAt ?? 0,
).getTime()

//預設雙方進入 Round 的時間差不超過 3 秒
const createdDiff = Math.abs(opponentCreatedAt - myCreatedAt)
const delayTimeMs = Math.min(3000, Math.max(1000, createdDiff))

let roundChannel: RealtimeChannel | null = null

const gameStartTime = ref<number | null>(null)
const myScoreWithoutThisRound = ref(0)
const opponentScoreWithoutThisRound = ref(0)
const remainingTime = ref(10)
const inputValue = ref('')
const isButtonDisabled = ref(false)
const roundFinished = ref(false)
const isWaitingForScore = ref(false)

const myScoreThisRound = computed(() => myCumulativeScore.value - myScoreWithoutThisRound.value)
const opponentScoreThisRound = computed(
  () => opponentCumulativeScore.value - opponentScoreWithoutThisRound.value,
)

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

async function updateMyRound(newScore: number) {
  try {
    const roundId = myRoundList.value[currentRound - 1]?.roundId

    const now = Date.now()
    const timeTakenMs = gameStartTime.value ? now - gameStartTime.value : 0

    roundStore.updateMyCurrentRoundData({
      input: inputValue.value,
      score: newScore,
      timeTakenMs: timeTakenMs,
      submittedAt: new Date().toISOString(),
    })

    const { error: updateRoundsTableError } = await supabase
      .from('rounds')
      .update({
        input: inputValue.value,
        score: newScore,
        time_taken_ms: timeTakenMs,
        submitted_at: new Date().toISOString(),
      })
      .eq('match_id', matchId)
      .eq('round_id', roundId)
      .eq('round', currentRound)

    if (updateRoundsTableError) {
      throw new Error('[updateMyRound] 更新資料庫失敗：' + updateRoundsTableError.message)
    }
  } catch (error) {
    alert('submit失敗，請稍後再試')
    router.replace(`/`)

    console.error('[updateMyRound] 發生錯誤：', error)
    throw error
  }
}

//處理對方如果沒有 submit 或漏聽
async function getOpponentRoundData() {
  try {
    const { data: opponentRoundData, error: getOpponentRoundData } = await supabase
      .from('rounds')
      .select('*')
      .eq('user_id', opponentInfo.value.opponentId)
      .eq('round', currentRound)
      .maybeSingle()

    if (!opponentRoundData || getOpponentRoundData?.code === 'PGRST116') {
      console.warn('[getOpponentRoundData] 找不到對方 round，補一筆空資料到 pinia')

      const fallbackRound = {
        roundId: uuidv4(),
        round: currentRound,
        input: '',
        score: 0,
        timeTakenMs: 0,
        submittedAt: null,
        createdAt: new Date().toISOString(),
      }

      roundStore.updateOpponentCurrentRoundData(fallbackRound)
      return
    }

    roundStore.updateOpponentCurrentRoundData({
      roundId: opponentRoundData.round_id,
      round: opponentRoundData.round,
      input: opponentRoundData.input,
      score: opponentRoundData.score,
      timeTakenMs: opponentRoundData.time_taken_ms,
      submittedAt: opponentRoundData.submitted_at,
      createdAt: opponentRoundData.created_at,
    })
  } catch (error) {
    console.error('[getOpponentRoundData] 發生錯誤：', error)
    throw error
  }
}

function getRandomTimeTakenMs(maxim = 10000): number {
  return Math.floor(Math.random() * (maxim + 1))
}

const getVector = async (userAnswer: string) => {
  isWaitingForScore.value = true

  try {
    const res = await fetch('/api/vectors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text1: quizStore.quizList[currentRound - 1].answer,
        text2: userAnswer,
      }),
    })

    const data = await res.json()
    if (res.ok) {
      // 步驟 3: 成功取得向量後，使用 cosineSimilarity 函式計算分數
      if (data.vector1 && data.vector2) {
        console.log(cosineSimilarity(data.vector1, data.vector2), 'cosineSimilarity')
        return cosineSimilarity(data.vector1, data.vector2)
      }
    } else {
      console.error(data.details)
    }
  } catch (error) {
    console.error('Fetch Error:', error)
  } finally {
    isWaitingForScore.value = false
  }
}

function handleInputChange(e: Event) {
  inputValue.value = (e.target as HTMLTextAreaElement).value
}

async function handleSubmit() {
  isButtonDisabled.value = true

  const now = Date.now()
  const timeTakenMs = gameStartTime.value ? now - gameStartTime.value : 0
  const newScore = await getVector(inputValue.value)
  roundStore.updateMyCurrentRoundData({
    input: inputValue.value,
    score: newScore,
    timeTakenMs: timeTakenMs,
    submittedAt: new Date().toISOString(),
  })

  await updateMyRound(newScore ?? 0)
}

onMounted(async () => {
  if (matchStore.matchData.opponentType === 'phantom') {
    const phantomData = phantomRoundList.value[currentRound - 1]
    const delay = phantomData?.timeTakenMs ?? 10000

    setTimeout(() => {
      roundStore.updateOpponentCurrentRoundData({
        roundId: phantomData.roundId,
        round: phantomData.round,
        input: phantomData.input,
        score: phantomData.score,
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
    .reduce((acc, round) => acc + round.score, 0)

  opponentScoreWithoutThisRound.value = opponentRoundList.value
    .slice(0, currentRound)
    .reduce((acc, round) => acc + round.score, 0)

  gameStartTime.value = Date.now()

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
        filter: `user_id=eq.${opponentInfo.value.opponentId}`,
      },
      (payload) => {
        const opponentRoundData = payload.new

        roundStore.updateOpponentCurrentRoundData({
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

watchEffect(() => {
  const myRound = myRoundList.value[currentRound - 1]
  const opponentRound = opponentRoundList.value[currentRound - 1]

  const mySubmitted = !!myRound?.submittedAt
  const opponentSubmitted = !!opponentRound?.submittedAt
  const timeOver = remainingTime.value === 0

  const bothSubmitted = mySubmitted && opponentSubmitted
  const shouldEndRound = timeOver || bothSubmitted

  if (!roundFinished.value && shouldEndRound) {
    roundFinished.value = true

    const shouldFetchOpponentRound = mySubmitted && !opponentSubmitted && timeOver

    setTimeout(async () => {
      if (shouldFetchOpponentRound) {
        await getOpponentRoundData()
      }

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

      router.push(`/round-result/${matchId}`)
    }, delayTimeMs)
  }
})
</script>

<template>
  <div class="game-view">
    <div class="flex-wrapper">
      <h1>Round {{ currentRound }}</h1>
      <h1>倒數計時 {{ remainingTime }}</h1>
    </div>

    <img :src="currentQuizImage" class="img-box" />

    <div class="flex-wrapper">
      <div>
        <div>
          <p>My Name: {{ userInfo.userName }}</p>
          <p>My 目前累積的Score: {{ myScoreWithoutThisRound }}</p>
          <p>My 本回合Score: +{{ myScoreThisRound }}</p>
        </div>

        <div v-if="!roundFinished">
          <div>
            <label for="inputValue">My Input: </label>
            <textarea id="inputValue" v-model="inputValue" @input="handleInputChange"></textarea>
          </div>
          <button @click="handleSubmit">Submit !</button>
        </div>
      </div>

      <div>
        <p class="opponent-text">Opponent Name: {{ opponentInfo.opponentName }}</p>
        <p class="opponent-text">Opponent 目前累積的Score: {{ opponentScoreWithoutThisRound }}</p>
        <p class="opponent-text">Opponent 本回合Score: +{{ opponentScoreThisRound }}</p>
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
