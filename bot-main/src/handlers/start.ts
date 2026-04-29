import type { Bot, Context } from 'grammy';
import { authUser, getAdminTasks, getLeaderboard, getQuizzes, startQuiz } from '../api-client.js';
import { getSession, notifyAdmins, setSession } from '../bot.js';
import { config } from '../config.js';
import { mainMenuKeyboard } from '../keyboards/mainMenu.js';
import { quizLaunchKeyboard } from '../keyboards/quiz.js';

function buildQuizWebAppUrl(baseUrl: string, payload: { attemptId: number; quizId: number; userId: number; telegramId: number }): string {
  const url = new URL(baseUrl);
  url.searchParams.set('attempt_id', String(payload.attemptId));
  url.searchParams.set('quizId', String(payload.quizId));
  url.searchParams.set('userId', String(payload.userId));
  url.searchParams.set('telegramId', String(payload.telegramId));
  return url.toString();
}

const hostedQuizBaseUrl = `${config.publicBaseUrl}/quiz`;

async function handleDeepLink(ctx: Context, payload: string, profile: { user_id: number }) {
  if (payload === 'leaderboard') {
    const leaderboard = await getLeaderboard();
    const lines = ['🏆 Top Students', ''];
    leaderboard.users.slice(0, 10).forEach((u, idx) => {
      lines.push(`${idx + 1}. ${u.name} — ${u.xp} XP`);
    });
    await ctx.reply(lines.join('\n'));
    return;
  }

  const quizMatch = /^quiz_(\d+)$/.exec(payload);
  if (!quizMatch) {
    return;
  }

  const from = ctx.from;
  if (!from) return;

  const quizId = Number(quizMatch[1]);
  const quizzes = await getQuizzes();
  const selectedQuiz = quizzes.find((quiz) => Number(quiz.id) === quizId);
  if (!selectedQuiz) {
    await ctx.reply('⚠️ This quiz is unavailable right now.');
    return;
  }

  const started = await startQuiz(quizId, profile.user_id);
  const webAppUrl = buildQuizWebAppUrl(hostedQuizBaseUrl, {
    attemptId: started.attempt_id,
    quizId,
    userId: profile.user_id,
    telegramId: from.id
  });

  await ctx.reply(`🧠 ${selectedQuiz.title}\n❓ Questions: ${selectedQuiz.question_count}`, {
    reply_markup: quizLaunchKeyboard(webAppUrl)
  });
}

async function onboard(ctx: Context) {
  try {
    const from = ctx.from;
    if (!from) {
      await ctx.reply('⚠️ Something went wrong. Please try again.');
      return;
    }

    const profile = await authUser({
      telegram_id: String(from.id),
      username: from.username,
      first_name: from.first_name
    });

    setSession(from.id, { user_id: profile.user_id, name: profile.name, role: profile.role });

    await ctx.reply("👋 Welcome to CUET Prep Bot!\nLet's crack CUET together 🚀", {
      reply_markup: mainMenuKeyboard(profile.role)
    });

    const payload = typeof ctx.match === 'string' ? ctx.match.trim() : '';
    if (payload) {
      await handleDeepLink(ctx, payload, { user_id: profile.user_id });
    }
  } catch (error) {
    console.error('/start error:', error);
    await notifyAdmins(`🚨 /start failed\nUser: ${ctx.from?.id ?? 'unknown'}\nError: ${String(error)}`);
    await ctx.reply('⚠️ Something went wrong. Please try again.');
  }
}

export function registerStartHandlers(bot: Bot) {
  bot.command('start', onboard);

  bot.callbackQuery('my_progress', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const from = ctx.from;
      if (!from) return;

      const profile = await authUser({
        telegram_id: String(from.id),
        username: from.username,
        first_name: from.first_name
      });

      const session = getSession(from.id);
      if (!session) {
        setSession(from.id, { user_id: profile.user_id, name: profile.name, role: profile.role });
      }

      await ctx.reply(`📊 My Progress\n\nName: ${profile.name}\nXP: ${profile.xp}\nRole: ${profile.role}`);
    } catch (error) {
      console.error('my_progress error:', error);
      await notifyAdmins(`🚨 my_progress failed\nUser: ${ctx.from?.id ?? 'unknown'}\nError: ${String(error)}`);
      await ctx.reply('⚠️ Something went wrong. Please try again.');
    }
  });

  bot.callbackQuery('premium_locked', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('🔒 Premium feature\n\nUpgrade to unlock full access 🚀');
  });

  bot.callbackQuery('admin_task_panel', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const from = ctx.from;
      if (!from) return;

      const profile = await authUser({
        telegram_id: String(from.id),
        username: from.username,
        first_name: from.first_name
      });

      if (profile.role.toLowerCase() !== 'admin') {
        await ctx.reply('⛔ Only admins can access task controls.');
        return;
      }

      const tasks = await getAdminTasks();
      const openCount = tasks.filter((task) => task.status !== 'done').length;
      const panelUrl = `${config.apiBaseUrl}/pdf-quiz-generator.html`;
      await ctx.reply(
        [
          '🧾 Admin Task Panel',
          `Open tasks: ${openCount}`,
          '',
          `Open panel: ${panelUrl}`,
          '',
          'Use the Admin Tasks Panel buttons to create link/file tasks, mark done, or delete.'
        ].join('\n')
      );
    } catch (error) {
      console.error('admin_task_panel error:', error);
      await notifyAdmins(`🚨 admin_task_panel failed\nUser: ${ctx.from?.id ?? 'unknown'}\nError: ${String(error)}`);
      await ctx.reply('⚠️ Failed to open admin task panel.');
    }
  });
}
