<script setup lang="ts">
import { supabase } from '@/lib/supabaseClient'
import router from '@/router'
import { useMatchStore } from '@/stores/match'
import { useQuizStore } from '@/stores/quiz'
import { useRoundStore } from '@/stores/round'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { onBeforeMount, watchEffect } from 'vue'

const userStore = useUserStore()
const matchStore = useMatchStore()
const quizStore = useQuizStore()
const roundStore = useRoundStore()

const { userInfo, opponentInfo, myCurrentId } = storeToRefs(userStore)
const { matchData } = storeToRefs(matchStore)

async function loadUsersData() {
  try {
    const { playerOneId, playerTwoId } = matchStore.matchData

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

    if (opponent) {
      userStore.setOpponentInfo({
        opponentId: opponent.user_id,
        opponentName: opponent.user_name,
        opponentAvatarUrl: opponent.avatar_url,
        winCount: opponent.win_count,
        lossCount: opponent.loss_count,
        totalMatches: opponent.total_matches,
      })
    }
  } catch (error) {
    console.error('[loadUsersData] 發生錯誤：', error)
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

    quizStore.setQuizList(quizzes || [])

    console.log('[loadQuizData] 題目已載入', quizzes)
  } catch (error) {
    console.error('[loadQuizData] 發生錯誤:', error)
    throw error
  }
}

onBeforeMount(async () => {
  try {
    await loadUsersData()
    await loadQuizData()
  } catch (e) {
    console.error('[initRound] 初始化失敗', e)
  }
})

watchEffect(async () => {
  const ready = userInfo.value.userId && matchData.value.matchId && matchData.value.quizSetId
  if (ready && roundStore.myRoundList.length === 0) {
    router.push('/round-start')
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
  <div class="view-wrapper">
    <div class="users-box">
      <div class="user">
        <p>{{ userInfo.userName }}</p>
        <p>win: {{ userInfo.winCount }}</p>
        <p>lose: {{ userInfo.lossCount }}</p>
      </div>

      <p>V.S.</p>

      <div class="user">
        <p>{{ opponentInfo.opponentName }}</p>
        <p>win: {{ opponentInfo.winCount }}</p>
        <p>lose: {{ opponentInfo.lossCount }}</p>
      </div>
    </div>
  </div>
</template>

<style>
.view-wrapper {
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
