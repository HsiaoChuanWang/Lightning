<script setup lang="ts">
// const instruments = ref<any[]>([])

// async function getInstruments() {
//   const { data, error } = await supabase.from('instruments').select()
//   if (error) {
//     console.error('Supabase 查詢錯誤：', error)
//   } else {
//     instruments.value = data ?? []
//   }
// }

// onMounted(() => {
//   getInstruments()
// })
</script>

<template>
  <header>
    <div class="wrapper">
      <nav>
        <RouterLink to="/">Login</RouterLink>
        <RouterLink to="/about">About</RouterLink>
      </nav>
    </div>
  </header>

  <main></main>

  <RouterView />
</template>

<style scoped>
/* 原本的樣式保留即可 */
</style>
