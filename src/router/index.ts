import GameView from '@/views/GameView.vue'
import RoundResultView from '@/views/RoundResultView.vue'
import RoundStartView from '@/views/RoundStartView.vue'
import StartChallengeView from '@/views/StartChallengeView.vue'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/start-challenge',
      name: 'start-challenge',
      component: StartChallengeView,
    },
    {
      path: '/round-start',
      name: 'round-start',
      component: RoundStartView,
    },
    {
      path: '/game',
      name: 'game',
      component: GameView,
    },
    {
      path: '/round-result',
      name: 'RoundResultView',
      component: RoundResultView,
    },
  ],
})

export default router
