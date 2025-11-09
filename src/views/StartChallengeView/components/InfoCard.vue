<script setup lang="ts">
defineProps<{
  label: string
  value: number
  unit?: string
  labelColor: string
}>()
</script>

<template>
  <div class="info-wrapper">
    <div class="head">
      <p class="quantico-bold-22">{{ label }}</p>
    </div>

    <div class="body">
      <div class="value">
        <p class="bungee-regular-40">{{ value }}</p>
        <p v-if="unit" class="bungee-regular-20">{{ unit }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.info-wrapper {
  width: 120px;
  height: 110px;

  display: flex;
  flex-direction: column;
}

.head {
  width: 100%;
  height: 32px;
  background-color: var(--color-neutral-900);
  color: v-bind(labelColor);
  border-radius: 8px 8px 0 0;

  display: flex;
  justify-content: center;
  align-items: center;
}

.body {
  flex: 1 1 0;

  border: 1px solid var(--color-neutral-900);
  border-radius: 0 0 8px 8px;
  box-shadow: var(--shadow-4);

  display: flex;
  justify-content: center;
  align-items: center;
}

.value {
  display: flex;
  align-items: flex-end;
}
</style>
