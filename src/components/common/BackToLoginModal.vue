<script setup lang="ts">
import { useGlobalStore } from '@/stores/global'

const globalStore = useGlobalStore()

// 告訴父層：使用者按了 Yes / No
const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

function onConfirm() {
  emit('confirm')
}
function onCancel() {
  emit('cancel')
}
</script>

<template>
  <div
    class="loading-modal"
    v-show="globalStore.isBackToLoginModalOpen"
    role="dialog"
    aria-modal="true"
    @keydown.esc="onCancel"
  >
    <div class="loading-container">
      <p>重整畫面將視同放棄比賽，你確定要放棄嗎？</p>
      <div style="display: flex; gap: 12px; margin-top: 12px">
        <button @click="onCancel">Yes</button>
        <button @click="onConfirm">No</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading-modal {
  position: fixed;
  inset: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.loading-container {
  width: 400px;
  min-height: 180px;
  border: 4px solid black;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
}
</style>
