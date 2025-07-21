import { supabase } from '@/lib/supabaseClient'
import { v4 as uuidv4 } from 'uuid'

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function createNewRound({
  matchId,
  userId,
  quizSetId,
  currentRoundLength,
  updateRoundList,
  navigateTo,
}: CreateNewRoundParams) {
  try {
    const roundNumber = currentRoundLength + 1
    const roundId = uuidv4()
    const createdAt = new Date().toISOString()

    const newRound = {
      round_id: roundId,
      match_id: matchId,
      user_id: userId,
      quiz_set_id: quizSetId,
      round: roundNumber,
      input: '',
      score: 0,
      time_taken_ms: 0,
      submitted_at: null,
      created_at: createdAt,
    }

    const { error } = await supabase.from('rounds').insert([newRound])
    if (error) throw new Error(`[createNewRound] 新增 round 失敗：${error.message}`)

    updateRoundList({
      roundId,
      round: roundNumber,
      input: '',
      score: 0,
      timeTakenMs: 0,
      submittedAt: null,
      createdAt,
    })

    console.log(`[createNewRound] 已建立第 ${roundNumber} 回合，準備跳轉 /game`)

    await sleep(3000)
    navigateTo()
  } catch (err) {
    console.error('[createNewRound] 發生錯誤:', err)
    throw err
  }
}
