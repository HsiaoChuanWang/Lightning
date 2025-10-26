<script setup lang="ts">
import { useGlobalStore } from '@/stores/global'
import ModalComponent from '../ui-components/ModalComponent.vue'

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
  <ModalComponent
    :show="globalStore.isBackToLoginModalOpen"
    :button-list="[
      { text: 'EXIT', colorTheme: 'pink', onClick: onConfirm },
      { text: 'CANCEL', colorTheme: 'neutral', onClick: onCancel },
    ]"
  >
    <div class="content-wrapper">
      <p class="bungee-regular-40">Leave now?</p>
      <p class="regular-24 description">If you leave now, it’ll count as a forfeit. Quit?</p>
    </div>
  </ModalComponent>
</template>

<style scoped>
.content-wrapper {
  width: 100%;
  height: 100%;
  text-align: center;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.description {
  height: 120px;
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
</style>
