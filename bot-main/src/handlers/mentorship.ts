import type { Bot } from 'grammy';
import { requestMentorship } from '../api-client.js';
import { getSession } from '../bot.js';

export function registerMentorshipHandlers(bot: Bot) {
  bot.callbackQuery('find_mentor', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const from = ctx.from;
      if (!from) {
        await ctx.reply('⚠️ Something went wrong. Please try again.');
        return;
      }

      const session = getSession(from.id);
      if (!session) {
        await ctx.reply('Please use /start first.');
        return;
      }

      await requestMentorship(session.user_id);
      await ctx.reply('✅ Request sent!\nA mentor will connect with you soon.');
    } catch {
      await ctx.reply('⚠️ Something went wrong. Please try again.');
    }
  });
}
