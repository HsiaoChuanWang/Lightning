<script setup lang="ts">
import router from '@/router'
import { useRoundStore } from '@/stores/round'
import { useUserStore } from '@/stores/user'
import { sleep } from '@/utils/helpers'
import { storeToRefs } from 'pinia'
import { onMounted } from 'vue'

const roundStore = useRoundStore()

const { myRoundList } = storeToRefs(roundStore)

onMounted(async () => {
  const userStore = useUserStore()
  if (!userStore.userInfo.userId) {
    router.replace('/')
  }

  await sleep(1000)
  router.push('/game')
})
</script>

<template>
  <div class="round-view">
    <h1>Round {{ myRoundList.length }}</h1>
  </div>
</template>

<style>
.round-view {
  min-height: 100vh;
  min-width: 100vw;
  border: 1px solid #ccc;
}
.users-box {
  display: flex;
  gap: 24px;
}
.user-box {
  border: 1px solid red;
}
</style>
