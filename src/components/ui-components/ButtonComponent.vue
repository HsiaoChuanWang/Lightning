<script setup lang="ts">
defineProps<{
  onClick?: () => void
}>()
</script>

<template>
  <button @click="onClick">
    <slot />
  </button>
</template>
