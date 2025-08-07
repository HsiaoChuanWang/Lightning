<script setup lang="ts">
import { onMounted, ref } from 'vue'
import router from './router'
import { useUserStore } from './stores/user'

onMounted(() => {
  const userStore = useUserStore()
  if (!userStore.userInfo.userId) {
    router.replace(`/`)
  }
})

const prompt = ref('請描述這張圖片的內容。如果有問題，請告訴我問題在哪裡？') // <-- 預設提示
const imageUrl = ref('https://i.imgur.com/9suDcj2.jpeg')
const answer = ref('')
const loading = ref(false)

const handleAskGemini = async () => {
  loading.value = true
  answer.value = '連線中，請稍候...'

  try {
    // 抓圖片 blob
    const imageRes = await fetch(imageUrl.value)
    const imageBlob = await imageRes.blob()

    // 轉成 base64
    const base64Image = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(imageBlob)
    })

    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt.value,
        imageBase64: base64Image, // 注意這邊改為傳 base64
      }),
    })

    const data = await res.json()
    if (res.ok) {
      answer.value = data.text
    } else {
      answer.value = `錯誤：${data.error}`
      console.error(data.details)
    }
  } catch (error) {
    console.error('Fetch Error:', error)
    answer.value = '連線失敗，請檢查網路或後端配置。'
  } finally {
    loading.value = false
  }
}
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
  <button @click="handleAskGemini">test</button>
  <h3>Gemini 回應：</h3>
  <p v-if="answer">{{ answer }}</p>
  <p v-else>點擊按鈕來測試連線...</p>
</template>

<style scoped></style>
