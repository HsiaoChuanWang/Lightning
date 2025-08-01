<script setup lang="ts">
// 重整頁面，需要重新登入
// onMounted(() => {
//   const userStore = useUserStore()
//   if (!userStore.userInfo.userId) {
//     router.replace(`/`)
//   }
// })
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
</template>

<style scoped></style>
