<script setup lang="ts">
import EntryBanner from '@/components/common/EntryBanner.vue'
import LoadingModal from '@/components/common/LoadingModal.vue'
import PlayAgainModal from '@/components/common/PlayAgainModal.vue'
import ButtonComponent from '@/components/ui-components/ButtonComponent.vue'
import InputComponent from '@/components/ui-components/InputComponent.vue'
import {
  LOGIN_CLOUDS_DELAY_MS,
  LOGIN_FORM_DELAY_MS,
  LOGIN_INPUT_DELAY_MS,
  LOGIN_STARS_DELAY_MS,
  MATCH_SEARCH_POLL_INTERVAL_MS,
  MATCH_SEARCH_TIMEOUT_MS,
} from '@/config/timing'
import { supabase } from '@/lib/supabaseClient'
import { toMatch } from '@/mappers/matchMapper'
import { abandonMatch, findInProgressMatch, insertMatch } from '@/services/matchService'
import {
  enterMatchingPool as addToMatchingPool,
  createAiOpponent,
  findPhantomCandidate,
  hasMatchedHuman,
  matchHuman,
  removeFromMatchingPool,
} from '@/services/opponentMatchingService'
import { findRounds } from '@/services/roundService'
import { createUser } from '@/services/userService'
import { useGlobalStore } from '@/stores/global'
import { useMatchStore, type OpponentType } from '@/stores/match'
import { useQuizStore } from '@/stores/quiz'
import { useRevengeStore } from '@/stores/revenge'
import { useRoundStore } from '@/stores/round'
import { useUserStore } from '@/stores/user'
import type { MatchRecord } from '@/types/database'
import { currentVersion } from '@/utils/config'
import { getRandomQuizSetId, sleep } from '@/utils/helpers'
import { safePush, usePageGuard } from '@/utils/usePageGuard'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { nextTick, onBeforeUnmount, onMounted, onUnmounted, ref } from 'vue'

usePageGuard({
  unloadPrompt: false,
  blockKeyboardReload: false,
})

const globalStore = useGlobalStore()
const roundStore = useRoundStore()
const matchStore = useMatchStore()

const { isMatchCanceled } = storeToRefs(matchStore)

const userName = ref('')
const isMatched = ref(false)
const isProcessing = ref(false)

let matchSubscription: RealtimeChannel | null = null

/**
 * 訂閱 matches 資料表的 INSERT 事件，接收其他玩家或資料庫函式建立的配對。
 * 收到事件後只處理包含目前使用者的 match，更新 Match Store 並播放進場動畫。
 * 重新訂閱前會先移除舊 channel，避免同一使用者重複收到配對事件。
 */
