import type { Bot } from 'grammy';
import { getLeaderboard } from '../api-client.js';
import { getSession } from '../bot.js';

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
    } catch {
      await ctx.reply('⚠️ Something went wrong. Please try again.');
    }
  });
}
