import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Match {
  matchId: string
  playerOneId: string
  playerTwoId: string
  opponentType: OpponentType | ''
  quizSetId: number
  status: Status
  isComplete: boolean
}

export const useMatchStore = defineStore('match', () => {
  const isMatchCanceled = ref(false)

  const matchData = ref<Match>({
    matchId: '',
    playerOneId: '',
    playerTwoId: '',
    opponentType: '',
    quizSetId: 0,
    status: 'in_progress',
    isComplete: false,
  })

  function setIsMatchCanceled(isCanceled: boolean) {
    isMatchCanceled.value = isCanceled
  }

  function setMatchData(data: Match) {
    matchData.value = data
  }

  function updateMatchData(payload: Partial<Match>) {
    matchData.value = {
      ...matchData.value,
      ...payload,
    }
  }

  function clearMatchData() {
    matchData.value = {
      matchId: '',
      playerOneId: '',
      playerTwoId: '',
      opponentType: '',
      quizSetId: 0,
      status: 'in_progress',
      isComplete: false,
    }
  }

  return {
    isMatchCanceled,
    matchData,
    setIsMatchCanceled,
    setMatchData,
    updateMatchData,
    clearMatchData,
  }
})
