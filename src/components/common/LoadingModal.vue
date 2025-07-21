<script setup lang="ts">
import ButtonComponent from '../ui-components/ButtonComponent.vue'
</script>

<template>
  <div class="loading-modal">
    <div class="loading-container">
      <div class="loading-spinner"></div>

      <ButtonComponent @click="">cancel</ButtonComponent>
    </div>
  </div>
</template>

<style scoped>
.loading-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.loading-container {
  width: 400px;
  height: 400px;
  border: 4px solid black;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.loading-spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: #3b82f6;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
