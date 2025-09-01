<script setup lang="ts">
import BackToLoginModal from '@/components/common/BackToLoginModal.vue'
import { useGlobalStore } from '@/stores/global'
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from './stores/user'
import { safeReplace } from './utils/usePageGuard'

const router = useRouter()
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
function abandonAndExit() {
  globalStore.setIsBackToLoginModalOpen(false)
  userStore.clearUser()
  safeReplace('/')
}
</script>

<template>
  <RouterView />
  <BackToLoginModal @confirm="keepPlaying" @cancel="abandonAndExit" />
</template>
