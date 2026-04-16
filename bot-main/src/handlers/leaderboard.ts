import type { Bot } from 'grammy';
import { getLeaderboard } from '../api-client.js';
import { getSession, notifyAdmins } from '../bot.js';

export function registerLeaderboardHandlers(bot: Bot) {
  bot.callbackQuery('show_leaderboard', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const from = ctx.from;
      const leaderboard = await getLeaderboard();
      const session = from ? getSession(from.id) : undefined;

      const lines = ['🏆 Top Students', ''];

      leaderboard.users.slice(0, 10).forEach((u, idx) => {
        const isCurrent = session && u.name === session.name;
        lines.push(`${idx + 1}. ${u.name}${isCurrent ? ' (You)' : ''} — ${u.xp} XP`);
      });

      await ctx.reply(lines.join('\n'));
    } catch (error) {
      console.error('show_leaderboard error:', error);
      await notifyAdmins(`🚨 show_leaderboard failed\nUser: ${ctx.from?.id ?? 'unknown'}\nError: ${String(error)}`);
      await ctx.reply('⚠️ Something went wrong. Please try again.');
    }
  });
}
