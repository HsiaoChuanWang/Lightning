<script setup lang="ts">
import router from '@/router'
import { useRoundStore } from '@/stores/round'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const userStore = useUserStore()
const roundStore = useRoundStore()

const { userInfo, opponentInfo } = storeToRefs(userStore)
const { myRoundList, opponentRoundList } = storeToRefs(roundStore)

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

const route = useRoute()
const matchId = route.params.matchId

console.log('myRoundList:', myRoundList.value)
console.log('opponentRoundList:', opponentRoundList.value)
console.log('myCumulativeScore:', myCumulativeScore.value)
console.log('opponentCumulativeScore:', opponentCumulativeScore.value)
console.log('winnerId:', winnerId.value)

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
      <h1 v-if="winnerId === userInfo.userId">Win!</h1>
      <h1 v-if="winnerId === opponentInfo.opponentId">Lose!</h1>
    </div>

    <div class="flex-wrapper">
      <div>
        <div>
          <p>My Name: {{ userInfo.userName }}</p>
          <p>My 目前累積的Score: {{ myCumulativeScore }}</p>
        </div>
      </div>

      <p v-if="winnerId === null">平手</p>

      <div>
        <p class="opponent-text">Opponent Name: {{ opponentInfo.opponentName }}</p>
        <p class="opponent-text">Opponent 目前累積的Score: {{ opponentCumulativeScore }}</p>
      </div>

      <button>AGAIN</button>
      <button @click="router.push('/')">BACK</button>
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
