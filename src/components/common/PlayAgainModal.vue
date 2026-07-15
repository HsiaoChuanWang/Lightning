<script setup lang="ts">
import { REMATCH_RESULT_DELAY_MS } from '@/config/timing'
import { supabase } from '@/lib/supabaseClient'
import { findMatchedMatch, insertMatch, toMatch } from '@/services/matchService'
import { useGlobalStore } from '@/stores/global'
import { useMatchStore } from '@/stores/match'
import { useRevengeStore, type RevengeStatus } from '@/stores/revenge'
import { useUserStore } from '@/stores/user'
import { getRandomQuizSetId } from '@/utils/helpers'
import { safePush, safeReplace } from '@/utils/usePageGuard'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ModalComponent, { type ModalButton } from '../ui-components/ModalComponent.vue'

const globalStore = useGlobalStore()
const userStore = useUserStore()
const matchStore = useMatchStore()
const revengeStore = useRevengeStore()

const { userInfo } = storeToRefs(userStore)
const { revengeInfo } = storeToRefs(revengeStore)
const { isWin } = storeToRefs(matchStore)

console.log('outWin', isWin.value)

const route = useRoute()
const matchId = route.params.matchId

async function checkExistingMatch(userId: string): Promise<boolean> {
  const existingMatch = await findMatchedMatch(userId)

  if (existingMatch) {
    matchStore.setMatchData(toMatch(existingMatch))

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
      }, REMATCH_RESULT_DELAY_MS)
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
      }, REMATCH_RESULT_DELAY_MS)
    }
  } catch (error) {
    console.error('[replyPlayAgainRequest] 發生錯誤：', error)
  }
}

type RevengeStatusMap = Record<
  RevengeStatus,
  { title: string; description: string; buttons: ModalButton[] }
>

// 在 computed 內部讀取 Store，確保每次狀態改變時都會重新計算
const modalData = computed(() => {
  const isInviter = revengeInfo.value.fromUserId === userInfo.value.userId
  const currentStatus = revengeInfo.value.status

  const initiatorMap: RevengeStatusMap = {
    pending: {
      title: 'Pending',
      description: 'Waiting for the opponent to accept',
      buttons: [
        {
          text: 'Cancel',
          colorTheme: 'neutral',
          onClick: () => replyPlayAgainRequest('canceled'),
        },
      ],
    },
    matched: {
      title: 'Matched',
      description: 'The opponent has accepted',
      buttons: [],
    },
    rejected: {
      title: 'Rejected',
      description: 'The opponent rejected your challenge',
      buttons: [],
    },
    canceled: {
      title: 'Canceled',
      description: 'The rematch request has been canceled',
      buttons: [],
    },
  }

  const invitedMap: RevengeStatusMap = {
    pending: {
      title: 'PLAY AGAIN?',
      description: isWin.value
        ? 'Your defeated opponent has challenged you to a rematch. Do you accept?'
        : 'Your opponent wants a rematch. Ready for revenge?',
      buttons: [
        {
          text: isWin.value ? 'Sure!' : "Let's go!",
          colorTheme: 'mustard',
          onClick: () => replyPlayAgainRequest('matched'),
        },
        {
          text: isWin.value ? 'No thanks' : 'No way',
          colorTheme: 'neutral',
          onClick: () => replyPlayAgainRequest('rejected'),
        },
      ],
    },
    matched: {
      title: 'Matched',
      description: 'The match is starting soon',
      buttons: [],
    },
    rejected: {
      title: 'Rejected',
      description: 'The opponent has rejected',
      buttons: [],
    },
    canceled: {
      title: 'Canceled',
      description: 'The opponent canceled the rematch request',
      buttons: [],
    },
  }

  const currentMap = isInviter ? initiatorMap : invitedMap
  return currentMap[currentStatus]
})
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
