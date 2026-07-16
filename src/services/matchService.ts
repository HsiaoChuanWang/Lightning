import { supabase } from '@/lib/supabaseClient'
import type { OpponentType } from '@/stores/match'
import type { MatchRecord } from '@/types/database'

interface CreateMatchParams {
  matchId: string
  playerOneId: string
  playerTwoId: string
  opponentType: OpponentType
  quizSetId: number
}

export async function findMatchedMatch(userId: string): Promise<MatchRecord | null> {
  const { data, error } = await supabase
    .from('matches')
    .select('match_id, player_one_id, player_two_id, opponent_type, quiz_set_id')
    .or(`player_one_id.eq.${userId},player_two_id.eq.${userId}`)
    .eq('status', 'matched')
    .maybeSingle()

  if (error) throw error
  return data
}

export async function insertMatch({
  matchId,
  playerOneId,
  playerTwoId,
  opponentType,
  quizSetId,
}: CreateMatchParams): Promise<void> {
  const { error } = await supabase.from('matches').insert([
    {
      match_id: matchId,
      player_one_id: playerOneId,
      player_two_id: playerTwoId,
      opponent_type: opponentType,
      quiz_set_id: quizSetId,
      is_player_one_complete: false,
      is_player_two_complete: false,
      status: 'matched',
      created_at: new Date().toISOString(),
    },
  ])

  if (error) {
    throw new Error(`[建立對戰] 寫入 matches 失敗：${error.message}`)
  }
}
