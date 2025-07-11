import RoundView from '@/views/RoundView.vue'
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
      path: '/round',
      name: 'round',
      component: RoundView,
    },
    // {
    //   path: '/game/:matchId',
    //   name: 'game',
    //   component: GameView,
    // },
  ],
})

export default router
