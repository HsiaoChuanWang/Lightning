import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface UserInfo {
  userId: string
  userName: string
  avatarUrl: string
  winCount: number
  loseCount: number
  totalMatches: number
}

export interface OpponentInfo {
  opponentId: string
  opponentName: string
  opponentAvatarUrl: string
  winCount: number
  loseCount: number
  totalMatches: number
}

export const useUserStore = defineStore('user', () => {
  const user = ref<UserInfo>({
    userId: '',
    userName: '',
    avatarUrl: '',
    winCount: 0,
    loseCount: 0,
    totalMatches: 0,
  })

  const opponent = ref<OpponentInfo>({
    opponentId: '',
    opponentName: '',
    opponentAvatarUrl: '',
    winCount: 0,
    loseCount: 0,
    totalMatches: 0,
  })

  function setUserInfo(data: UserInfo) {
    user.value = { ...data }
  }

  function clearUser() {
    user.value = {
      userId: '',
      userName: '',
      avatarUrl: '',
      winCount: 0,
      loseCount: 0,
      totalMatches: 0,
    }
  }

  function setOpponentInfo(data: OpponentInfo) {
    opponent.value = { ...data }
  }

  function clearOpponent() {
    opponent.value = {
      opponentId: '',
      opponentName: '',
      opponentAvatarUrl: '',
      winCount: 0,
      loseCount: 0,
      totalMatches: 0,
    }
  }

  return {
    user,
    opponent,
    setUserInfo,
    clearUser,
    setOpponentInfo,
    clearOpponent,
  }
})
