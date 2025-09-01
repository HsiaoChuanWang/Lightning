<script setup lang="ts">
import PlayAgainModal from '@/components/common/PlayAgainModal.vue'
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
    .eq('status', 'in_progress')
    .maybeSingle()

  if (existingMatch) {
    matchStore.setMatchData({
      matchId: existingMatch.match_id,
      playerOneId: existingMatch.player_one_id,
      playerTwoId: existingMatch.player_two_id,
      opponentType: existingMatch.opponent_type,
      quizSetId: existingMatch.quiz_set_id,
      isComplete: false,
      status: 'in_progress',
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
      status: 'in_progress',
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
        status: 'in_progress',
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

      <button v-if="isShowPlayAgainButton" @click="handlePlayAgain">AGAIN({{ countdown }})</button>

      <button @click="safeReplace(`/`)">BACK</button>
    </div>
    <PlayAgainModal v-if="isPlayAgainModalOpen" />
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
