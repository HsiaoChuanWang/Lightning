<script setup lang="ts">
import { NInput } from 'naive-ui'
import { computed } from 'vue'

const props = defineProps<{
  modelValue: string
  type?: 'text' | 'textarea' | 'password'
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'input', value: string): void
}>()

// 雙向綁定
const inputValue = computed({
  get: () => props.modelValue,
  set: (value: string) => {
    emit('update:modelValue', value)
    emit('input', value)
  },
})

const inputThemeOverrides = {
  color: 'transparent',
  colorFocus: 'transparent',
  colorHover: 'transparent',
  colorDisabled: 'transparent',
  border: 'none',
  borderHover: 'none',
  borderFocus: 'none',
  borderDisabled: 'none',
  boxShadowFocus: 'none',
  boxShadowDisabled: 'none',
}
</script>

<template>
  <n-input
    v-model:value="inputValue"
    :type="type || 'text'"
    :placeholder="placeholder"
    :disabled="disabled"
    :autosize="true"
    :theme-overrides="inputThemeOverrides"
    class="input quantico-regular-20"
  />
</template>

<style scoped>
.input {
  height: 100%;
}
</style>
