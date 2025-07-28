import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Round {
  roundId: string
  round: number
  input: string
  score: number
  timeTakenMs: number
  submittedAt: string | null
  createdAt: string
}

export const useRoundStore = defineStore('round', () => {
  const myRoundList = ref<Round[]>([])
  const opponentRoundList = ref<Round[]>([])

  function updateRoundList(data: Round) {
    myRoundList.value.push(data)
  }

  function updateMyCurrentRoundData(payload: Partial<Round>) {
    const index = myRoundList.value.findIndex((data) => data.round === myRoundList.value.length)
    if (index !== -1) {
      myRoundList.value[index] = {
        ...myRoundList.value[index],
        ...payload,
      }
    }
  }

  function restRoundList() {
    myRoundList.value = []
  }

  function updateOpponentRoundList(data: Round) {
    opponentRoundList.value.push(data)
  }

  function updateOpponentCurrentRoundData(payload: Partial<Round>) {
    const index = opponentRoundList.value.findIndex(
      (data) => data.round === opponentRoundList.value.length,
    )
    if (index !== -1) {
      opponentRoundList.value[index] = {
        ...opponentRoundList.value[index],
        ...payload,
      }
    }
  }

  function restOpponentRoundList() {
    opponentRoundList.value = []
  }

  return {
    myRoundList,
    opponentRoundList,
    updateRoundList,
    updateMyCurrentRoundData,
    restRoundList,
    updateOpponentRoundList,
    updateOpponentCurrentRoundData,
    restOpponentRoundList,
  }
})
