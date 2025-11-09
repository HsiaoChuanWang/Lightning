<script setup lang="ts">
import PlayAgainModal from '@/components/common/PlayAgainModal.vue'
import PlayerInfo from '@/components/common/PlayerInfo.vue'
import ButtonComponent from '@/components/ui-components/ButtonComponent.vue'
import { supabase } from '@/lib/supabaseClient'
import { useGlobalStore } from '@/stores/global'
import { useMatchStore } from '@/stores/match'
import { useRevengeStore } from '@/stores/revenge'
import { useRoundStore } from '@/stores/round'
import { useUserStore } from '@/stores/user'
import { getRandomQuizSetId } from '@/utils/helpers'
import { allowNextNavigationOnce, safePush, safeReplace, usePageGuard } from '@/utils/usePageGuard'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
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

let insertRevengeChannel: RealtimeChannel | null = null
let updateRevengeChannel: RealtimeChannel | null = null

const route = useRoute()
const matchId = route.params.matchId
const countdown = ref(10)
const isShowPlayAgainButton = ref(true)

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

//對方率先按下
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
          revengeStore.setRevengeInfo({
            revengeId: response.revenge_id,
            fromUserId: response.from_user_id,
            toUserId: response.to_user_id,
            matchId: response.match_id,
            status: response.status,
            createdAt: response.created_at,
          })

          globalStore.setIsPlayAgainModalOpen(true)
        }
      },
    )
    .subscribe()
})

//我先按下，等待對方回應
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

        revengeStore.setRevengeInfo({
          revengeId: response.revenge_id,
          fromUserId: response.from_user_id,
          toUserId: response.to_user_id,
          matchId: response.match_id,
          status: response.status,
          createdAt: response.created_at,
        })

        if (response.status === 'pending') {
          globalStore.setIsPlayAgainModalOpen(true)
        }

        if (response.status === 'matched') {
          setTimeout(() => {
            allowNextNavigationOnce()
            safePush(`/start-challenge/${response.revenge_id}`)
            globalStore.setIsPlayAgainModalOpen(false)
          }, 2000)
        }

        if (response.status === 'rejected' || response.status === 'canceled') {
          setTimeout(() => {
            globalStore.setIsPlayAgainModalOpen(false)
            allowNextNavigationOnce()
            safePush(`/`)
          }, 2000)
        }
      },
    )
    .subscribe()
})

onBeforeUnmount(() => {
  if (insertRevengeChannel) {
    supabase.removeChannel(insertRevengeChannel)
  }

  if (updateRevengeChannel) {
    supabase.removeChannel(updateRevengeChannel)
  }
})

async function checkExistingMatch(userId: string): Promise<boolean> {
  const { data: existingMatch } = await supabase
    .from('matches')
    .select('*')
    .or(`player_one_id.eq.${userId},player_two_id.eq.${userId}`)
    .eq('status', 'matched')
    .maybeSingle()

  if (existingMatch) {
    matchStore.setMatchData({
      matchId: existingMatch.match_id,
      playerOneId: existingMatch.player_one_id,
      playerTwoId: existingMatch.player_two_id,
      opponentType: existingMatch.opponent_type,
      quizSetId: existingMatch.quiz_set_id,
      isComplete: false,
      status: 'matched',
    })
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
      const { error: updateMatchError } = await supabase
        .from('revenge_requests')
        .update({ status: 'rejected' })
        .eq('match_id', matchId)

      if (updateMatchError) throw updateMatchError
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

    const { error: insertMatchesError } = await supabase.from('matches').insert([
      {
        match_id: matchId,
        player_one_id: playerOneId,
        player_two_id: playerTwoId,
        opponent_type: opponentType,
        quiz_set_id: quizSetId,
        is_player_one_complete: false,
        is_player_two_complete: false,
        status: 'matched',
        created_at: new Date().toISOString(),
      },
    ])

    if (insertMatchesError) {
      throw new Error(`[建立對戰] 寫入 matches 失敗：${insertMatchesError.message}`)
    }
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

    //如果 match_id 沒有被 insert 過
    const { error: insertError } = await supabase.from('revenge_requests').insert({
      from_user_id: fromId,
      to_user_id: toId,
      match_id: matchId,
      status: 'pending',
    })

    if (insertError && insertError.code === '23505') {
      // 代表 match_id 已存在（UNIQUE 限制）
      // 改成去更新現有資料 status 為 matched，視為對方同意
      console.warn('[sendRevengeRequest] 衝突：match_id 已存在，改為 matched')

      const { data: existing } = await supabase
        .from('revenge_requests')
        .select('*')
        .eq('match_id', matchId)
        .maybeSingle()

      if (existing && existing.status === 'pending') {
        const { error: updateMatchError } = await supabase
          .from('revenge_requests')
          .update({ status: 'matched' })
          .eq('match_id', matchId)

        if (updateMatchError) throw updateMatchError

        revengeStore.updateRevengeStatus('matched')

        await createMatch(
          existing.from_user_id,
          existing.to_user_id,
          'human',
          getRandomQuizSetId(),
          existing.revenge_id,
        )

        return
      }
    }
  } catch (err) {
    console.error('[sendRevengeRequest] 發生錯誤', err)
  }
}

async function handlePlayAgain() {
  await sendRevengeRequest()
  globalStore.setIsPlayAgainModalOpen(true)
}

onMounted(() => {
  const timer = setInterval(() => {
    if (countdown.value > 0 && !isPlayAgainModalOpen.value) {
      countdown.value--
    } else {
      clearInterval(timer)
    }
  }, 1000)
})

onMounted(() => {
  if (matchStore.matchData.opponentType !== 'human') {
    isShowPlayAgainButton.value = false
  }
})

watchEffect(async () => {
  if (countdown.value === 0) {
    globalStore.setIsPlayAgainModalOpen(false)

    isShowPlayAgainButton.value = false
  }
})

const gameResult = computed(() => {
  if (winnerId.value === userInfo.value.userId) return 'win'
  if (winnerId.value === opponentInfo.value.opponentId) return 'lose'
  return 'win'
})
</script>

<template>
  <div
    class="game-result-view"
    :class="{
      'win-background': gameResult === 'win',
      'lose-background': gameResult === 'lose',
    }"
  >
    <p v-if="gameResult === 'win'" class="title bungee-regular-96">Win!</p>
    <p v-if="gameResult === 'lose'" class="title bungee-regular-96">Lose...</p>

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
      >
        Play again
      </ButtonComponent>

      <ButtonComponent
        class="quantico-regular-22"
        color-theme="neutral"
        width="200px"
        @click="safeReplace(`/`)"
      >
        Cancel
      </ButtonComponent>
    </div>

    <PlayAgainModal v-if="isPlayAgainModalOpen" />
  </div>
</template>

<style>
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
