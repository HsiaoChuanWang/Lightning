<script setup lang="ts">
import { computed } from 'vue'

type ColorKey = 'mustard' | 'neutral'

interface ColorMap {
  bg: string
  hoverBg: string
  activeBg: string
  disabledBg: string
  disabledTextColor: string
  disabledBorderColor: string
}

//父傳子，沒有要寫 default 就不用 withDefaults
const props = withDefaults(
  defineProps<{
    colorTheme?: ColorKey
    isDisabled?: boolean
  }>(),
  { colorTheme: 'mustard', disabled: false },
)

const colorMap: Record<ColorKey, ColorMap> = {
  mustard: {
    bg: 'var(--color-mustard-100)',

    hoverBg: 'var(--color-mustard-300)',

    activeBg: 'var(--color-mustard-500)',

    disabledBg: 'var(--color-mustard-300)',
    disabledTextColor: 'var(--color-mustard-500)',
    disabledBorderColor: 'var(--color-mustard-500)',
  },
  neutral: {
    bg: 'var(--color-neutral-300)',

    hoverBg: 'var(--color-neutral-100)',

    activeBg: 'var(--color-neutral-500)',

    disabledBg: 'var(--color-neutral-300)',
    disabledTextColor: 'var(--color-neutral-600)',
    disabledBorderColor: 'var(--color-neutral-600)',
  },
}

const theme = computed(() => colorMap[props.colorTheme])

//子傳父
const emit = defineEmits<{ (event: 'click', payload: MouseEvent): void }>()
function handleClick(ev: MouseEvent) {
  if (props.isDisabled) return
  emit('click', ev)
}
</script>

<template>
  <button class="button" :disabled="isDisabled" @click="handleClick">
    <slot />
  </button>
</template>

<style scoped>
.button {
  font-family: inherit;
  height: 48px;
  padding: 10px 20px;

  color: var(--color-neutral-900);
  background-color: v-bind('theme.bg');
  border: 1px solid var(--color-neutral-900);
  border-radius: 12px;
  box-shadow: var(--shadow-2);

  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease,
    transform 0.06s;
}

.button:not(:disabled):hover {
  background-color: v-bind('theme.hoverBg');
}

.button:not(:disabled):active {
  background-color: v-bind('theme.activeBg');
  transform: translateY(1px);
}

.button:disabled {
  background-color: v-bind('theme.disabledBg');
  color: v-bind('theme.disabledTextColor');
  border-color: v-bind('theme.disabledBorderColor');
  cursor: none;
  box-shadow: none;
}
</style>
