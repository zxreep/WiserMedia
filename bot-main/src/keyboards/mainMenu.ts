import { InlineKeyboard } from 'grammy';

export function mainMenuKeyboard(role: string) {
  const keyboard = new InlineKeyboard().text('📊 My Progress', 'my_progress').text('🏆 Leaderboard', 'show_leaderboard');

  if (role.toLowerCase() === 'admin') {
    keyboard.row().text('🛠️ View All Quizzes', 'admin_view_quizzes');
    keyboard.row().text('🧾 Task Panel', 'admin_task_panel');
  }

  return keyboard;
}

export function emptyQuizKeyboard() {
  return new InlineKeyboard().text('🔄 Refresh', 'refresh_quizzes').text('🏆 Leaderboard', 'show_leaderboard');
}
