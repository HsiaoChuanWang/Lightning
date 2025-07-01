// src/stores/quiz.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Quiz {
  quiz_id: string
  quiz_set_id: number
  order: number
  image_url: string
  answer: string
}

export const useQuizStore = defineStore('quiz', () => {
  const quizSetId = ref<number | null>(null)
  const quizzes = ref<Quiz[]>([])

  function setQuizSet(id: number, data: Quiz[]) {
    quizSetId.value = id
    quizzes.value = data
  }

  function clearQuizSet() {
    quizSetId.value = null
    quizzes.value = []
  }

  return {
    quizSetId,
    quizzes,
    setQuizSet,
    clearQuizSet,
  }
})
