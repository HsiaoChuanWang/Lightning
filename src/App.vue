<script setup lang="ts">
import { onMounted } from 'vue'
import router from './router'
import { useUserStore } from './stores/user'

onMounted(() => {
  const userStore = useUserStore()
  if (!userStore.userInfo.userId) {
    router.replace(`/`)
  }
})
</script>

<template>
  <!-- <header>
    <div>
      <nav>
        <RouterLink to="/">Login</RouterLink>
        <RouterLink to="/game">Game</RouterLink>
      </nav>
    </div>
  </header> -->

  <RouterView />
</template>

<style scoped></style>
