import type { Bot, Context } from 'grammy';
import { authUser } from '../api-client.js';
import { mainMenuKeyboard } from '../keyboards/mainMenu.js';
import { getSession, notifyAdmins, setSession } from '../bot.js';

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
}
