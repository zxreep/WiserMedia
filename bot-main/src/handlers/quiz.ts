import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { getQuizzes } from '../api-client.js';
import { getSession } from '../bot.js';
import { config } from '../config.js';
import { emptyQuizKeyboard } from '../keyboards/mainMenu.js';
import { quizSelectKeyboard } from '../keyboards/quiz.js';

function buildQuizWebAppUrl(baseUrl: string, payload: { quizId: number; userId: number; telegramId: number }): string {
  const url = new URL(baseUrl);
  url.searchParams.set('quizId', String(payload.quizId));
  url.searchParams.set('userId', String(payload.userId));
  url.searchParams.set('telegramId', String(payload.telegramId));
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
        const webAppUrl = buildQuizWebAppUrl(hostedQuizBaseUrl, {
          quizId: quiz.id,
          userId: session.user_id,
          telegramId: from.id
        });
        keyboard.url(`📝 ${quiz.title}`, webAppUrl);
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
    await ctx.answerCallbackQuery();
    const from = ctx.from;
    if (!from) return;
    const session = getSession(from.id);
    if (!session) {
      await ctx.reply('Please use /start first.');
      return;
    }

    const quizId = Number(ctx.match[1]);
    const webAppUrl = buildQuizWebAppUrl(hostedQuizBaseUrl, {
      quizId,
      userId: session.user_id,
      telegramId: from.id
    });

    await ctx.reply('🌐 This quiz now runs on the web app. Open it below:', {
      reply_markup: quizSelectKeyboard(quizId, 'Open Quiz', webAppUrl)
    });
  });
}
