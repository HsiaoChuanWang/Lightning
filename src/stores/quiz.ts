import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Quiz {
  quizId: string
  quizSetId: number
  order: number
  imageUrl: string
  answer: string
}

export const useQuizStore = defineStore('quiz', () => {
  const quizList = ref<Quiz[]>([
    {
      quizId: '533973ca-c376-4ffa-b1a6-18055b1b76a1',
      quizSetId: 1,
      order: 1,
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg',
      answer: 'puffing',
    },
  ])

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
