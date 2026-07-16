<script setup lang="ts">
import PlayAgainModal from '@/components/common/PlayAgainModal.vue'
import PlayerInfo from '@/components/common/PlayerInfo.vue'
import ButtonComponent from '@/components/ui-components/ButtonComponent.vue'
import { REMATCH_RESULT_DELAY_MS } from '@/config/timing'
import { supabase } from '@/lib/supabaseClient'
import { toMatch } from '@/mappers/matchMapper'
import { toRevengeInfo } from '@/mappers/revengeMapper'
import { findMatchedMatch, insertMatch } from '@/services/matchService'
import {
  sendRevengeRequest as persistRevengeRequest,
  updateRevengeStatus as persistRevengeStatus,
} from '@/services/revengeService'
import { useGlobalStore } from '@/stores/global'
import { useMatchStore, type OpponentType } from '@/stores/match'
import { useRevengeStore } from '@/stores/revenge'
import { useRoundStore } from '@/stores/round'
import { useUserStore } from '@/stores/user'
import type { RevengeRecord } from '@/types/database'
import { getRandomQuizSetId } from '@/utils/helpers'
import { allowNextNavigationOnce, safePush, safeReplace, usePageGuard } from '@/utils/usePageGuard'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'

usePageGuard()

const globalStore = useGlobalStore()
const userStore = useUserStore()
const roundStore = useRoundStore()
const matchStore = useMatchStore()
const revengeStore = useRevengeStore()

const { isPlayAgainModalOpen } = storeToRefs(globalStore)
const { userInfo, opponentInfo } = storeToRefs(userStore)
const { myRoundList, opponentRoundList } = storeToRefs(roundStore)
const { matchData } = storeToRefs(matchStore)

let insertRevengeChannel: RealtimeChannel | null = null
let updateRevengeChannel: RealtimeChannel | null = null

const route = useRoute()
const matchId = route.params.matchId
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

/**
 * 對方率先按下
 * 監聽 revenge_requests 的 INSERT 事件。
 * 對方第一次發出再戰邀請時，將資料轉成 RevengeInfo 並開啟 Play Again Modal。
 */
onMounted(() => {
  insertRevengeChannel = supabase
    .channel('insert-revenge-listener')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'revenge_requests',
        filter: `match_id=eq.${matchId}`,
      },
      (payload) => {
        const response = payload.new

        if (response.status === 'pending') {
          revengeStore.setRevengeInfo(toRevengeInfo(response as RevengeRecord))

          globalStore.setIsPlayAgainModalOpen(true)
        }
      },
    )
    .subscribe()
})

/**
 * 我先按下，等待對方回應
 * 監聽 revenge_requests 的 UPDATE 事件。
 * pending 會顯示邀請；matched 會進入新對戰；rejected 或 canceled 會關閉 Modal 並返回首頁。
 */
onMounted(() => {
  updateRevengeChannel = supabase
    .channel('update-revenge-listener')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'revenge_requests',
        filter: `match_id=eq.${matchId}`,
      },
      (payload) => {
        const response = payload.new

        revengeStore.setRevengeInfo(toRevengeInfo(response as RevengeRecord))

        if (response.status === 'pending') {
          globalStore.setIsPlayAgainModalOpen(true)
        }

        if (response.status === 'matched') {
          setTimeout(() => {
            allowNextNavigationOnce()
            safePush(`/start-challenge/${response.revenge_id}`)
            globalStore.setIsPlayAgainModalOpen(false)
          }, REMATCH_RESULT_DELAY_MS)
        }

        if (response.status === 'rejected' || response.status === 'canceled') {
          setTimeout(() => {
            globalStore.setIsPlayAgainModalOpen(false)
            allowNextNavigationOnce()
            safePush(`/`)
          }, REMATCH_RESULT_DELAY_MS)
        }
      },
    )
    .subscribe()
})

// 離開最終結果頁時解除兩個 Revenge Realtime channel，避免重複處理後續邀請狀態。
onBeforeUnmount(() => {
  if (insertRevengeChannel) {
    supabase.removeChannel(insertRevengeChannel)
  }

  if (updateRevengeChannel) {
    supabase.removeChannel(updateRevengeChannel)
  }
})

async function checkExistingMatch(userId: string): Promise<boolean> {
  const existingMatch = await findMatchedMatch(userId)

  if (existingMatch) {
    matchStore.setMatchData(toMatch(existingMatch))
    allowNextNavigationOnce()
    safePush(`/start-challenge/${existingMatch.match_id}`)

    return true
  }

  return false
}

async function createMatch(
  playerOneId: string,
  playerTwoId: string,
  opponentType: OpponentType,
  quizSetId: number,
  matchId: string,
) {
  try {
    const isExistingMatch = await checkExistingMatch(playerOneId)

    if (isExistingMatch) {
      await persistRevengeStatus(matchId, 'rejected')
      revengeStore.updateRevengeStatus('rejected')

      return
    }

    matchStore.setMatchData({
      matchId: matchId,
      playerOneId: playerOneId,
      playerTwoId: playerTwoId,
      opponentType: opponentType,
      quizSetId: quizSetId,
      isComplete: false,
      status: 'matched',
    })

    await insertMatch({ matchId, playerOneId, playerTwoId, opponentType, quizSetId })
  } catch (err) {
    console.error('[建立對戰失敗]', err)
    throw err
  }
}

