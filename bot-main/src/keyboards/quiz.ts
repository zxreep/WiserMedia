import { InlineKeyboard } from 'grammy';

export function quizSelectKeyboard(quizId: number, title: string) {
  return new InlineKeyboard().text(`📝 ${title}`, `open_quiz_${quizId}`);
}

export function answerKeyboard(questionId: number) {
  return new InlineKeyboard()
    .text('A', `answer_${questionId}_0`)
    .text('B', `answer_${questionId}_1`)
    .row()
    .text('C', `answer_${questionId}_2`)
    .text('D', `answer_${questionId}_3`);
}
