<script setup lang="ts">
import BackToLoginModal from '@/components/common/BackToLoginModal.vue'
import { useGlobalStore } from '@/stores/global'
import { onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from './stores/user'

const router = useRouter()
const globalStore = useGlobalStore()
const userStore = useUserStore()

onMounted(() => {
  if (!userStore.userInfo.userId) {
    router.replace(`/`)
  }
})

// A) 攔鍵盤重整（F5 / Ctrl|Cmd+R）→ 自訂 Modal
function onKeyDown(e: KeyboardEvent) {
  const isF5 = e.key === 'F5'
  const isReloadCombo = e.key.toLowerCase() === 'r' && (e.ctrlKey || e.metaKey)
  if (isF5 || isReloadCombo) {
    e.preventDefault()
    e.stopPropagation()
    globalStore.setIsBackToLoginModalOpen(true)
  }
}

// B) 真要離開/重整：只能原生對話框；順便打旗標
function onBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault()
  e.returnValue = ''
}

function keepPlaying() {
  globalStore.setIsBackToLoginModalOpen(false)
}
function abandonAndExit() {
  globalStore.setIsBackToLoginModalOpen(false)
  userStore.clearUser()
  router.replace('/')
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown, { capture: true })
  window.addEventListener('beforeunload', onBeforeUnload)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown, { capture: true })
  window.removeEventListener('beforeunload', onBeforeUnload)
})

// main.ts 或 App.vue (setup 裡)

onMounted(() => {
  const global = useGlobalStore()

  // 1) 保留 router 內建的 history.state
  const keep = history.state ? { ...history.state } : {}
  history.replaceState(keep, '', location.href)

  // 2) 在「當前頁」的 *後面* 推一個哨兵 entry
  //   使用者按 Back 時，瀏覽器會先從哨兵退回「當前頁」
  const sentinel = { ...keep, __blockBack: true }
  history.pushState(sentinel, '', location.href)

  const onPop = () => {
    // 現在的 state 是「退回到當前頁」後的 state（沒有 __blockBack）
    const st = history.state ? { ...history.state } : {}

    // 3) 立刻把哨兵補回去，讓使用者仍停在當前頁（不往前、不刷新）
    const nextSentinel = { ...st, __blockBack: true }
    history.pushState(nextSentinel, '', location.href)

    // （可選）開你的「要離開嗎？」彈窗；不想要就刪掉
    // global.setIsBackToLoginModalOpen(true)
  }

  window.addEventListener('popstate', onPop)

  onBeforeUnmount(() => {
    window.removeEventListener('popstate', onPop)
  })
})
</script>

<template>
  <RouterView />
  <BackToLoginModal @confirm="keepPlaying" @cancel="abandonAndExit" />
</template>
