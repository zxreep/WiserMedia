import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { getQuizzes, startQuiz, submitWebAppQuiz } from '../api-client.js';
import { getSession } from '../bot.js';
import { config } from '../config.js';
import { emptyQuizKeyboard } from '../keyboards/mainMenu.js';
import { quizLaunchKeyboard } from '../keyboards/quiz.js';

function buildQuizWebAppUrl(baseUrl: string, payload: { attemptId: number; quizId: number; userId: number; telegramId: number }): string {
  const url = new URL(baseUrl);
  url.searchParams.set('attempt_id', String(payload.attemptId));
  url.searchParams.set('quizId', String(payload.quizId));
  url.searchParams.set('userId', String(payload.userId));
  url.searchParams.set('telegramId', String(payload.telegramId));
  url.searchParams.set('api_base', config.apiBaseUrl);
  return url.toString();
}

const hostedQuizBaseUrl = `${config.publicBaseUrl}/quiz`;

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

      const from = ctx.from;
      if (!from) return;

      const session = getSession(from.id);
      if (!session) {
        await ctx.reply('Please use /start first.');
        return;
      }

      const keyboard = new InlineKeyboard();
      quizzes.forEach((quiz, index) => {
        keyboard.text(`📝 ${quiz.title}`, `open_quiz_${quiz.id}`);
        if (index !== quizzes.length - 1) keyboard.row();
      });

      await ctx.reply('🌐 Launch your quiz in web mode.\n\nChoose a quiz below:', {
        reply_markup: keyboard
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
      const webAppUrl = buildQuizWebAppUrl(hostedQuizBaseUrl, {
        attemptId: started.attempt_id,
        quizId,
        userId: session.user_id,
        telegramId: from.id
      });

      await ctx.reply('🚀 Your quiz attempt is ready. Open it inside Telegram:', {
        reply_markup: quizLaunchKeyboard(webAppUrl)
      });
    } catch {
      await ctx.reply('⚠️ Something went wrong. Please try again.');
    }
  });

  bot.on('message:web_app_data', async (ctx) => {
    try {
      const raw = ctx.message.web_app_data?.data;
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        attempt_id?: number;
        answers?: Array<{ question_id: number; selected_option: number }>;
      };

      if (!parsed.attempt_id || !Array.isArray(parsed.answers)) {
        await ctx.reply('⚠️ Invalid quiz submission payload.');
        return;
      }

      const result = await submitWebAppQuiz({
        attempt_id: parsed.attempt_id,
        answers: parsed.answers
      });

      await ctx.reply(
        `✅ Quiz Submitted!\n\nScore: ${result.score}\nCorrect: ${result.correct}/${result.total}\nXP Earned: +${result.xp_earned}`
      );
    } catch {
      await ctx.reply('⚠️ Something went wrong while submitting your quiz.');
    }
  });
}
