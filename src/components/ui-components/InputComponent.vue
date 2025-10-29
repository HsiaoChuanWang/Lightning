<script setup lang="ts">
defineProps<{
  modelValue: string
  isDisabled?: boolean
  width: string
  padding?: string
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', payload: string): void
}>()

//如果想要讓物件解構後，仍有響應性，且可以在<script>中使用，需要使用 toRefs
// const { modelValue, isDisabled } = toRefs(props)

//Vue 的 onChange 會等離開 input 才進行值的更新，及時更新要用 onInput
//update:是固定的，是 v-model 雙向綁定機制的關鍵約定（naming convention）
function handleInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  emit('update:modelValue', value)
}
</script>

<template>
  <input
    :value="modelValue"
    :disabled="isDisabled"
    @input="handleInput"
    :class="['quantico-regular-22', 'input']"
    placeholder="Enter your name [20 words]"
  />
</template>

<style scoped>
.input {
  width: v-bind(width);
  height: 48px;
  padding: v-bind(padding);
  text-align: center;
  outline: none;

  color: var(--color-neutral-900);
  background-color: var(--color-neutral-50);
  border: 1px solid var(--color-neutral-900);
  border-radius: 12px;
  box-shadow: var(--shadow-2);
}

.input::placeholder {
  color: var(--color-neutral-600);
}

.input:not(:disabled):focus {
  background-color: var(--color-warm-100);
}

.input:disabled {
  background-color: var(--color-neutral-100);
  color: var(--color-neutral-500);
  border-color: var(--color-neutral-600);
  cursor: not-allowed;
  box-shadow: none;
}
</style>
