import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  const userId = ref('')
  const userName = ref('')
  const avatarUrl = ref('')
  const opponentId = ref('')
  const opponentName = ref('')
  const opponentAvatarUrl = ref('')

  function setUser(payload: { userId: string; userName: string; avatarUrl: string }) {
    userId.value = payload.userId
    userName.value = payload.userName
    avatarUrl.value = payload.avatarUrl
  }

  function clearUser() {
    userId.value = ''
    userName.value = ''
    avatarUrl.value = ''
  }

  function setOpponent(payload: {
    opponentId: string
    opponentName: string
    opponentAvatarUrl: string
  }) {
    opponentId.value = payload.opponentId
    opponentName.value = payload.opponentName
    opponentAvatarUrl.value = payload.opponentAvatarUrl
  }

  function clearOpponent() {
    opponentId.value = ''
    opponentName.value = ''
    opponentAvatarUrl.value = ''
  }

  return {
    userId,
    userName,
    avatarUrl,
    setUser,
    clearUser,
    opponentId,
    opponentName,
    opponentAvatarUrl,
    setOpponent,
    clearOpponent,
  }
})
