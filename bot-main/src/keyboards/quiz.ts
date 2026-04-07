import { InlineKeyboard } from 'grammy';

export function quizSelectKeyboard(quizId: number, title: string, webAppUrl: string) {
  return new InlineKeyboard().url(`📝 ${title} (#${quizId})`, webAppUrl);
}
