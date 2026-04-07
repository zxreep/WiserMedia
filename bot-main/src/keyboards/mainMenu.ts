import { InlineKeyboard } from 'grammy';

export function mainMenuKeyboard() {
  return new InlineKeyboard()
    .text('🎯 Start Quiz', 'start_quiz')
    .text('📊 My Progress', 'my_progress')
    .row()
    .text('🏆 Leaderboard', 'show_leaderboard')
    .text('🤝 Find Mentor', 'find_mentor');
}

export function emptyQuizKeyboard() {
  return new InlineKeyboard().text('🔄 Refresh', 'refresh_quizzes').text('🏆 Leaderboard', 'show_leaderboard');
}
