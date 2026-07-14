import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Quiz {
  quizId: string
  quizSetId: number
  order: number
  imageUrl: string
  answer: string
  preparedAiAnswer: string
}

export const useQuizStore = defineStore('quiz', () => {
  const quizList = ref<Quiz[]>([])

  function setQuizList(data: Quiz[]) {
    quizList.value = data
  }

  function clearQuizList() {
    quizList.value = []
  }

  return {
    quizList,
    setQuizList,
    clearQuizList,
  }
})
