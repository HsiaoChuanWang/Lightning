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
  const myRoundList = ref<Round[]>([
    {
      roundId: '1',
      round: 1,
      input: 'test',
      score: 0,
      timeTakenMs: 1000,
      submittedAt: null,
      createdAt: '2025-07-15T07:32:00.000Z',
    },
  ])
  const opponentRoundList = ref<Round[]>([
    {
      roundId: '1',
      round: 1,
      input: 'test',
      score: 100,
      timeTakenMs: 1000,
      submittedAt: null,
      createdAt: '2025-07-15T07:32:00.000Z',
    },
  ])

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
    restOpponentRoundList,
  }
})
