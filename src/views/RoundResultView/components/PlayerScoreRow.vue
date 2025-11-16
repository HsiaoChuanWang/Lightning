<script setup lang="ts">
import PlayerInfo from '@/components/common/PlayerInfo.vue'

const {
  iconColor,
  playerName,
  originalScore,
  accuracyScore,
  timeBonusScore,
  originalWidth,
  accuracyWidth,
  timeBonusWidth,
} = defineProps<{
  iconColor: string
  playerName: string
  originalScore: number
  accuracyScore: number
  timeBonusScore: number
  originalWidth: number
  accuracyWidth: number
  timeBonusWidth: number
}>()
</script>

<template>
  <div class="player-row">
    <PlayerInfo
      icon-size="36px"
      :icon-color="iconColor"
      :value="playerName"
      value-color="var(--color-neutral-900)"
      value-typo="quantico-bold-20"
    />

    <div class="score-row">
      <div class="score-block">
        <div class="score-bar original-bar" :style="{ width: originalWidth + '%' }">
          <p class="score-number bungee-regular-60">{{ originalScore }}</p>
        </div>

        <p class="quantico-bold-16">Original</p>
      </div>

      <div class="score-block">
        <div class="score-bar accuracy-bar" :style="{ width: accuracyWidth + '%' }">
          <p class="score-number bungee-regular-60">+{{ accuracyScore }}</p>
        </div>

        <p class="quantico-bold-16">Accuracy</p>
      </div>

      <div class="score-block">
        <div class="score-bar time-bonuos-bar" :style="{ width: timeBonusWidth + '%' }">
          <p class="score-number bungee-regular-60">+{{ timeBonusScore }}</p>
        </div>

        <p class="quantico-bold-16">Time Bonus</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.player-row {
  width: 100%;

  display: flex;
  align-items: center;
  gap: 16px;
}

.score-row {
  flex: 1 0 0;

  display: flex;
  gap: 8px;
}

.score-block {
  width: fit-content;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.score-bar {
  min-width: 100px;
  height: 117px;
  border-radius: 8px;

  display: flex;
  justify-content: center;
  align-items: center;
}

.original-bar {
  background-color: var(--color-blue-1100);
}

.accuracy-bar {
  background-color: var(--color-pink-700);
}

.time-bonuos-bar {
  background-color: var(--color-warm-500);
}

.score-number {
  color: var(--color-neutral-100);
  -webkit-text-stroke: 2px var(--color-neutral-900);
}
</style>
