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
    <img alt="Vue logo" class="logo" src="@/assets/logo.svg" width="125" height="125" />

    <div class="wrapper">
      <HelloWorld msg="You did it!" />
      <nav>
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/about">About</RouterLink>
      </nav>
    </div>
  </header>

  <main>
    <h2>🎵 樂器清單：</h2>
    <ul>
      <!-- <li v-for="instrument in instruments" :key="instrument.id">
        {{ instrument.name }}
      </li> -->

      <li>test</li>
    </ul>
  </main>

  <RouterView />
</template>

<style scoped>
/* 原本的樣式保留即可 */
</style>
