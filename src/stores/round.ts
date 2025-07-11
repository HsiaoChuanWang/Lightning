import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Round {
  roundId: string
  round: string
  input: string
  score: string
  timeTakenMs: number
  submittedAt: string
  createdAt: string
}

export const useRoundStore = defineStore('round', () => {
  const roundList = ref<Round[]>([])

  function updateRoundList(data: Round) {
    roundList.value.push(data)
  }

  return {
    updateRoundList,
  }
})