async function subscribeToMatch(userId: string) {
  if (matchSubscription) {
    supabase.removeChannel(matchSubscription)
    matchSubscription = null
  }

  matchSubscription = supabase
    .channel(`match-channel-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'matches',
      },
      (payload) => {
        isMatched.value = true
        const { player_one_id, player_two_id } = payload.new

        if (player_one_id === userId || player_two_id === userId) {
          console.log('收到配對:', payload.new)

          const matchStore = useMatchStore()
          matchStore.setMatchData(toMatch(payload.new as MatchRecord))

          triggerEntryAnimation(`/start-challenge/${payload.new.match_id}`)
        }
      },
    )
    .subscribe()
}

// 離開登入頁時解除 Realtime 訂閱，避免已卸載頁面繼續處理配對事件。
onUnmounted(() => {
  if (matchSubscription) supabase.removeChannel(matchSubscription)
})

async function initUser(userName: string): Promise<{
  userId: string
  avatarUrl: string
  userName: string
}> {
  try {
    const cachedUserStr = localStorage.getItem(`user_info_${userName}`)
    if (cachedUserStr) {
      const cachedUserInfo = JSON.parse(cachedUserStr)
      if (cachedUserInfo.userName === userName) {
        return cachedUserInfo
      }
    }

    const userId = uuidv4()

    await createUser(userId, userName)

    const userInfo = { userId, avatarUrl: '', userName }
    localStorage.setItem(`user_info_${userName}`, JSON.stringify(userInfo))

    return userInfo
  } catch (error) {
    console.error('[初始化使用者失敗]', error)
    throw error
  }
}

async function checkExistingMatch(userId: string) {
  const existingMatch = await findInProgressMatch(userId)

  if (existingMatch) {
    const isPlayerOne = existingMatch.player_one_id === userId
    await abandonMatch(existingMatch.match_id, isPlayerOne)
  }
}

async function enterMatchingPool(userId: string) {
  try {
    await addToMatchingPool(userId)
  } catch (error) {
    console.error('加入玩家池失敗:', error)
    throw error
  }
}

async function tryFindHumanOpponent(myId: string, timeout = MATCH_SEARCH_TIMEOUT_MS) {
  const start = Date.now()

  while (Date.now() - start < timeout) {
    if (isMatchCanceled.value) return

    console.log('humman')

    const match = await matchHuman(myId, getRandomQuizSetId())

    if (match) {
      const matchStore = useMatchStore()

      matchStore.setMatchData(match)

      triggerEntryAnimation(`/start-challenge/${match.matchId}`)
      return true
    }

    await sleep(MATCH_SEARCH_POLL_INTERVAL_MS)
  }

  return false
}

async function tryFindPhantomOpponent(myId: string, timeout = MATCH_SEARCH_TIMEOUT_MS) {
  const start = Date.now()

  try {
    while (Date.now() - start < timeout) {
      if (isMatchCanceled.value) return

      console.log('phantom')

      const selectedCandidate = await findPhantomCandidate(myId)

      if (selectedCandidate) {
        const rounds = await findRounds(
          selectedCandidate.match_id,
          selectedCandidate.player_one_id,
        )

        roundStore.setPhantomRoundList(rounds)

        return selectedCandidate
      }

      await sleep(MATCH_SEARCH_POLL_INTERVAL_MS)
    }

    return null
  } catch (error) {
    console.error('[幻影配對失敗]', error)
    throw error
  }
}

async function createMatch(
  myId: string,
  playerTwoId: string,
  opponentType: OpponentType,
  quizSetId: number,
) {
  const matchId = uuidv4()

  try {
    const matchStore = useMatchStore()
    matchStore.setMatchData({
      matchId: matchId,
      playerOneId: myId,
      playerTwoId: playerTwoId,
      opponentType: opponentType,
      quizSetId: quizSetId,
      isComplete: false,
      status: 'matched',
    })

    // 被匹配的真人，也要立即移出
    if (await hasMatchedHuman(myId)) {
      console.warn('[createMatch] 自己已經有一場對戰進行中，跳過建立')
      await removeFromMatchingPool([myId])
      return
    }

    await insertMatch({ matchId, playerOneId: myId, playerTwoId, opponentType, quizSetId })

    await removeFromMatchingPool([myId, playerTwoId])
  } catch (err) {
    console.error('[建立對戰失敗]', err)
    throw err
  }
}

async function handleStart() {
  if (isProcessing.value) return

  if (!userName.value) {
    alert('請輸入 User Name')
    return
  }

  isProcessing.value = true

  const userStore = useUserStore()
  userStore.clearUser()
  userStore.clearOpponent()

  const matchStore = useMatchStore()
  matchStore.clearMatchData()
  matchStore.setIsMatchCanceled(false)

  const quizStore = useQuizStore()
  quizStore.clearQuizList()

  const roundStore = useRoundStore()
  roundStore.restRoundList()
  roundStore.restOpponentRoundList()

  const revengeStore = useRevengeStore()
  revengeStore.clearRevengeInfo()

  if (matchSubscription) {
    supabase.removeChannel(matchSubscription)
    matchSubscription = null
  }

  try {
    const userInfo = await initUser(userName.value)

    console.log('初始化使用者資料:', userInfo)

    const userStore = useUserStore()
    userStore.setMyCurrentId(userInfo.userId)
    globalStore.setIsLoadingModalOpen(true)

    await checkExistingMatch(userInfo.userId)

    // const isExistingMatch = await checkExistingMatch(userInfo.userId)

    // if (isExistingMatch) return

    await subscribeToMatch(userInfo.userId)

    // 加入配對池
    try {
      await enterMatchingPool(userInfo.userId)
    } catch {
      return
    }

    // 嘗試真人配對
    const humanOpponent = await tryFindHumanOpponent(userInfo.userId)
    if (humanOpponent) return

    if (isMatched.value) return

    // 嘗試幻影配對
    const phantomOpponent = await tryFindPhantomOpponent(userInfo.userId)
    if (phantomOpponent) {
      await createMatch(
        userInfo.userId,
        phantomOpponent.player_one_id,
        'phantom',
        phantomOpponent.quiz_set_id,
      )
      return
    }

    // 嘗試 AI 對手
    if (isMatchCanceled.value) return

    console.log('[AI配對] 未找到真人或幻影對手，開始建立 AI 對戰...')
    const aiOpponent = await createAiOpponent()

    if (aiOpponent) {
      await createMatch(userInfo.userId, aiOpponent, 'ai', getRandomQuizSetId())
    }
  } catch (e) {
    console.error('配對流程失敗:', e)
    alert('配對失敗')
  } finally {
    isProcessing.value = false
  }
}

onBeforeUnmount(async () => {
  globalStore.setIsLoadingModalOpen(false)
})

const showTitle = ref(false)
const showStars = ref(false)
const showClouds = ref(false)
const showFromBottom = ref(false)
const showInputArea = ref(false)
const showEntryBanner = ref(false)
const pendingPushUrl = ref<string | null>(null)

function triggerEntryAnimation(url: string) {
  // 1. 先把原本的 Loading 圈圈關掉
  globalStore.setIsLoadingModalOpen(false)

  // 2. 準備跳轉的 URL 並開啟 Banner
  pendingPushUrl.value = url
  showEntryBanner.value = true
}

// 當 Banner 動畫結束後的處理函數
async function handleBannerFinished() {
  console.log('handleBannerFinished 觸發了！')

  if (pendingPushUrl.value) {
    // 1. 先讓 Banner 消失，避免它在跳轉時干擾渲染
    const url = pendingPushUrl.value
    showEntryBanner.value = false
    pendingPushUrl.value = null

    // 2. 等待 DOM 更新後再執行跳轉
    await nextTick()

    console.log('準備執行 safePush 到:', url)
    safePush(url)
  }
}

onMounted(() => {
  showTitle.value = true

  setTimeout(() => {
    showClouds.value = true
  }, LOGIN_CLOUDS_DELAY_MS)

  setTimeout(() => {
    showStars.value = true
  }, LOGIN_STARS_DELAY_MS)

  setTimeout(() => {
    showFromBottom.value = true
  }, LOGIN_FORM_DELAY_MS)

  setTimeout(() => {
    showInputArea.value = true
  }, LOGIN_INPUT_DELAY_MS)
})
</script>

<template>
  <div class="login-view">
    <transition name="about-drop">
      <img
        v-if="showClouds"
        src="@/assets/images/login/aboutButton.png"
        class="about"
        alt="About"
      />
    </transition>

    <transition name="cloud-left">
      <img
        v-if="showClouds"
        src="@/assets/images/login/cloudLeftFront.png"
        class="cloud-front cloud-left-front"
        alt=""
      />
    </transition>

    <transition name="cloud-left">
      <img
        v-if="showClouds"
        src="@/assets/images/login/cloudLeftBack.png"
        class="cloud-back cloud-left-back"
        alt=""
      />
    </transition>

    <transition name="cloud-right">
      <img
        v-if="showClouds"
        src="@/assets/images/login/cloudRightBack.png"
        class="cloud-back cloud-right-back"
        alt=""
      />
    </transition>

    <transition name="cloud-right">
      <img
        v-if="showClouds"
        src="@/assets/images/login/cloudRightFront.png"
        class="cloud-front cloud-right-front"
        alt=""
      />
    </transition>

    <transition name="star-grow">
      <img
        v-if="showStars"
        src="@/assets/images/login/starLeft.png"
        class="star star-left"
        alt=""
      />
    </transition>

    <transition name="star-grow">
      <img
        v-if="showStars"
        src="@/assets/images/login/starRight.png"
        class="star star-right"
        alt=""
      />
    </transition>

    <p class="version quantico-regular-18">{{ currentVersion }}</p>

    <div class="title-input">
      <transition name="title-grow">
        <img
          v-if="showTitle"
          src="@/assets/images/login/title.png"
          class="title"
          alt="Lightning Championship"
        />
      </transition>

      <div class="input-button" :class="{ 'input-visible': showInputArea }">
        <InputComponent v-model="userName" :isDisabled="false" width="400px" padding="10px 20px" />

        <ButtonComponent
          color-theme="mustard"
          class="quantico-regular-22"
          :disabled="false"
          @click="handleStart"
        >
          START
        </ButtonComponent>
      </div>
    </div>

    <transition name="animation-rise">
      <img
        v-if="showFromBottom"
        src="@/assets/images/login/startFrom.png"
        class="start-from"
        alt=""
      />
    </transition>

    <transition name="animation-rise">
      <img
        v-if="showFromBottom"
        src="@/assets/images/login/labelOne.png"
        class="label label-one"
        alt=""
      />
    </transition>

    <transition name="animation-rise">
      <img
        v-if="showFromBottom"
        src="@/assets/images/login/labelTwo.png"
        class="label label-two"
        alt=""
      />
    </transition>

    <transition name="animation-rise">
      <img
        v-if="showFromBottom"
        src="@/assets/images/login/labelThree.png"
        class="label label-three"
        alt=""
      />
    </transition>

    <LoadingModal />
    <PlayAgainModal />
    <EntryBanner v-if="showEntryBanner" @finished="handleBannerFinished" />
  </div>
</template>

<style scoped lang="scss">
.login-view {
  position: relative;
  width: 100%;
  height: 100%;

  background-image: url('@/assets/images/login/loginBackground.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.about {
  position: absolute;
  width: 156px;
  top: 0;
  right: 108px;
  cursor: pointer;
  z-index: 2;
}

.about-drop-enter-from {
  transform: translateY(-40px) scale(0.85);
}

.about-drop-enter-to {
  transform: translateY(0) scale(1);
}

.about-drop-enter-active {
  transition: transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1.2);
}

.star {
  position: absolute;
  z-index: 3;
}

.star-left {
  width: 96px;
  top: 385px;
  left: 40px;
}

.star-right {
  width: 74px;
  top: 160px;
  right: 88px;
}

.star-grow-enter-from {
  transform: scale(0);
}

.star-grow-enter-to {
  transform: scale(1);
}

.star-grow-enter-active {
  transition: transform 1s cubic-bezier(0.34, 1.56, 0.64, 1.2);
}

.start-from {
  position: absolute;
  z-index: 4;
  width: 200px;
  bottom: 88px;
  left: 64px;
}

.animation-rise-enter-from {
  transform: translateY(80px) scale(0.9);
}

.animation-rise-enter-to {
  transform: translateY(0) scale(1);
}

.animation-rise-enter-active {
  transition: transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1.2);
}

.cloud-front {
  position: absolute;
  z-index: 2;
}

.cloud-back {
  position: absolute;
  z-index: 1;
}

.cloud-left-front {
  width: 400px;
  bottom: -100px;
  left: -230px;
}

.cloud-left-back {
  width: 400px;
  bottom: -100px;
  left: 0px;
}

.cloud-left-enter-from {
  transform: translate(-40px, 30px) scale(0.85);
}

.cloud-left-enter-to {
  transform: translate(0, 0) scale(1);
}

.cloud-left-enter-active {
  transition: transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1.2);
}

.cloud-right-back {
  width: 400px;
  bottom: -100px;
  right: 0px;
}

.cloud-right-front {
  width: 400px;
  bottom: -100px;
  right: -230px;
}

.cloud-right-enter-from {
  transform: translate(40px, 30px) scale(0.85);
}

.cloud-right-enter-to {
  transform: translate(0, 0) scale(1);
}

.cloud-right-enter-active {
  transition: transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1.2);
}

.label {
  position: absolute;
  z-index: 3;
}

.label-one {
  width: 136px;
  bottom: 176px;
  right: 44px;
}

.label-two {
  width: 92px;
  bottom: 129px;
  right: 76px;
}

.label-three {
  width: 65px;
  bottom: 84px;
  right: 45px;
}

.version {
  position: absolute;
  z-index: 3;

  color: var(--color-neutral-50);
  text-align: center;
  width: 100%;
  bottom: 22px;
}

.title-input {
  position: absolute;
  z-index: 5;

  width: 100%;
  height: 100%;

  margin-top: -50px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 56px;
}

.title {
  height: 220px;
}

.title-grow-enter-from {
  transform: scale(0);
}

.title-grow-enter-to {
  transform: scale(1);
}

.title-grow-enter-active {
  transition: transform 1s cubic-bezier(0.34, 1.56, 0.64, 1.2);
}

.input-button {
  display: flex;
  gap: 6px;

  opacity: 0;
  transform: translateY(10px);
  transition:
    opacity 1.2s ease-out,
    transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1.2);
}

.input-visible {
  opacity: 1;
  transform: translateY(0);
}
</style>
`
