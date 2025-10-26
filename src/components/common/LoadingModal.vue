<script setup lang="ts">
import { supabase } from '@/lib/supabaseClient'
import { useGlobalStore } from '@/stores/global'
import { useMatchStore } from '@/stores/match'
import { useUserStore } from '@/stores/user'
import { formatTime } from '@/utils/helpers'
import { onMounted, onUnmounted, ref } from 'vue'
import ModalComponent from '../ui-components/ModalComponent.vue'

const globalStore = useGlobalStore()
const userStore = useUserStore()
const matchStore = useMatchStore()

const elapsed = ref(0)
const endTime = 15
let timerInterval: number | undefined

onMounted(() => {
  startTimer()
})

onUnmounted(() => {
  stopTimer()
})

function startTimer() {
  stopTimer()
  elapsed.value = 0
  timerInterval = window.setInterval(async () => {
    elapsed.value += 1
    if (elapsed.value >= endTime) {
      stopTimer()
      try {
        await cancelMatch()
      } finally {
        globalStore.setIsLoadingModalOpen(false)
      }
    }
  }, 1000)
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = undefined
  }
}

async function cancelMatch() {
  try {
    const { error: deleteFromMatchingPoolError } = await supabase
      .from('matching_pool')
      .delete()
      .eq('user_id', userStore.myCurrentId)

    if (deleteFromMatchingPoolError) {
      throw new Error(
        '[deleteFromMatchingPoolError] 從 matching_pool 刪除失敗：' +
          deleteFromMatchingPoolError.message,
      )
    }

    matchStore.setIsMatchCanceled(true)

    globalStore.setIsLoadingModalOpen(false)
  } catch (error) {
    console.error('[cancelMatch error] 發生錯誤：', error)
  }
}
</script>

<template>
  <ModalComponent
    :show="globalStore.isLoadingModalOpen"
    title="testTitle"
    content="content"
    :button-list="[{ text: 'CANCEL', colorTheme: 'neutral', onClick: cancelMatch }]"
    :on-close="cancelMatch"
  >
    <div class="content-wrapper">
      <p class="bold-24">Waiting for challenge...</p>

      <div>
        <p class="timer bungee-regular-40">{{ formatTime(elapsed) }}</p>
        <div class="progress-bar">
          <div class="inner-wrapper">
            <div class="loading-mask" />

            <div class="infinite-scroll">
              <template v-for="repeat in 2">
                <div
                  v-for="n in 24"
                  :key="`${repeat}-${n}`"
                  class="parallelogram"
                  :class="{ alt: n % 2 === 0 }"
                />
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </ModalComponent>
</template>

<style scoped lang="scss">
.content-wrapper {
  width: 100%;
  height: 100%;
  padding: 27px 0;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.timer {
  margin-bottom: 8px;
  text-align: center;
}

.progress-bar {
  width: 300px;
  height: 28px;
  padding: 4px;
  background-color: var(--color-warm-200);
  border: 2px solid var(--color-blue-500);
  border-radius: 6px;

  position: relative;
}

.inner-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;

  position: relative;
}

.infinite-scroll {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 4px;

  animation: moveStripe 10s linear infinite;
}

.parallelogram {
  flex-shrink: 0;
  width: 14px;
  height: 100%;
  background-color: var(--color-blue-500);
  border-radius: 2px;
  transform: skewX(-25deg);
}

.parallelogram.alt {
  background-color: var(--color-pink-500);
}

@keyframes moveStripe {
  from {
    transform: translateX(-396px);
  }
  to {
    transform: translateX(0px);
  }
}

.loading-mask {
  position: absolute;
  z-index: 2;
  width: 100%;
  height: 100%;
  right: 0;
  background-color: var(--color-warm-200);

  animation: shrinkMask 15s linear forwards;
}

@keyframes shrinkMask {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}
</style>
