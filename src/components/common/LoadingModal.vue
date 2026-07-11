<script setup lang="ts">
import { supabase } from '@/lib/supabaseClient'
import { useGlobalStore } from '@/stores/global'
import { useMatchStore } from '@/stores/match'
import { useUserStore } from '@/stores/user'
import { formatTime } from '@/utils/helpers'
import { onUnmounted, ref, watch } from 'vue'
import ModalComponent from '../ui-components/ModalComponent.vue'

const globalStore = useGlobalStore()
const userStore = useUserStore()
const matchStore = useMatchStore()

const totalTime = 30
const remaining = ref(totalTime)
let timerInterval: number | undefined

watch(
  () => globalStore.isLoadingModalOpen,
  (isOpen) => {
    if (isOpen) {
      startTimer()
    } else {
      stopTimer()
      // 不在這裡重設，等待 unmount 後重設為 totalTime
    }
  },
)

onUnmounted(() => {
  stopTimer()
  remaining.value = totalTime
})

function startTimer() {
  stopTimer()
  remaining.value = totalTime
  timerInterval = window.setInterval(async () => {
    remaining.value -= 1
    if (remaining.value <= 0) {
      stopTimer()
      // 檢查是否已配對成功
      if (matchStore.matchData.status === 'matched') {
        // 配對成功，關閉 modal，進行轉導
        globalStore.setIsLoadingModalOpen(false)
      } else {
        // 時間到但未配對，自動取消
        try {
          await cancelMatch()
        } finally {
          globalStore.setIsLoadingModalOpen(false)
        }
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

    stopTimer()
    globalStore.setIsLoadingModalOpen(false)
  } catch (error) {
    console.error('[cancelMatch error] 發生錯誤：', error)
  }
}
</script>

<template>
  <ModalComponent
    :show="globalStore.isLoadingModalOpen"
    :button-list="[{ text: 'CANCEL', colorTheme: 'neutral', onClick: cancelMatch }]"
  >
    <div class="content-wrapper">
      <p class="quantico-bold-24">Waiting for challenge...</p>

      <div>
        <p class="timer bungee-regular-40">{{ formatTime(remaining) }}</p>
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
  background-color: var(--color-red-500);
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

  animation: shrinkMask 30s linear forwards;
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
