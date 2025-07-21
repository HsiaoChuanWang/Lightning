<script setup lang="ts">
import { supabase } from '@/lib/supabaseClient'
import router from '@/router'
import { useMatchStore } from '@/stores/match'
import { useRoundStore } from '@/stores/round'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'

const userStore = useUserStore()
const matchStore = useMatchStore()
const roundStore = useRoundStore()

const { userInfo, opponentInfo } = storeToRefs(userStore)
const { myRoundList, opponentRoundList } = storeToRefs(roundStore)
const { matchData } = storeToRefs(matchStore)

const isPlayerOne = userInfo.value.userId === matchData.value.playerOneId
const currentRound = myRoundList.value.length
const myCumulativeScore = computed(() =>
  myRoundList.value.reduce((acc, round) => acc + round.score, 0),
)
const opponentCumulativeScore = computed(() =>
  opponentRoundList.value.reduce((acc, round) => acc + round.score, 0),
)
const winnerId = computed(() => {
  if (myCumulativeScore.value > opponentCumulativeScore.value) {
    return userInfo.value.userId
  } else if (myCumulativeScore.value < opponentCumulativeScore.value) {
    return opponentInfo.value.opponentId
  } else {
    return null
  }
})

const totalRounds = 5

async function updateMatch() {
  try {
    matchStore.updateMatchData({
      status: 'completed',
      isComplete: true,
    })

    const { error: updateMatchesTableError } = await supabase
      .from('matches')
      .update({
        winner_id: winnerId.value,
        is_player_one_complete: isPlayerOne,
        is_player_two_complete: !isPlayerOne,
        status: 'completed',
      })
      .eq('match_id', matchStore.matchData.matchId)

    if (updateMatchesTableError) {
      throw new Error(
        '[updateMatchesTableError] 更新資料庫失敗：' + updateMatchesTableError.message,
      )
    }
    return true
  } catch (error) {
    console.error('[updateMatchesTableError] 發生錯誤：', error)
    return false
  }
}

onMounted(async () => {
  if (currentRound < 5) {
    setTimeout(() => {
      router.push('/round-start')
    }, 3000)
  } else {
    const success = await updateMatch()
    if (!success) {
      alert('比賽結果儲存失敗，請稍後再試')
    }
    router.push('/game-result')
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
      <h1>Round {{ currentRound }}</h1>
    </div>

    <div class="round-indicators">
      <div
        v-for="n in totalRounds"
        :key="n"
        :class="['round-box', { active: n <= currentRound }]"
      ></div>
    </div>

    <div class="flex-wrapper">
      <div>
        <div>
          <p>My Name: {{ userInfo.userName }}</p>
          <p>My 目前累積的Score: {{ myCumulativeScore }}</p>
          <p v-if="winnerId === userInfo.userId">win</p>
        </div>
      </div>

      <p v-if="winnerId === null">平手</p>

      <div>
        <p class="opponent-text">Opponent Name: {{ opponentInfo.opponentName }}</p>
        <p class="opponent-text">Opponent 目前累積的Score: {{ opponentCumulativeScore }}</p>
        <p v-if="winnerId === opponentInfo.opponentId">win</p>
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
.round-indicators {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.round-box {
  width: 24px;
  height: 24px;
  border: 2px solid #444;
  background-color: #ccc;
  border-radius: 6px;
}
.round-box.active {
  background-color: #333;
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
