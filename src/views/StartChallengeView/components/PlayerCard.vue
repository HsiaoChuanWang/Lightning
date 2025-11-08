<script setup lang="ts">
import InfoCard from './InfoCard.vue'

interface InfoData {
  winCount: number
  lossCount: number
  winRate: number
}

const { infoData } = defineProps<{
  userId: string
  isMe: boolean
  userName: string
  infoData: InfoData
}>()

interface LabelItem {
  label: 'Win' | 'Lose' | 'Win Rate'
  value: number
  unit?: string
  labelColor: string
}

const labelList: LabelItem[] = [
  { label: 'Win', value: infoData.winCount, labelColor: '#D9F658' },
  { label: 'Lose', value: infoData.lossCount, labelColor: '#F2B6DE' },
  { label: 'Win Rate', value: infoData.winRate, unit: '%', labelColor: '#86E6FF' },
]
</script>

<template>
  <div class="wrapper">
    <div class="player-tag">
      <p class="quantico-bold-24">Player</p>
    </div>

    <div class="ribbon" />

    <div v-if="isMe" class="badge-ring">
      <div class="badge-core exo2-black-22">
        <p>YOU</p>
      </div>
    </div>

    <div class="id-name-box">
      <div class="id-tag">
        <p class="quantico-bold-27">#{{ userId }}</p>
      </div>

      <p class="name bungee-regular-36">{{ userName }}</p>
    </div>

    <div class="info-box">
      <InfoCard
        v-for="item in labelList"
        :key="item.label"
        :label="item.label"
        :value="item.value"
        :unit="item.unit"
        :labelColor="item.labelColor"
      />
    </div>
  </div>
</template>

<style scoped>
.wrapper {
  width: 700px;
  height: 240px;
  background-color: var(--color-neutral-50);
  border-radius: 4px 20px;
  transform: rotate(-1.5deg);
  box-shadow: var(--shadow-3);

  position: relative;
}

.player-tag {
  position: absolute;
  top: 0;
  right: 0;

  width: 197px;
  height: 45px;
  background-color: var(--color-teal-400);
  border-radius: 0 20px;

  text-align: center;
  color: var(--color-blue-500);
  display: flex;
  justify-content: center;
  align-items: center;
}

.ribbon {
  position: absolute;

  width: 135px;
  height: 100%;
  background-color: var(--color-red-500);
  border-radius: 4px 4px 4px 20px;

  clip-path: polygon(0 0, 100% 0, 50% 100%, 0 100%);
}

.badge-ring {
  position: absolute;
  z-index: 2;
  top: -24px;
  left: -30px;

  width: 86px;
  height: 86px;
  background-color: var(--color-neutral-1300);
  border-radius: 0px 86px 86px;

  display: flex;
  justify-content: center;
  align-items: center;
}

.badge-core {
  width: 68px;
  height: 68px;
  border-radius: 68px;
  background-color: var(--color-neutral-800);
  color: var(--color-neutral-50);

  display: flex;
  justify-content: center;
  align-items: center;
}

.id-name-box {
  position: absolute;
  margin: 35px 0 0 35px;
}

.id-tag {
  width: fit-content;
  height: 41px;
  padding: 0 10px;
  background-color: var(--color-neutral-50);
  color: var(--color-neutral-900);
  border: 1px solid var(--color-neutral-900);
  transform: rotate(-5deg);
  margin-bottom: 30px;

  display: flex;
  justify-content: center;
  align-items: center;
}

.name {
  width: 222px;
  max-width: 222px;
  color: var(--color-yellow-300);
  -webkit-text-stroke: 1px var(--color-neutral-900);
  text-shadow:
    1px 2px 0 var(--color-neutral-900),
    3px 4px 0 var(--color-neutral-900);
}

.info-box {
  position: absolute;
  bottom: 43px;
  right: 24px;

  display: flex;
  gap: 14px;

  transform: rotate(-0.5deg);
}
</style>
