<script setup lang="ts">
import { useUserStore } from '@/stores/user'
import { ref } from 'vue'

const userName = ref('')
const selectedFile = ref<File | null>(null)

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
  }
}

const userStore = useUserStore()

console.log('Current User:', userStore.userName)
console.log('Current opponent:', userStore.opponentName)
</script>

<template>
  <div class="game-view">
    <h1>Game</h1>

    <div>
      <label for="username">User Name: </label>
      <input id="username" v-model="userName" type="text" />
    </div>

    <div>
      <label for="file">Upload Image: </label>
      <input id="file" type="file" accept="image/*" @change="handleFileChange" />
    </div>

    <button @click="$router.push('/home')">Start !</button>
  </div>
</template>

<style>
.game-view {
  min-height: 100vh;
  min-width: 100vw;
  border: 1px solid #ccc;
}
</style>
