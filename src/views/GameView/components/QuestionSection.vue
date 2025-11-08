<script setup lang="ts">
import StarIcon from '@/assets/icons/StarIcon.vue'
import actionComment from '@/assets/images/game/actionComment.png'
import actionLove from '@/assets/images/game/actionLove.png'
import actionShare from '@/assets/images/game/actionShare.png'
import QuestionDisplay from '@/components/common/QuestionDisplay.vue'

defineProps<{
  currentQuizImage: string
  currentRound: number
  totalRounds: number
  correctAnswer: string
  showAnswer: boolean
}>()
</script>

<template>
  <div class="question-section">
    <div class="title">
      <StarIcon color="var(--color-mustard-600)" size="48" />

      <p class="bungee-regular-36">QUESTION</p>
    </div>

    <QuestionDisplay
      :current-quiz-image="currentQuizImage"
      :current-round="currentRound"
      :total-rounds="totalRounds"
      :correct-answer="correctAnswer"
      :show-answer="showAnswer"
    />

    <div class="question-footer">
      <p class="quantico-regular-28">{{ currentRound }}/{{ totalRounds }}</p>

      <div class="action-icons">
        <img :src="actionLove" />
        <img :src="actionShare" />
        <img :src="actionComment" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.question-section {
  width: 340px;
  height: 100%;

  display: flex;
  flex-direction: column;
  gap: 24px;
}

.title {
  display: flex;
  align-items: center;
  gap: 16px;
}

.question-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.action-icons {
  height: 24px;
  display: flex;
  gap: 13px;
}
</style>
