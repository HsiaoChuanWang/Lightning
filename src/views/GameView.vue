<!-- <script setup lang="ts">
import { supabase } from '@/lib/supabaseClient'
import router from '@/router'
import { useQuizStore, type Quiz } from '@/stores/quiz'
import { useUserStore } from '@/stores/user'
import { onMounted, ref } from 'vue'

const inputValue = ref('')
const quizList = ref<Quiz[]>([])
const isButtonDisabled = ref(false)

async function loadQuizSetForUser(userId: string) {
  const quizStore = useQuizStore()

  const { data: match } = await supabase
    .from('matches')
    .select('quiz_set_id')
    .or(`player_one_id.eq.${userId},player_two_id.eq.${userId}`)
    .eq('status', 'in_progress')
    .maybeSingle()

  if (!match?.quiz_set_id) return

  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('*')
    .eq('quiz_set_id', match.quiz_set_id)
    .order('order', { ascending: true })

  console.log('Loaded quizzes for user:', userId, quizzes)

  quizList.value = quizzes || []
}

export async function loadPlayersInfo(myId: string, opponentId: string) {
  const userStore = useUserStore()

  const { data: users, error } = await supabase
    .from('users')
    .select('user_id, user_name, avatar_url, win_count, loss_count, total_matches')
    .in('user_id', [myId, opponentId])

  if (error) {
    console.error('[loadPlayersInfo] 讀取使用者資料失敗：', error)
    throw new Error('[loadPlayersInfo] 撈取對戰雙方資料失敗')
  }

  const myInfo = users.find((u) => u.user_id === myId)
  const opponentInfo = users.find((u) => u.user_id === opponentId)

  if (!myInfo || !opponentInfo) {
    throw new Error('[loadPlayersInfo] 缺少使用者資訊')
  }

  userStore.setUser({
    userId: myInfo.user_id,
    userName: myInfo.user_name,
    avatarUrl: myInfo.avatar_url,
    winCount: myInfo.win_count,
    lossCount: myInfo.loss_count,
    totalMatches: myInfo.total_matches,
  })

  userStore.setOpponent({
    opponentId: opponentInfo.user_id,
    opponentName: opponentInfo.user_name,
    opponentAvatarUrl: opponentInfo.avatar_url,
    winCount: opponentInfo.win_count,
    lossCount: opponentInfo.loss_count,
    totalMatches: opponentInfo.total_matches,
  })
}

// 只有成功建立 match 才載入資料
if (opponentType !== 'ai') {
  await loadPlayersInfo(myId, playerTwoId)
} else {
  const userStore = useUserStore()
  userStore.setOpponent({
    opponentId: playerTwoId,
    opponentName: '泡泡醬',
    opponentAvatarUrl: 'https://media.tenor.com/6depeYBIOBMAAAAe/you-better-not-be-careful.png',
    winCount: 0,
    lossCount: 0,
    totalMatches: 0,
  })
}
onMounted(() => {
  loadQuizSetForUser(userStore.userId)
})

function handleInputChange(e: Event) {
  inputValue.value = (e.target as HTMLTextAreaElement).value
}

function handleSubmit() {
  isButtonDisabled.value = true

  // const userStore = useUserStore()
  // userStore.setOpponent({
  //   opponentId: userInfo[0].user_id,
  //   opponentName: userInfo[0].user_name,
  //   opponentAvatarUrl: userInfo[0].avatar_url,
  // })
}

const userStore = useUserStore()
const quizStore = useQuizStore()

//重整頁面，需要重新登入
onMounted(() => {
  const userStore = useUserStore()
  if (!userStore.userId) {
    router.replace('/')
  }
})

console.log('Current User:', userStore.userName)
console.log('Current opponent:', userStore.opponentName)
console.log('Current User Avatar:', userStore.avatarUrl)
console.log(quizList.value)
</script>

<template>
  <div class="game-view">
    <h1>Game</h1>

    <div>
      <label for="inputValue">My Input: </label>
      <textarea id="inputValue" v-model="inputValue" @input="handleInputChange"></textarea>
    </div>

    <button @click="$router.push('/home')">Submit !</button>
  </div>
</template>

<style>
.game-view {
  min-height: 100vh;
  min-width: 100vw;
  border: 1px solid #ccc;
}
.users-wrapper {
  display: flex;
  gap: 16px;
}
.users-box {
  border: 1px solid #ccc;
}
</style> -->
