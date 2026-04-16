import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { getQuizzes, startQuiz, submitWebAppQuiz } from '../api-client.js';
import { getSession } from '../bot.js';
import { config } from '../config.js';
import { emptyQuizKeyboard } from '../keyboards/mainMenu.js';
import { adminQuizActionsKeyboard } from '../keyboards/quiz.js';

function buildQuizWebAppUrl(baseUrl: string, payload: { attemptId: number; quizId: number; userId: number; telegramId: number }): string {
  const url = new URL(baseUrl);
  url.searchParams.set('attempt_id', String(payload.attemptId));
  url.searchParams.set('quizId', String(payload.quizId));
  url.searchParams.set('userId', String(payload.userId));
  url.searchParams.set('telegramId', String(payload.telegramId));
  return url.toString();
}

const hostedQuizBaseUrl = `${config.publicBaseUrl}/quiz`;

function isAdmin(role: string): boolean {
  return role.toLowerCase() === 'admin';
}

function buildShareUrl(message: string, webAppUrl: string): string {
  const url = new URL('https://t.me/share/url');
  url.searchParams.set('url', webAppUrl);
  url.searchParams.set('text', message);
  return url.toString();
}

function buildQuizIntroMessage(quiz: { title: string; description: string; duration_minutes: number; question_count: number }, webAppUrl: string): string {
  return [
    `🧠 *${quiz.title}*`,
    '',
    `${quiz.description || 'Test your preparation with this quiz.'}`,
    '',
    `• Questions: *${quiz.question_count}*`,
    `• Duration: *${quiz.duration_minutes} mins*`,
    '',
    `🔗 Start quiz in WebApp: ${webAppUrl}`
  ].join('\n');
}

export function registerQuizHandlers(bot: Bot) {
  bot.callbackQuery(['admin_view_quizzes', 'refresh_quizzes'], async (ctx) => {
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

      if (!isAdmin(session.role)) {
        await ctx.reply('⛔ This section is only for admins.');
        return;
      }

      const keyboard = new InlineKeyboard();
      quizzes.forEach((quiz, index) => {
        keyboard.text(`📝 ${quiz.title}`, `open_quiz_${quiz.id}`);
        if (index !== quizzes.length - 1) keyboard.row();
      });

      await ctx.reply('🛠️ Admin Quiz Panel\n\nSelect a quiz to preview and share:', {
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

      if (!isAdmin(session.role)) {
        await ctx.reply('⛔ Only admins can view and share all quizzes.');
        return;
      }

      const quizId = Number(ctx.match[1]);
      const quizzes = await getQuizzes();
      const selectedQuiz = quizzes.find((quiz) => Number(quiz.id) === quizId);

      const started = await startQuiz(quizId, session.user_id);
      const webAppUrl = buildQuizWebAppUrl(hostedQuizBaseUrl, {
        attemptId: started.attempt_id,
        quizId,
        userId: session.user_id,
        telegramId: from.id
      });

      const message = buildQuizIntroMessage(
        selectedQuiz ?? {
          title: `Quiz #${quizId}`,
          description: 'Test your preparation with this quiz.',
          duration_minutes: Math.ceil(started.questions.length),
          question_count: started.questions.length
        },
        webAppUrl
      );
      const shareUrl = buildShareUrl(
        `${selectedQuiz?.title ?? `Quiz #${quizId}`}\n\n${selectedQuiz?.description || 'Test your preparation with this quiz.'}`,
        webAppUrl
      );

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: adminQuizActionsKeyboard(webAppUrl, shareUrl)
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
        result?: {
          score: number;
          correct: number;
          total: number;
          xp_earned: number;
          wrong_questions?: Array<{ question: string; selected_text: string; correct_text: string }>;
        };
      };

      if (parsed.result) {
        const result = parsed.result;
        const wrongLines = (result.wrong_questions ?? [])
          .map((w, idx) => `${idx + 1}. ${w.question}\n   Your: ${w.selected_text}\n   Correct: ${w.correct_text}`)
          .join('\n\n');
        await ctx.reply(
          `✅ Quiz Submitted!\n\nScore: ${result.score}\nCorrect: ${result.correct}/${result.total}\nXP Earned: +${result.xp_earned}${
            wrongLines ? `\n\n❌ Wrongly attempted:\n${wrongLines}` : ''
          }`
        );
        return;
      }

      if (!parsed.attempt_id || !Array.isArray(parsed.answers)) {
        await ctx.reply('⚠️ Invalid quiz submission payload.');
        return;
      }

      const result = await submitWebAppQuiz({
        attempt_id: parsed.attempt_id,
        answers: parsed.answers
      });
      const wrongLines = (result.wrong_questions ?? [])
        .map((w, idx) => `${idx + 1}. ${w.question}\n   Your: ${w.selected_text}\n   Correct: ${w.correct_text}`)
        .join('\n\n');

      await ctx.reply(
        `✅ Quiz Submitted!\n\nScore: ${result.score}\nCorrect: ${result.correct}/${result.total}\nXP Earned: +${result.xp_earned}${
          wrongLines ? `\n\n❌ Wrongly attempted:\n${wrongLines}` : ''
        }`
      );
    } catch {
      await ctx.reply('⚠️ Something went wrong while submitting your quiz.');
    }
  });
}
