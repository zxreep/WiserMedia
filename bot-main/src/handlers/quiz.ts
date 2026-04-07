import type { Bot, Context } from 'grammy';
import { getQuizzes, startQuiz, submitQuiz } from '../api-client.js';
import { getSession, setSession, clearQuizState } from '../bot.js';
import { emptyQuizKeyboard } from '../keyboards/mainMenu.js';
import { answerKeyboard, quizSelectKeyboard } from '../keyboards/quiz.js';

function renderQuestion(
  index: number,
  question: { id: number; question: string; options: string[] }
): { text: string; questionId: number } {
  const lines = [
    `Q${index + 1}: ${question.question}`,
    '',
    `A. ${question.options[0] ?? ''}`,
    `B. ${question.options[1] ?? ''}`,
    `C. ${question.options[2] ?? ''}`,
    `D. ${question.options[3] ?? ''}`
  ];

  return { text: lines.join('\n'), questionId: question.id };
}

async function showCurrentQuestion(ctx: Context, telegramId: number) {
  const session = getSession(telegramId);
  if (!session?.quiz_state) {
    await ctx.reply('⚠️ Something went wrong. Please try again.');
    return;
  }

  const state = session.quiz_state;
  const question = state.questions[state.current_question_index];
  if (!question) {
    await ctx.reply('⚠️ Something went wrong. Please try again.');
    return;
  }

  const rendered = renderQuestion(state.current_question_index, question);
  await ctx.reply(rendered.text, {
    reply_markup: answerKeyboard(rendered.questionId)
  });
}

export function registerQuizHandlers(bot: Bot) {
  bot.callbackQuery(['start_quiz', 'refresh_quizzes'], async (ctx) => {
    try {
      await ctx.answerCallbackQuery();

      const quizzes = await getQuizzes();
      if (quizzes.length === 0) {
        await ctx.reply('😅 No quizzes available right now', {
          reply_markup: emptyQuizKeyboard()
        });
        return;
      }

      const first = quizzes[0];
      await ctx.reply(`🎯 Available Quiz\n\n${first.title}\n${first.description ?? ''}`, {
        reply_markup: quizSelectKeyboard(first.id, first.title)
      });
    } catch {
      await ctx.reply('⚠️ Something went wrong. Please try again.');
    }
  });

  bot.callbackQuery(/^open_quiz_(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const from = ctx.from;
      if (!from) return;

      const session = getSession(from.id);
      if (!session) {
        await ctx.reply('Please use /start first.');
        return;
      }

      const quizId = Number(ctx.match[1]);
      const started = await startQuiz(quizId, session.user_id);

      setSession(from.id, {
        ...session,
        quiz_state: {
          quiz_id: quizId,
          attempt_id: started.attempt_id,
          questions: started.questions,
          current_question_index: 0,
          answers: []
        }
      });

      await showCurrentQuestion(ctx, from.id);
    } catch {
      await ctx.reply('⚠️ Something went wrong. Please try again.');
    }
  });

  bot.callbackQuery(/^answer_(\d+)_(\d)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const from = ctx.from;
      if (!from) return;

      const session = getSession(from.id);
      if (!session?.quiz_state) {
        await ctx.reply('Please start a quiz first.');
        return;
      }

      const questionId = Number(ctx.match[1]);
      const selectedOption = Number(ctx.match[2]);
      const state = session.quiz_state;

      const already = state.answers.some((a) => a.question_id === questionId);
      if (!already) {
        state.answers.push({ question_id: questionId, selected_option: selectedOption });
      }

      state.current_question_index += 1;

      if (state.current_question_index < state.questions.length) {
        setSession(from.id, { ...session, quiz_state: state });
        await showCurrentQuestion(ctx, from.id);
        return;
      }

      const result = await submitQuiz(state.quiz_id, {
        attempt_id: state.attempt_id,
        answers: state.answers
      });

      clearQuizState(from.id);

      await ctx.reply(
        `✅ Quiz Submitted!\n\nScore: ${result.score}\nCorrect: ${result.correct}/${result.total}\nXP Earned: +${result.xp_earned}`
      );
    } catch {
      await ctx.reply('⚠️ Something went wrong. Please try again.');
    }
  });
}
