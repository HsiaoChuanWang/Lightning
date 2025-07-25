import GameResultView from '@/views/GameResultView.vue'
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
      path: '/start-challenge/:matchId',
      name: 'start-challenge',
      component: StartChallengeView,
    },
    {
      path: '/round-start/:matchId',
      name: 'round-start',
      component: RoundStartView,
    },
    {
      path: '/game/:matchId',
      name: 'game',
      component: GameView,
    },
    {
      path: '/round-result/:matchId',
      name: 'RoundResultView',
      component: RoundResultView,
    },
    {
      path: '/game-result/:matchId',
      name: 'GameResultView',
      component: GameResultView,
    },
  ],
})

export default router
