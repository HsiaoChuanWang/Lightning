<script setup lang="ts">
import { supabase } from '@/lib/supabaseClient'
import { useMatchStore } from '@/stores/match'
import { useRoundStore } from '@/stores/round'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useGlobalStore } from '@/stores/global'
import { allowNextNavigationOnce, safePush, usePageGuard } from '@/utils/usePageGuard'

const globalStore = useGlobalStore()

usePageGuard({
  onReloadAttempt: () => {
    globalStore.setIsBackToLoginModalOpen(true)
  },
})

const userStore = useUserStore()
const matchStore = useMatchStore()
const roundStore = useRoundStore()

const { userInfo, opponentInfo } = storeToRefs(userStore)
const { myRoundList, opponentRoundList } = storeToRefs(roundStore)
const { matchData } = storeToRefs(matchStore)

const route = useRoute()
const matchId = route.params.matchId

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

async function checkIsAbandonedMatch() {
  const { data: abandonedMatch, error: selectMatchError } = await supabase
    .from('matches')
    .select('*')
    .or(
      `player_one_id.eq.${userStore.userInfo.userId},player_two_id.eq.${userStore.userInfo.userId}`,
    )
    .eq('status', 'abandoned')
    .maybeSingle()

  if (selectMatchError) {
    throw new Error('[selectMatchError] 搜尋match資料失敗：' + selectMatchError.message)
  }

  return Boolean(abandonedMatch)
}

async function updateMatch() {
  try {
    matchStore.updateMatchData({
      status: (await checkIsAbandonedMatch()) ? 'abandoned' : 'completed',
      isComplete: true,
    })

    if (isPlayerOne) {
      const { error: updateMatchesTableError } = await supabase
        .from('matches')
        .update({
          winner_id: winnerId.value,
          is_player_one_complete: isPlayerOne,
          status: (await checkIsAbandonedMatch()) ? 'abandoned' : 'completed',
        })
        .eq('match_id', matchStore.matchData.matchId)

      if (updateMatchesTableError) {
        throw new Error(
          '[updateMatchesTableError] 更新資料庫失敗：' + updateMatchesTableError.message,
        )
      }
    } else {
      const { error: updateMatchesTableError } = await supabase
        .from('matches')
        .update({
          winner_id: winnerId.value,
          is_player_two_complete: !isPlayerOne,
          status: (await checkIsAbandonedMatch()) ? 'abandoned' : 'completed',
        })
        .eq('match_id', matchStore.matchData.matchId)

      if (updateMatchesTableError) {
        throw new Error(
          '[updateMatchesTableError] 更新資料庫失敗：' + updateMatchesTableError.message,
        )
      }
    }

    return true
  } catch (error) {
    console.error('[updateMatchesTableError] 發生錯誤：', error)
    return false
  }
}

async function updateUserWinRate() {
  const { userId, winCount, lossCount, totalMatches } = userInfo.value
  const isWin = winnerId.value === userId

  try {
    const isAbandoned = await checkIsAbandonedMatch()
    if (isAbandoned) return

    matchStore.setIsWin(isWin)

    const { error: updateUserWinRateError } = await supabase
      .from('users')
      .update({
        win_count: isWin ? winCount + 1 : winCount,
        loss_count: isWin ? lossCount : lossCount + 1,
        total_matches: totalMatches + 1,
      })
      .eq('user_id', userId)

    if (updateUserWinRateError) {
      throw new Error(
        '[updateMatchesTableError] 更新User資料庫失敗：' + updateUserWinRateError.message,
      )
    }
  } catch (error) {
    console.error('[updateUserWinRateError] 發生錯誤：', error)
  }
}

onMounted(async () => {
  if (currentRound < 5) {
    setTimeout(() => {
      allowNextNavigationOnce()
      safePush(`/round-start/${matchId}`)
    }, 3000)
  } else {
    const success = await Promise.all([updateMatch(), updateUserWinRate()])

    if (!success) {
      alert('比賽結果儲存失敗，請稍後再試')
    }
    allowNextNavigationOnce()
    safePush(`/game-result/${matchId}`)
  }
})

const myScoreWithoutThisRound = ref(0)
const opponentScoreWithoutThisRound = ref(0)

const myScoreThisRound = computed(() => myCumulativeScore.value - myScoreWithoutThisRound.value)
const opponentScoreThisRound = computed(
  () => opponentCumulativeScore.value - opponentScoreWithoutThisRound.value,
)
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
          <p>My 這輪input: {{ myRoundList[myRoundList.length - 1].input }}</p>
          <p>My 目前累積的Score: {{ myCumulativeScore }}</p>
          <p v-if="winnerId === userInfo.userId">win</p>
        </div>
      </div>

      <p v-if="winnerId === null">平手</p>

      <div>
        <p class="opponent-text">Opponent Name: {{ opponentInfo.opponentName }}</p>
        <p class="opponent-text">
          Opponent 這輪input: {{ opponentRoundList[opponentRoundList.length - 1].input }}
        </p>
        <p class="opponent-text">Opponent 目前累積的Score: {{ opponentCumulativeScore }}</p>
        <p v-if="winnerId === opponentInfo.opponentId">win</p>
      </div>

      <div class="flex-game-view">
        <div>
          <div>
            <p>My Name: {{ userInfo.userName }}</p>
            <p>My 目前累積的Score: {{ myScoreWithoutThisRound }}</p>
            <p>My 本回合Score: +{{ myScoreThisRound }}</p>
          </div>
        </div>

        <div>
          <StarIcon color="var(--color-mustard-600)" size="48" />
          <p class="opponent-text">Opponent Name: {{ opponentInfo.opponentName }}</p>
          <p class="opponent-text">Opponent 目前累積的Score: {{ opponentScoreWithoutThisRound }}</p>
          <p class="opponent-text">Opponent 本回合Score: +{{ opponentScoreThisRound }}</p>
        </div>
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
