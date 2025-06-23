<script setup lang="ts">
import { ref } from 'vue'

const userName = ref('')
const selectedFile = ref<File | null>(null)

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
  }
}
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
