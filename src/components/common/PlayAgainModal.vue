<script setup lang="ts">
import { supabase } from '@/lib/supabaseClient'
import { useGlobalStore } from '@/stores/global'
import { useMatchStore } from '@/stores/match'
import { useRevengeStore, type RevengeStatus } from '@/stores/revenge'
import { useUserStore } from '@/stores/user'
import { getRandomQuizSetId } from '@/utils/helpers'
import { safePush, safeReplace } from '@/utils/usePageGuard'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import ModalComponent, { type ModalButton } from '../ui-components/ModalComponent.vue'

const globalStore = useGlobalStore()
const userStore = useUserStore()
const matchStore = useMatchStore()
const revengeStore = useRevengeStore()

const { userInfo } = storeToRefs(userStore)
const { revengeInfo } = storeToRefs(revengeStore)

const route = useRoute()
const matchId = route.params.matchId
const isWin = matchStore.isWin

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

    safePush(`/start-challenge/${existingMatch.match_id}`)
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
        safeReplace(`/`)
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

    safePush(`/start-challenge/${matchId}`)
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
        safeReplace(`/`)
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

//       safeReplace(`/`)
//     }, 10000)
//   }
// })

type RevengeStatusMap = Record<
  RevengeStatus,
  { title: string; description: string; buttons: ModalButton[] }
>

const userMap: RevengeStatusMap = {
  pending: {
    title: 'pending good',
    description: '等待對方接受',
    buttons: [
      {
        text: '取消邀請',
        colorTheme: 'neutral',
        width: '120px',
        onClick: () => replyPlayAgainRequest('canceled'),
      },
    ],
  },
  matched: {
    title: 'matched good',
    description: '對方已經接受',
    buttons: [],
  },

  rejected: {
    title: 'Reject Sad',
    description: '對方拒絕與你對戰',
    buttons: [],
  },

  canceled: {
    title: 'Canceled Sad',
    description: '已取消對戰申請',
    buttons: [],
  },
}

const opponentMap: RevengeStatusMap = {
  pending: {
    title: 'PLAY AGAIN?',
    description: isWin
      ? 'Your defeated opponent has challenged you to another match. Do you accept?'
      : 'Your opponent wants a rematch. Ready for revenge?',
    buttons: [
      {
        text: isWin ? 'Sure!' : "Let's go!",
        colorTheme: 'mustard',
        width: '120px',
        onClick: () => replyPlayAgainRequest('matched'),
      },
      {
        text: isWin ? 'Sure!' : 'No way',
        colorTheme: 'neutral',
        width: '120px',
        onClick: () => replyPlayAgainRequest('rejected'),
      },
    ],
  },
  matched: {
    title: 'matched good',
    description: '即將開始對戰',
    buttons: [],
  },

  rejected: {
    title: 'Reject Sad',
    description: '已拒絕',
    buttons: [],
  },

  canceled: {
    title: 'Canceled Sad',
    description: '對方撤回對戰申請',
    buttons: [],
  },
}

const isFromSelf = revengeInfo.value.fromUserId === userInfo.value.userId
const currentMap = isFromSelf ? userMap : opponentMap
const currentStatus = revengeInfo.value.status
const modalData = currentMap[currentStatus]
</script>

<template>
  <ModalComponent :show="globalStore.isPlayAgainModalOpen" :button-list="modalData.buttons">
    <div class="content-wrapper">
      <p class="bungee-regular-40">{{ modalData.title }}</p>
      <p class="exo2-regular-24 description">{{ modalData.description }}</p>
    </div>
  </ModalComponent>
</template>

<style scoped>
.content-wrapper {
  width: 100%;
  height: 100%;
  text-align: center;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.description {
  height: 120px;
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
</style>
