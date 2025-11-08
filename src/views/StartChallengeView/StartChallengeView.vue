<script setup lang="ts">
import { supabase } from '@/lib/supabaseClient'
import { useGlobalStore } from '@/stores/global'
import { useMatchStore } from '@/stores/match'
import { useQuizStore } from '@/stores/quiz'
import { useRevengeStore } from '@/stores/revenge'
import { useRoundStore } from '@/stores/round'
import { useUserStore } from '@/stores/user'
import { computeWinRate } from '@/utils/helpers'
import { allowNextNavigationOnce, safePush, usePageGuard } from '@/utils/usePageGuard'
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { onBeforeMount, ref, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import PlayerCard from './components/PlayerCard.vue'

const globalStore = useGlobalStore()

usePageGuard({
  onReloadAttempt: () => {
    globalStore.setIsBackToLoginModalOpen(true)
  },
})

const userStore = useUserStore()
const matchStore = useMatchStore()
const quizStore = useQuizStore()
const roundStore = useRoundStore()
const revengeStore = useRevengeStore()

const { userInfo, opponentInfo, myCurrentId } = storeToRefs(userStore)
const { matchData } = storeToRefs(matchStore)

const route = useRoute()
const matchId = route.params.matchId

const prompt = ref('請分別描述圖片的內容，不需要特別分點')
const imageUrlList = ref<string[]>([])

async function markMatchInProgress() {
  matchStore.updateMatchStatus('in_progress')

  const { error } = await supabase
    .from('matches')
    .update({ status: 'in_progress' })
    .eq('match_id', matchId)

  if (error) {
    console.error('[markMatchInProgress] failed:', error)
  }
}

async function loadUsersData() {
  try {
    const { playerOneId, playerTwoId, opponentType } = matchStore.matchData

    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .in('user_id', [playerOneId, playerTwoId])

    if (error) throw new Error('[loadUsersData] 載入使用者資料失敗：' + error.message)

    const me = users.find((info) => info.user_id === myCurrentId.value)
    const opponent = users.find((info) => info.user_id !== myCurrentId.value)

    if (me) {
      userStore.setUserInfo({
        userId: me.user_id,
        userName: me.user_name,
        avatarUrl: me.avatar_url,
        winCount: me.win_count,
        lossCount: me.loss_count,
        totalMatches: me.total_matches,
      })
    }

    if (opponent && opponentType !== 'ai') {
      userStore.setOpponentInfo({
        opponentId: opponent.user_id,
        opponentName: opponent.user_name,
        opponentAvatarUrl: opponent.avatar_url,
        winCount: opponent.win_count,
        lossCount: opponent.loss_count,
        totalMatches: opponent.total_matches,
      })
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
      roundStore.aiResponseList = JSON.parse(data.text)
    } else {
      console.error(data.details)
    }
  } catch (error) {
    console.error('Fetch Error:', error)
  }
}

async function loadQuizData() {
  try {
    const quizSetId = matchStore.matchData.quizSetId

    const { data: quizzes, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('quiz_set_id', quizSetId)
      .order('order', { ascending: true })

    if (error) {
      throw new Error('[loadQuizData] 載入 quizzes 失敗：' + error.message)
    }

    const formattedList = quizzes.map((quiz) => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

      if (matchStore.matchData.opponentType === 'ai') {
        imageUrlList.value.push(supabaseUrl + quiz.image_url)
      }

      return {
        quizId: quiz.quiz_id,
        quizSetId: quiz.quiz_set_id,
        order: quiz.order,
        imageUrl: quiz.image_url,
        answer: quiz.answer,
      }
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

onBeforeMount(async () => {
  try {
    await markMatchInProgress()
    await loadUsersData()
    await loadQuizData()
    roundStore.restRoundList()
    roundStore.restOpponentRoundList()
    revengeStore.clearRevengeInfo()
  } catch (e) {
    console.error('[initRound] 初始化失敗', e)
  }
})

watchEffect(async () => {
  const isAiOpponent = matchStore.matchData.opponentType === 'ai'
  const ready =
    userInfo.value.userId &&
    matchData.value.matchId &&
    matchData.value.quizSetId &&
    roundStore.myRoundList.length === 0 &&
    (!isAiOpponent || (isAiOpponent && roundStore.aiResponseList.length > 0))

  if (ready) {
    setTimeout(() => {
      allowNextNavigationOnce()
      safePush({ path: `/round-start/${matchId}`, state: { allowLeave: true } })
    }, 2000)
  }
})
</script>

<template>
  <div class="start-challenge-view">
    <PlayerCard
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
    url('@/assets/images/common/lightningBackground.png'),
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
