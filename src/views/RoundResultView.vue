<script setup lang="ts">
import { supabase } from '@/lib/supabaseClient'
import { useMatchStore } from '@/stores/match'
import { useRoundStore } from '@/stores/round'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import PlayerInfo from '@/components/common/PlayerInfo.vue'
import { useGlobalStore } from '@/stores/global'
import { usePageGuard } from '@/utils/usePageGuard'

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

// onMounted(async () => {
//   if (currentRound < 5) {
//     setTimeout(() => {
//       allowNextNavigationOnce()
//       safePush(`/round-start/${matchId}`)
//     }, 3000)
//   } else {
//     const success = await Promise.all([updateMatch(), updateUserWinRate()])

//     if (!success) {
//       alert('比賽結果儲存失敗，請稍後再試')
//     }
//     allowNextNavigationOnce()
//     safePush(`/game-result/${matchId}`)
//   }
// })

const myScoreWithoutThisRound = ref(0)
const opponentScoreWithoutThisRound = ref(0)

const myScoreThisRound = computed(() => myCumulativeScore.value - myScoreWithoutThisRound.value)
const opponentScoreThisRound = computed(
  () => opponentCumulativeScore.value - opponentScoreWithoutThisRound.value,
)

//myScoreWithoutThisRound
const myOriginalScore = 84

//myScoreThisRound
const myAccuracyScore = 121

//myCumulativeScore
const myTimeBonusScore = 48

//opponentScoreWithoutThisRound
const opponentOriginalScore = 56

//opponentScoreThisRound
const opponentAccuracyScore = 28

//opponentCumulativeScore
const opponentTimeBonusScore = 17
</script>

<template>
  <div class="round-result-view">
    <div class="round-card">
      <p class="title bungee-regular-60">Scoring Time!</p>

      <div class="main">
        <div class="player-row">
          <PlayerInfo
            icon-size="36px"
            icon-color="var(--color-red-200)"
            :value="userInfo.userName"
            value-color="var(--color-neutral-900)"
            value-typo="quantico-bold-20"
          />

          <div class="score-row">
            <div class="score-block">
              <div class="score-bar original-bar">
                <p class="score-number bungee-regular-60">{{ opponentOriginalScore }}</p>
              </div>

              <p class="quantico-bold-16">Original</p>
            </div>

            <div class="score-block">
              <div class="score-bar accuracy-bar">
                <p class="score-number bungee-regular-60">+{{ opponentAccuracyScore }}</p>
              </div>

              <p class="quantico-bold-16">Accuracy</p>
            </div>

            <div class="score-block">
              <div class="score-bar time-bonuos-bar">
                <p class="score-number bungee-regular-60">+{{ opponentTimeBonusScore }}</p>
              </div>

              <p class="quantico-bold-16">Time Bonus</p>
            </div>
          </div>
        </div>

        <div class="player-row">
          <PlayerInfo
            icon-size="36px"
            icon-color="var(--color-blue-1000)"
            :value="opponentInfo.opponentName"
            value-color="var(--color-neutral-900)"
            value-typo="quantico-bold-20"
          />

          <div class="score-row">
            <div class="score-block">
              <div class="score-bar original-bar">
                <p class="score-number bungee-regular-60">{{ myOriginalScore }}</p>
              </div>

              <p class="quantico-bold-16">Original</p>
            </div>

            <div class="score-block">
              <div class="score-bar accuracy-bar">
                <p class="score-number bungee-regular-60">+{{ myAccuracyScore }}</p>
              </div>

              <p class="quantico-bold-16">Accuracy</p>
            </div>

            <div class="score-block">
              <div class="score-bar time-bonuos-bar">
                <p class="score-number bungee-regular-60">+{{ myTimeBonusScore }}</p>
              </div>

              <p class="quantico-bold-16">Time Bonus</p>
            </div>
          </div>
        </div>
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

.player-row {
  width: 100%;

  display: flex;
  align-items: center;
  gap: 16px;
}

.score-row {
  flex: 1 0 0;

  display: flex;
  gap: 8px;
}

.score-block {
  width: fit-content;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.score-bar {
  width: 300px;
  height: 117px;
  border-radius: 8px;

  display: flex;
  justify-content: center;
  align-items: center;
}

.original-bar {
  background-color: var(--color-blue-1100);
}

.accuracy-bar {
  background-color: var(--color-pink-700);
}

.time-bonuos-bar {
  background-color: var(--color-warm-500);
}

.score-number {
  color: var(--color-neutral-100);
  -webkit-text-stroke: 2px var(--color-neutral-900);
}
</style>
