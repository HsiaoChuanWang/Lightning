<script setup lang="ts">
import { supabase } from '@/lib/supabaseClient'
import router from '@/router'
import { useGlobalStore } from '@/stores/global'
import { useMatchStore } from '@/stores/match'
import { useRevengeStore, type RevengeStatus } from '@/stores/revenge'
import { useUserStore } from '@/stores/user'
import { getRandomQuizSetId } from '@/utils/helpers'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'

const globalStore = useGlobalStore()
const userStore = useUserStore()
const matchStore = useMatchStore()
const revengeStore = useRevengeStore()

const { userInfo, opponentInfo } = storeToRefs(userStore)
const { revengeInfo } = storeToRefs(revengeStore)

const route = useRoute()
const matchId = route.params.matchId

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

    router.push(`/start-challenge/${existingMatch.match_id}`)
    globalStore.setIsPlayAgainModalOpen(false)

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

      setTimeout(() => {
        router.replace(`/`)
        globalStore.setIsPlayAgainModalOpen(false)
      }, 2000)
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

    router.push(`/start-challenge/${matchId}`)
    globalStore.setIsPlayAgainModalOpen(false)
  } catch (err) {
    console.error('[建立對戰失敗]', err)
    throw err
  }
}

async function replyPlayAgainRequest(status: RevengeStatus) {
  try {
    const { error: replyPlayAgainRequestError } = await supabase
      .from('revenge_requests')
      .update({
        status,
      })
      .eq('match_id', matchId)

    if (replyPlayAgainRequestError) {
      throw new Error(
        '[replyPlayAgainRequest] 更新revenge資料庫失敗：' + replyPlayAgainRequestError.message,
      )
    }

    revengeStore.updateRevengeStatus(status)

    if (status === 'matched') {
      await createMatch(
        revengeInfo.value.fromUserId,
        revengeInfo.value.toUserId,
        'human',
        getRandomQuizSetId(),
        revengeInfo.value.revengeId,
      )
    } else {
      setTimeout(() => {
        globalStore.setIsPlayAgainModalOpen(false)
        router.replace(`/`)
      }, 2000)
    }
  } catch (error) {
    console.error('[replyPlayAgainRequest] 發生錯誤：', error)
  }
}

// onMounted(() => {
//   if (revengeStore.revengeInfo.status === 'pending') {
//     setTimeout(async () => {
//       await supabase.from('revenge_requests').update({ status: 'canceled' }).eq('match_id', matchId)
//       globalStore.setIsPlayAgainModalOpen(false)

//       router.replace(`/`)
//     }, 10000)
//   }
// })
</script>

<template>
  <div class="loading-modal" v-show="globalStore.isPlayAgainModalOpen">
    <div class="loading-container">
      <p v-if="revengeInfo.fromUserId === userInfo.userId && revengeInfo.status === 'rejected'">
        對方拒絕與你對戰
      </p>

      <p
        v-if="
          revengeInfo.fromUserId === opponentInfo.opponentId && revengeInfo.status === 'rejected'
        "
      >
        已拒絕
      </p>

      <p v-if="revengeInfo.fromUserId === userInfo.userId && revengeInfo.status === 'canceled'">
        已取消對戰申請
      </p>

      <p
        v-if="
          revengeInfo.fromUserId === opponentInfo.opponentId && revengeInfo.status === 'canceled'
        "
      >
        對方撤回對戰申請
      </p>

      <p v-if="revengeInfo.fromUserId === userInfo.userId && revengeInfo.status === 'matched'">
        對方已經接受
      </p>

      <p v-if="revengeInfo.toUserId === userInfo.userId && revengeInfo.status === 'matched'">
        即將開始對戰
      </p>

      <div v-if="revengeInfo.fromUserId === userInfo.userId && revengeInfo.status === 'pending'">
        <p>等待對方接受</p>
        <button @click="replyPlayAgainRequest('canceled')">Cancel</button>
      </div>

      <div
        v-if="
          revengeInfo.fromUserId === opponentInfo.opponentId && revengeInfo.status === 'pending'
        "
      >
        <p>你是否接受對戰邀請？</p>

        <button @click="replyPlayAgainRequest('matched')">Accept</button>

        <button @click="replyPlayAgainRequest('rejected')">Reject</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.loading-container {
  width: 400px;
  height: 400px;
  border: 4px solid black;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.loading-spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: #3b82f6;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