async function sendRevengeRequest() {
  try {
    const matchId = route.params.matchId
    const fromId = userInfo.value.userId
    const toId = opponentInfo.value.opponentId

    const existing = await persistRevengeRequest({ matchId, fromUserId: fromId, toUserId: toId })

    if (!existing) return

    revengeStore.updateRevengeStatus('matched')

    await createMatch(
      existing.from_user_id,
      existing.to_user_id,
      'human',
      getRandomQuizSetId(),
      existing.revenge_id,
    )
  } catch (err) {
    console.error('[sendRevengeRequest] 發生錯誤', err)
  }
}

async function handlePlayAgain() {
  await sendRevengeRequest()
  globalStore.setIsPlayAgainModalOpen(true)
}

async function handleBackToHome() {
  safeReplace('/')
}

// onMounted(() => {
//   const timer = setInterval(() => {
//     if (countdown.value > 0 && !isPlayAgainModalOpen.value) {
//       countdown.value--
//     } else {
//       clearInterval(timer)
//     }
//   }, 1000)
// })

// watchEffect(async () => {
//   if (countdown.value === 0) {
//     globalStore.setIsPlayAgainModalOpen(false)
//     safeReplace('/')
//   }
// })
const { isWin } = storeToRefs(matchStore)
console.log(isWin.value, 'gameResult')

const gameResult = computed(() => {
  if (winnerId.value === userInfo.value.userId) return 'win'
  if (winnerId.value === opponentInfo.value.opponentId) return 'lose'
  return 'tie'
})
</script>

<template>
  <div
    class="game-result-view"
    :class="{
      'win-background': gameResult === 'win',
      'lose-background': gameResult === 'lose',
      'tie-background': gameResult === 'tie',
    }"
  >
    <p v-if="gameResult === 'win'" class="title bungee-regular-96">Win!</p>
    <p v-if="gameResult === 'lose'" class="title bungee-regular-96">Lose...</p>
    <p v-if="gameResult === 'tie'" class="title bungee-regular-96">Tie!</p>

    <div class="score-section">
      <div class="player-card">
        <PlayerInfo
          icon-size="36px"
          icon-color="var(--color-blue-1000)"
          :value="userInfo.userName"
          value-color="var(--color-neutral-900)"
          value-typo="quantico-bold-20"
        />

        <div class="score-block my-score-block">
          <p class="score-text exo2-blod-80">{{ myCumulativeScore }}</p>
        </div>
      </div>

      <div class="player-card">
        <PlayerInfo
          icon-size="36px"
          icon-color="var(--color-red-200)"
          :value="opponentInfo.opponentName"
          value-color="var(--color-neutral-900)"
          value-typo="quantico-bold-20"
        />

        <div class="score-block opponent-score-block">
          <p class="score-text exo2-blod-80">{{ opponentCumulativeScore }}</p>
        </div>
      </div>
    </div>

    <div class="buttons-container">
      <ButtonComponent
        class="quantico-regular-22"
        color-theme="mustard"
        width="200px"
        @click="handlePlayAgain"
        v-if="matchData.opponentType === 'human'"
      >
        Play again
      </ButtonComponent>

      <ButtonComponent
        class="quantico-regular-22"
        color-theme="neutral"
        width="200px"
        @click="handleBackToHome"
      >
        Back to Home
      </ButtonComponent>
    </div>

    <PlayAgainModal v-if="isPlayAgainModalOpen" />
  </div>
</template>

<style scoped>
.game-result-view {
  min-height: 100vh;
  background-size:
    auto 100%,
    cover;
  background-position: center, center;
  background-repeat: no-repeat, no-repeat;

  display: flex;
  flex-direction: column;
  gap: 48px;
  justify-content: center;
  align-items: center;
}

.win-background {
  background-image:
    url('@/assets/images/common/lightningBackground.png'),
    linear-gradient(to bottom, var(--color-teal-500), var(--color-teal-400));
}

.lose-background {
  background-image:
    url('@/assets/images/common/lightningBackground.png'),
    linear-gradient(to bottom, var(--color-pink-800), var(--color-pink-900));
}

.tie-background {
  background-image:
    url('@/assets/images/common/lightningBackground.png'),
    linear-gradient(to bottom, var(--color-yellow-300), var(--color-mustard-600));
}

.title {
  color: var(--color-neutral-50);
  -webkit-text-stroke: 1px var(--color-neutral-900);
  text-shadow:
    2px 2px 0 var(--color-neutral-900),
    3px 3px 0 var(--color-neutral-900);
}

.score-section {
  display: flex;
  gap: 20px;
}

.player-card {
  width: 400px;
  height: 260px;
  background-color: var(--color-neutral-50);
  border: 2px solid var(--color-neutral-900);
  border-radius: 16px;
  padding: 16px 16px 32px;

  display: flex;
  flex-direction: column;
  gap: 16px;
}

.score-block {
  flex: 1 0 0;
  width: 100%;
  border: 1px solid var(--color-neutral-900);
  border-radius: 12px;
  box-shadow: var(--shadow-10);

  display: flex;
  justify-content: center;
  align-items: center;
}

.my-score-block {
  background: linear-gradient(to right, var(--color-warm-600), var(--color-blue-1200));
}

.opponent-score-block {
  background: linear-gradient(
    to right,
    var(--color-yellow-700),
    var(--color-mustard-700),
    var(--color-blue-1300)
  );
}

.score-text {
  color: var(--color-neutral-50);
  text-shadow: 2px 2px 0px 0px var(--color-neutral-1700);
}

.buttons-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
</style>
