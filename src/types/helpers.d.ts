interface CreateNewRoundParams {
  matchId: string
  userId: string
  quizSetId: number
  currentRoundLength: number
  updateRoundList: (data: Round) => void
  navigateTo: () => void
}
