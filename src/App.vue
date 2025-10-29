<script setup lang="ts">
import BackToLoginModal from '@/components/common/BackToLoginModal.vue'
import { supabase } from '@/lib/supabaseClient'
import { useGlobalStore } from '@/stores/global'
import { useUserStore } from './stores/user'
import { safeReplace } from './utils/usePageGuard'

const globalStore = useGlobalStore()
const userStore = useUserStore()

// onMounted(() => {
//   if (!userStore.userInfo.userId) {
//     safeReplace(`/`)
//   }
// })

function keepPlaying() {
  globalStore.setIsBackToLoginModalOpen(false)
}

async function abandonAndExit() {
  const { data: existingMatch, error: selectMatchError } = await supabase
    .from('matches')
    .select('*')
    .or(
      `player_one_id.eq.${userStore.userInfo.userId},player_two_id.eq.${userStore.userInfo.userId}`,
    )
    .eq('status', 'in_progress')
    .maybeSingle()

  if (selectMatchError) {
    throw new Error('[selectMatchError] 搜尋match資料失敗：' + selectMatchError.message)
  }

  if (existingMatch) {
    const isPlayerOne = existingMatch.player_one_id === userStore.userInfo.userId

    const { error: updateMatchesTableError } = await supabase
      .from('matches')
      .update({
        is_player_one_complete: !isPlayerOne,
        is_player_two_complete: isPlayerOne,
        status: 'abandoned',
      })
      .eq('match_id', existingMatch.match_id)

    if (updateMatchesTableError) {
      throw new Error(
        '[updateMatchesTableError] 更新資料庫失敗：' + updateMatchesTableError.message,
      )
    }
  }

  globalStore.setIsBackToLoginModalOpen(false)
  userStore.clearUser()
  safeReplace('/')
}
</script>

<template>
  <RouterView />
  <BackToLoginModal @keepPlaying="keepPlaying" @quit="abandonAndExit" />
</template>
