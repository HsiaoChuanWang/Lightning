<script setup lang="ts">
import { START_CHALLENGE_DURATION_MS } from '@/config/timing'
import { toOpponentInfo, toUserInfo } from '@/mappers/userMapper'
import { updateMatchStatus } from '@/services/matchService'
import { findQuizzesBySetId } from '@/services/quizService'
import { fetchImageDescriptions } from '@/services/scoringService'
import { findUsersByIds } from '@/services/userService'
import { useGlobalStore } from '@/stores/global'
import { useMatchStore } from '@/stores/match'
import { useQuizStore } from '@/stores/quiz'
import { useRevengeStore } from '@/stores/revenge'
import { useRoundStore } from '@/stores/round'
import { useUserStore } from '@/stores/user'
import { computeWinRate } from '@/utils/helpers'
import { safePush, usePageGuard } from '@/composables/usePageGuard'
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, onBeforeMount, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PlayerCard from './components/PlayerCard.vue'

const globalStore = useGlobalStore()
const userStore = useUserStore()
const matchStore = useMatchStore()
const quizStore = useQuizStore()
const roundStore = useRoundStore()
const revengeStore = useRevengeStore()
const route = useRoute()
const matchId = route.params.matchId

const { userInfo, opponentInfo, myCurrentId } = storeToRefs(userStore)
const { matchData } = storeToRefs(matchStore)

usePageGuard({
  onReloadAttempt: () => {
    globalStore.setIsBackToLoginModalOpen(true)
  },
})

const prompt = ref('請分別描述圖片的內容，不需要特別分點')
const imageUrlList = ref<string[]>([])
let navigationTimer: ReturnType<typeof setTimeout> | null = null
let hasScheduledNavigation = false

const navigationReady = computed(() => {
  const isAiOpponent = matchStore.matchData.opponentType === 'ai'
  return Boolean(
    userInfo.value.userId &&
      matchData.value.matchId &&
      matchData.value.quizSetId &&
      roundStore.myRoundList.length === 0 &&
      (!isAiOpponent || roundStore.aiResponseList.length > 0),
  )
})

async function markMatchInProgress() {
  matchStore.updateMatchStatus('in_progress')

  try {
    await updateMatchStatus(matchId, 'in_progress')
  } catch (error) {
    console.error('[markMatchInProgress] failed:', error)
  }
}

async function loadUsersData() {
  try {
    const { playerOneId, playerTwoId, opponentType } = matchStore.matchData

    const users = await findUsersByIds([playerOneId, playerTwoId])

    const me = users.find((info) => info.user_id === myCurrentId.value)
    const opponent = users.find((info) => info.user_id !== myCurrentId.value)

    if (me) {
      userStore.setUserInfo(toUserInfo(me))
    }

    if (opponent && opponentType !== 'ai') {
      userStore.setOpponentInfo(toOpponentInfo(opponent))
    }

    if (opponentType === 'ai') {
      userStore.setOpponentInfo({
        opponentId: uuidv4(),
        opponentName: 'AI opponent',
        opponentAvatarUrl: '',
        winCount: 0,
        lossCount: 0,
        totalMatches: 0,
      })
    }
  } catch (error) {
    console.error('[loadUsersData] 發生錯誤：', error)
  }
}

const getAiResponse = async () => {
  console.log('getAiResponse')
  try {
    const answers = await fetchImageDescriptions(prompt.value, imageUrlList.value)
    if (answers) roundStore.setAiResponseList(answers)
  } catch (error) {
    console.error('Fetch Error:', error)
    roundStore.setAiResponseList(quizStore.quizList.map((quiz) => quiz.preparedAiAnswer || ''))
  }
}

async function loadQuizData() {
  try {
    const quizSetId = matchStore.matchData.quizSetId

    const quizzes = await findQuizzesBySetId(quizSetId)

    const formattedList = quizzes.map((quiz) => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

      if (matchStore.matchData.opponentType === 'ai') {
        imageUrlList.value.push(supabaseUrl + quiz.imageUrl)
      }

      return quiz
    })

    quizStore.setQuizList(formattedList || [])

    if (matchStore.matchData.opponentType === 'ai') {
      await getAiResponse()
    }

    console.log('[loadQuizData] 題目已載入', quizzes)
  } catch (error) {
    console.error('[loadQuizData] 發生錯誤:', error)
    throw error
  }
}

watch(
  navigationReady,
  (ready) => {
    if (!ready || hasScheduledNavigation) return

    hasScheduledNavigation = true
    navigationTimer = setTimeout(() => {
      navigationTimer = null
      safePush({ path: `/round-start/${matchId}`, state: { allowLeave: true } })
    }, START_CHALLENGE_DURATION_MS)
  },
  { immediate: true },
)

onBeforeMount(async () => {
  try {
    await markMatchInProgress()
    await loadUsersData()
    await loadQuizData()
    roundStore.resetRoundList()
    roundStore.resetOpponentRoundList()
    revengeStore.clearRevengeInfo()
  } catch (e) {
    console.error('[initRound] 初始化失敗', e)
  }
})

onBeforeUnmount(() => {
  if (navigationTimer) clearTimeout(navigationTimer)
})
</script>

<template>
  <div class="start-challenge-view">
    <PlayerCard
      :delay="0"
      :user-id="userInfo.userId"
      :is-me="true"
      :user-name="userInfo.userName"
      :info-data="{
        winCount: userInfo.winCount,
        lossCount: userInfo.lossCount,
        winRate: computeWinRate(userInfo.winCount, userInfo.lossCount),
      }"
    />

    <PlayerCard
      :delay="0.8"
      :user-id="opponentInfo.opponentId"
      :is-me="false"
      :user-name="opponentInfo.opponentName"
      :info-data="{
        winCount: opponentInfo.winCount,
        lossCount: opponentInfo.lossCount,
        winRate: computeWinRate(opponentInfo.winCount, opponentInfo.lossCount),
      }"
    />
  </div>
</template>

<style scoped>
.start-challenge-view {
  min-height: 100vh;
  background-image:
    url('@/assets/images/startChallenge/startChallengeBackground.png'),
    linear-gradient(to bottom, var(--color-blue-300), var(--color-blue-700));
  background-size:
    auto 100%,
    cover;
  background-position: center, center;
  background-repeat: no-repeat, no-repeat;

  display: flex;
  flex-direction: column;
  gap: 30px;
  justify-content: center;
  align-items: center;
}
</style>
