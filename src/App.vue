<script setup lang="ts">
import BackToLoginModal from '@/components/common/BackToLoginModal.vue'
import { abandonMatch, findInProgressMatch } from '@/services/matchService'
import { useGlobalStore } from '@/stores/global'
import { onMounted } from 'vue'
import { useUserStore } from './stores/user'
import { safeReplace } from './utils/usePageGuard'

const globalStore = useGlobalStore()
const userStore = useUserStore()

onMounted(() => {
  if (!userStore.userInfo.userId) {
    safeReplace(`/`)
  }
})

function keepPlaying() {
  globalStore.setIsBackToLoginModalOpen(false)
}

async function abandonAndExit() {
  const existingMatch = await findInProgressMatch(userStore.userInfo.userId)

  if (existingMatch) {
    const isPlayerOne = existingMatch.player_one_id === userStore.userInfo.userId
    await abandonMatch(existingMatch.match_id, isPlayerOne)
  }

  globalStore.setIsBackToLoginModalOpen(false)
  userStore.clearUser()
  safeReplace('/')
}
</script>

<template>
  <RouterView />
  <BackToLoginModal @keepPlaying="keepPlaying" @quit="abandonAndExit" />
</template>
