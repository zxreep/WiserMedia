import { InlineKeyboard } from 'grammy';

export function quizSelectKeyboard(quizId: number, title: string) {
  return new InlineKeyboard().text(`📝 ${title}`, `open_quiz_${quizId}`);
}

export function quizLaunchKeyboard(webAppUrl: string) {
  return new InlineKeyboard().webApp('Start Quiz 🚀', webAppUrl);
}
