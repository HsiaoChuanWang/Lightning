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
  const matchData = ref<Match>({
    matchId: '',
    playerOneId: '',
    playerTwoId: '',
    opponentType: '',
    quizSetId: 0,
    status: 'in_progress',
    isComplete: false,
  })

  function setMatchData(data: Match) {
    matchData.value = data
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
    matchData,
    setMatchData,
    clearMatchData,
  }
})
