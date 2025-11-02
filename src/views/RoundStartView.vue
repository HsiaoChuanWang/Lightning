<script setup lang="ts">
import questionIcon from '@/assets/images/roundStart/questionIcon.png'
import { supabase } from '@/lib/supabaseClient'
import { useGlobalStore } from '@/stores/global'
import { useMatchStore } from '@/stores/match'
import { useQuizStore } from '@/stores/quiz'
import { useRoundStore } from '@/stores/round'
import { useUserStore } from '@/stores/user'
import { sleep } from '@/utils/helpers'
import { allowNextNavigationOnce, safePush, safeReplace, usePageGuard } from '@/utils/usePageGuard'
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { onMounted } from 'vue'
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
const totalRounds = 5

const currentQuiz = quizList.value[currentRound - 1]
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const currentQuizImage = supabaseUrl + currentQuiz?.imageUrl

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
    allowNextNavigationOnce()
    safeReplace(`/`)
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
    allowNextNavigationOnce()
    safeReplace(`/`)
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
      allowNextNavigationOnce()
      safePush({ path: `/game/${matchId}`, state: { allowLeave: true } })
    } else {
      const isPlayerOne = matchStore.matchData.playerOneId === userStore.userInfo.userId

      const { error: updateMatchesTableError } = await supabase
        .from('matches')
        .update({
          is_player_one_complete: !isPlayerOne,
          is_player_two_complete: isPlayerOne,
          status: 'abandoned',
        })
        .eq('match_id', matchId)

      if (updateMatchesTableError) {
        throw new Error(
          '[updateMatchesTableError] 更新資料庫失敗：' + updateMatchesTableError.message,
        )
      }

      safeReplace(`/`)
    }
  } catch (err) {
    console.error('[round-start] 初始化錯誤', err)
    alert('初始化回合，請稍後再試')
    allowNextNavigationOnce()
    safeReplace(`/`)
  }
})

const repeatCount = 4
const space = ' '.repeat(5)
const text = `QUESTION ${myRoundList.value.length}${space}`.repeat(repeatCount)
const chars = text.split('')
const step = 360 / chars.length
const radius = 'min(50vh, 50vw)'
</script>

<template>
  <div class="view-wrapper">
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

    <div class="round-card">
      <p class="bungee-regular-92">Round {{ currentRound }}</p>
    </div>

    <div class="question-card">
      <div class="question-head">
        <img :src="questionIcon" class="head-img" />
        <p class="bungee-regular-36">QUESTION</p>
      </div>

      <div class="question-content">
        <div class="img-container">
          <img :src="currentQuizImage" />
        </div>

        <div class="dot-container" :style="{ '--current-index': currentRound }">
          <div
            v-for="index in totalRounds"
            :key="index"
            class="dot"
            :class="{ active: index + 1 === currentRound }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.view-wrapper {
  min-height: 100vh;
  background-image:
    url('@/assets/images/roundStart/roundStartBackground.png'),
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
  padding: 35px 0;
  background-color: var(--color-neutral-50);
  border-radius: 32px 20px;
  box-shadow: var(--shadow-6);

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
}

.question-head {
  display: flex;
  justify-content: center;
  gap: 3px;
}

.head-img {
  width: 48px;
  height: 48px;
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
