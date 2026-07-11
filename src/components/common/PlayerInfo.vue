<script setup lang="ts">
import StarIcon from '@/assets/icons/StarIcon.vue'
import { toRefs } from 'vue'

const props = withDefaults(
  defineProps<{
    iconSize: string
    iconColor: string
    value: number | string
    valueColor: string
    valueTypo: string
    width?: string
    valueAlign?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around'
    wrapText?: boolean
  }>(),
  {
    width: 'fit-content',
    valueAlign: 'flex-start',
    wrapText: true,
  },
)

const { iconSize, iconColor, value, valueColor, valueTypo, width, valueAlign, wrapText } =
  toRefs(props)
</script>

<template>
  <div class="player-info-wrapper">
    <StarIcon :color="iconColor" :size="iconSize" />

    <p class="text" :class="[valueTypo, { 'no-wrap': !wrapText }]">{{ value }}</p>
  </div>
</template>

<style scoped>
.player-info-wrapper {
  width: v-bind(width);
  height: v-bind(iconSize);

  display: flex;
  justify-content: v-bind(valueAlign);
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.player-info-wrapper > :first-child {
  flex-shrink: 0;
}

.text {
  color: v-bind(valueColor);
  min-width: 0;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.text.no-wrap {
  white-space: nowrap;
}
</style>
