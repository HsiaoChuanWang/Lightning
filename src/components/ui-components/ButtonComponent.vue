<script setup lang="ts">
const openReadmeInEditor = () => fetch('/__open-in-editor?file=README.md')
</script>

<template>
  <button @click="openReadmeInEditor">Open README in Editor</button>
</template>
