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
  const roundList = ref<Round[]>([])

  function updateRoundList(data: Round) {
    roundList.value.push(data)
  }

  return {
    roundList,
    updateRoundList,
  }
})
