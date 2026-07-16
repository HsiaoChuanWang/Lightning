import { toMatch } from '@/mappers/matchMapper'
import { findMatchedMatch, insertMatch } from '@/services/matchService'
import {
  sendRevengeRequest as persistRevengeRequest,
  updateRevengeStatus as persistRevengeStatus,
} from '@/services/revengeService'
import { useGlobalStore } from '@/stores/global'
import { useMatchStore, type OpponentType } from '@/stores/match'
import { useRevengeStore } from '@/stores/revenge'
import { useUserStore } from '@/stores/user'
import { getRandomQuizSetId } from '@/utils/helpers'
import { allowNextNavigationOnce, safePush } from '@/utils/usePageGuard'
import { storeToRefs } from 'pinia'

export function useRematch(matchId: string | string[]) {
  const globalStore = useGlobalStore()
  const matchStore = useMatchStore()
  const revengeStore = useRevengeStore()
  const userStore = useUserStore()
  const { userInfo, opponentInfo } = storeToRefs(userStore)

  // 用於對方已經先接受再戰，並建立新 match，此時若按下 Play Again 應避免重複建立第二場。
  async function enterExistingMatch(userId: string) {
    const existingMatch = await findMatchedMatch(userId)

    if (!existingMatch) return false
    matchStore.setMatchData(toMatch(existingMatch))
    allowNextNavigationOnce()
    safePush(`/start-challenge/${existingMatch.match_id}`)
    return true
  }

  /** 再戰雙方皆可配對時，建立新的真人 match 並更新 Match Store。 */
  async function createRematch(
    playerOneId: string,
    playerTwoId: string,
    opponentType: OpponentType,
    quizSetId: number,
    revengeId: string,
  ) {
    const hasExistingMatch = await enterExistingMatch(playerOneId)

    if (hasExistingMatch) {
      await persistRevengeStatus(revengeId, 'rejected')
      revengeStore.updateRevengeStatus('rejected')
      return
    }

    matchStore.setMatchData({
      matchId: revengeId,
      playerOneId,
      playerTwoId,
      opponentType,
      quizSetId,
      isComplete: false,
      status: 'matched',
    })
    await insertMatch({
      matchId: revengeId,
      playerOneId,
      playerTwoId,
      opponentType,
      quizSetId,
    })
  }

  async function sendRematchRequest() {
    try {
      const existing = await persistRevengeRequest({
        matchId,
        fromUserId: userInfo.value.userId,
        toUserId: opponentInfo.value.opponentId,
      })

      if (!existing) return
      revengeStore.updateRevengeStatus('matched')
      await createRematch(
        existing.from_user_id,
        existing.to_user_id,
        'human',
        getRandomQuizSetId(),
        existing.revenge_id,
      )
    } catch (error) {
      console.error('[sendRematchRequest] 發生錯誤', error)
    }
  }

  async function handlePlayAgain() {
    await sendRematchRequest()
    globalStore.setIsPlayAgainModalOpen(true)
  }

  return { handlePlayAgain }
}
