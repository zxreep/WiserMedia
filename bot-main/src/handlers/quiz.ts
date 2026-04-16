import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { authUser, getQuizzes, logQuizShare, startQuiz, submitWebAppQuiz } from '../api-client.js';
import { getBotUsername, getSession, notifyAdmins, setSession } from '../bot.js';
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

function buildBotDeepLink(startPayload: string): string {
  return `https://t.me/${getBotUsername()}?start=${encodeURIComponent(startPayload)}`;
}

function buildInlineResultId(quizId: number, sharedByTelegramId: number): string {
  return `sharequiz:${quizId}:${sharedByTelegramId}:${Date.now()}`;
}

function parseInlineResultId(resultId: string): { quizId: number; sharedByTelegramId: number } | null {
  const match = /^sharequiz:(\d+):(\d+):\d+$/.exec(resultId);
  if (!match) return null;
  return {
    quizId: Number(match[1]),
    sharedByTelegramId: Number(match[2])
  };
}

function buildQuizIntroMessage(quiz: { title: string; description: string; duration_minutes: number; question_count: number }, webAppUrl: string): string {
  return [
    `🧠 ${quiz.title}`,
    '',
    `${quiz.description || 'Test your preparation with this quiz.'}`,
    '',
    `• Questions: ${quiz.question_count}`,
    `• Duration: ${quiz.duration_minutes} mins`,
    '',
    `🔗 Start quiz in WebApp: ${webAppUrl}`
  ].join('\n');
}

function buildShareCardText(quiz: { title: string; question_count: number }): string {
  return [`📢 <b>New Quiz Challenge</b>`, '', `🧠 ${quiz.title}`, `❓ Questions: ${quiz.question_count}`].join('\n');
}

async function ensureSession(botUser: { id: number; username?: string; first_name?: string }) {
  const existing = getSession(botUser.id);
  if (existing) {
    return existing;
  }

  const profile = await authUser({
    telegram_id: String(botUser.id),
    username: botUser.username,
    first_name: botUser.first_name
  });

  const created = { user_id: profile.user_id, name: profile.name, role: profile.role };
  setSession(botUser.id, created);
  return created;
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

      await notifyAdmins(
        `🛠️ Admin panel opened\nAdmin: ${from.id}\nAvailable quiz IDs: ${quizzes
          .map((quiz) => `${String(quiz.id)}(${typeof quiz.id})`)
          .join(', ')}`
      );

      const keyboard = new InlineKeyboard();
      quizzes.forEach((quiz, index) => {
        keyboard.text(`📝 ${quiz.title}`, `open_quiz_${quiz.id}`);
        if (index !== quizzes.length - 1) keyboard.row();
      });

      await ctx.reply('🛠️ Admin Quiz Panel\n\nSelect a quiz to preview and share:', {
        reply_markup: keyboard
      });
    } catch (error) {
      console.error('admin_view_quizzes error:', error);
      await notifyAdmins(`🚨 admin_view_quizzes failed\nUser: ${ctx.from?.id ?? 'unknown'}\nError: ${String(error)}`);
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

      await notifyAdmins(
        `🧪 Admin selected quiz\nAdmin: ${from.id}\nCallback quizId: ${ctx.match[1]}\nParsed quizId: ${quizId}\nMatched: ${selectedQuiz ? 'yes' : 'no'}\nFetched IDs: ${quizzes
          .map((quiz) => `${String(quiz.id)}(${typeof quiz.id})`)
          .join(', ')}`
      );

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
      const shareQuery = `share_quiz_${quizId}`;

      await ctx.reply(message, {
        reply_markup: adminQuizActionsKeyboard(webAppUrl, shareQuery)
      });
    } catch (error) {
      console.error('open_quiz error:', error);
      await notifyAdmins(`🚨 open_quiz failed\nUser: ${ctx.from?.id ?? 'unknown'}\nError: ${String(error)}`);
      await ctx.reply('⚠️ Something went wrong. Please try again.');
    }
  });

  bot.inlineQuery(/^share_quiz_(\d+)$/, async (ctx) => {
    try {
      const session = await ensureSession(ctx.from);
      if (!isAdmin(session.role)) {
        await ctx.answerInlineQuery([], { cache_time: 0, is_personal: true });
        return;
      }

      const quizId = Number(ctx.match[1]);
      const quizzes = await getQuizzes();
      const quiz = quizzes.find((item) => Number(item.id) === quizId);
      if (!quiz) {
        await ctx.answerInlineQuery([], { cache_time: 0, is_personal: true });
        return;
      }

      const startQuizLink = buildBotDeepLink(`quiz_${quizId}`);
      const leaderboardLink = buildBotDeepLink('leaderboard');
      const resultId = buildInlineResultId(quizId, ctx.from.id);

      await ctx.answerInlineQuery(
        [
          {
            type: 'article',
            id: resultId,
            title: `📢 Share quiz: ${quiz.title}`,
            description: `${quiz.question_count} questions`,
            input_message_content: {
              message_text: buildShareCardText({ title: quiz.title, question_count: quiz.question_count }),
              parse_mode: 'HTML'
            },
            reply_markup: new InlineKeyboard().url('Start Quiz 🚀', startQuizLink).url('🏆 Leaderboard', leaderboardLink)
          }
        ],
        { cache_time: 0, is_personal: true }
      );
    } catch (error) {
      console.error('inline share_quiz error:', error);
      await notifyAdmins(`🚨 inline share_quiz failed\nUser: ${ctx.from?.id ?? 'unknown'}\nError: ${String(error)}`);
      await ctx.answerInlineQuery([], { cache_time: 0, is_personal: true });
    }
  });

  bot.on('chosen_inline_result', async (ctx) => {
    try {
      const session = await ensureSession(ctx.from);
      if (!isAdmin(session.role)) {
        return;
      }

      const parsed = parseInlineResultId(ctx.chosenInlineResult.result_id);
      if (!parsed) {
        return;
      }

      await logQuizShare({
        quiz_id: parsed.quizId,
        shared_by_user_id: session.user_id,
        shared_by_telegram_id: String(ctx.from.id),
        inline_message_id: ctx.chosenInlineResult.inline_message_id,
        result_id: ctx.chosenInlineResult.result_id
      });

      await notifyAdmins(
        `✅ Quiz shared\nAdmin: ${ctx.from.id}\nQuiz: ${parsed.quizId}\nInline message: ${ctx.chosenInlineResult.inline_message_id ?? 'n/a'}`
      );
    } catch (error) {
      console.error('chosen_inline_result error:', error);
      await notifyAdmins(`🚨 chosen_inline_result failed\nUser: ${ctx.from?.id ?? 'unknown'}\nError: ${String(error)}`);
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
    } catch (error) {
      console.error('message:web_app_data error:', error);
      await notifyAdmins(`🚨 web_app_data failed\nUser: ${ctx.from?.id ?? 'unknown'}\nError: ${String(error)}`);
      await ctx.reply('⚠️ Something went wrong while submitting your quiz.');
    }
  });
}
