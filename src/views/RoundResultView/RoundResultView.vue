<script setup lang="ts">
import { supabase } from '@/lib/supabaseClient'
import { useGlobalStore } from '@/stores/global'
import { useMatchStore } from '@/stores/match'
import { useRoundStore } from '@/stores/round'
import { useUserStore } from '@/stores/user'
import { allowNextNavigationOnce, safePush, usePageGuard } from '@/utils/usePageGuard'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import PlayerScoreRow from './components/PlayerScoreRow.vue'

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
  myRoundList.value.reduce((acc, round) => acc + round.score + round.bonus, 0),
)
const opponentCumulativeScore = computed(() =>
  opponentRoundList.value.reduce((acc, round) => acc + round.score + round.bonus, 0),
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

const myScoreThisRound = computed(() => roundStore.myRoundList[currentRound - 1]?.score ?? 0)

const myBonusThisRound = computed(() => roundStore.myRoundList[currentRound - 1]?.bonus ?? 0)

const opponentScoreThisRound = computed(
  () => roundStore.opponentRoundList[currentRound - 1]?.score ?? 0,
)

const opponentBonusThisRound = computed(
  () => roundStore.opponentRoundList[currentRound - 1]?.bonus ?? 0,
)

const maxTotal = computed(() => Math.max(myCumulativeScore.value, opponentCumulativeScore.value))

function calcWidth(score: number) {
  return maxTotal.value > 0 ? (score / maxTotal.value) * 100 : 0
}
</script>

<template>
  <div class="round-result-view">
    <div class="round-card">
      <p class="title bungee-regular-60">Scoring Time!</p>

      <div class="main">
        <PlayerScoreRow
          icon-color="var(--color-red-200)"
          :player-name="userInfo.userName"
          :original-score="myScoreWithoutThisRound"
          :accuracy-score="myScoreThisRound"
          :time-bonus-score="myBonusThisRound"
          :original-width="calcWidth(myScoreWithoutThisRound)"
          :accuracy-width="calcWidth(myScoreThisRound)"
          :time-bonus-width="calcWidth(myBonusThisRound)"
        />

        <PlayerScoreRow
          icon-color="var(--color-blue-1000)"
          :player-name="opponentInfo.opponentName"
          :original-score="opponentScoreWithoutThisRound"
          :accuracy-score="opponentScoreThisRound"
          :time-bonus-score="opponentBonusThisRound"
          :original-width="calcWidth(opponentScoreWithoutThisRound)"
          :accuracy-width="calcWidth(opponentScoreThisRound)"
          :time-bonus-width="calcWidth(opponentBonusThisRound)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.round-result-view {
  width: 100vw;
  height: 100vh;
  min-height: 100vh;
  padding: 40px;
  background: linear-gradient(
    to bottom,
    var(--color-teal-800),
    var(--color-yellow-600),
    var(--color-pink-100)
  );
}

.round-card {
  width: 100%;
  height: 100%;
  padding: 48px 32px 40px;
  background-color: var(--color-neutral-1200);
  border: 2px solid var(--color-neutral-900);
  border-radius: 30px;
  box-shadow: var(--shadow-9);

  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 63px;
}

.title {
  text-align: center;
}

.main {
  flex: 1 0 0;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}
</style>
