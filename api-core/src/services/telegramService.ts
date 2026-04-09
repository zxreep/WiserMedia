import type { QuizQuestion } from '../types/pdfQuiz.js';

export async function sendQuizPolls(botToken: string, chatId: string, questions: QuizQuestion[]) {
  for (const [index, question] of questions.entries()) {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendPoll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        question: `${index + 1}. ${question.question}`.slice(0, 300),
        options: question.options,
        type: 'quiz',
        is_anonymous: false,
        correct_option_id: question.correct_option_id,
        explanation: question.explanation.slice(0, 200)
      })
    });

    const data = (await resp.json()) as { ok: boolean; description?: string };
    if (!resp.ok || !data.ok) {
      throw new Error(data.description ?? 'telegram api failure');
    }
  }
}
