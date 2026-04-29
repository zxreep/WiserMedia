import type { Bot, Context } from 'grammy';
import { authUser, getQuizPollQuestions } from '../api-client.js';
import { getBotUsername, notifyAdmins } from '../bot.js';

type ParsedCommand = {
  quizId: number;
  questionCount: number;
  method: 'regular' | 'timed';
  timerSeconds: number;
};

function parsePollCommand(text: string): ParsedCommand | null {
  const username = getBotUsername().toLowerCase();
  const normalized = text.trim();
  const withoutPrefix = normalized.replace(new RegExp(`^@${username}\\s+`, 'i'), '');
  const match = /^\/send_polls(\d+)(?:@[a-zA-Z0-9_]+)?\s+(\d+)\s+(.+)$/i.exec(withoutPrefix);
  if (!match) return null;

  const quizId = Number(match[1]);
  const questionCount = Number(match[2]);
  const methodRaw = match[3].trim().toLowerCase();

  if (!Number.isInteger(quizId) || quizId <= 0 || !Number.isInteger(questionCount) || questionCount <= 0) {
    return null;
  }

  if (methodRaw === 'regular') {
    return { quizId, questionCount, method: 'regular', timerSeconds: 0 };
  }

  const timedMatch = /^timed(?:\s+(\d+))?$/.exec(methodRaw);
  if (timedMatch) {
    const timerSeconds = timedMatch[1] ? Number(timedMatch[1]) : 60;
    if (!Number.isInteger(timerSeconds) || timerSeconds < 5 || timerSeconds > 600) {
      return null;
    }

    return { quizId, questionCount, method: 'timed', timerSeconds };
  }

  return null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function registerPollCommandHandlers(bot: Bot) {
  bot.on(['message:text', 'channel_post:text'], async (ctx: Context) => {
    try {
      const messageText = 'message' in ctx.update ? ctx.update.message?.text : ctx.update.channel_post?.text;
      if (!messageText || (!messageText.startsWith('/send_polls') && !messageText.startsWith('@'))) {
        return;
      }

      const parsed = parsePollCommand(messageText);
      if (!parsed) {
        await ctx.reply(
          '⚠️ Invalid command format. Use:\n@botname /send_polls{QUIZ_ID} {NO_OF_QUESTIONS} {regular|timed [seconds]}\nExample: @botname /send_polls22 10 timed\nExample: /send_polls22 10 timed 90'
        );
        return;
      }

      const from = ctx.from;
      if (!from) {
        await ctx.reply('⚠️ Unable to verify admin user.');
        return;
      }

      const profile = await authUser({
        telegram_id: String(from.id),
        username: from.username,
        first_name: from.first_name
      });

      if (profile.role.toLowerCase() !== 'admin') {
        await ctx.reply('⛔ Only admins can send quiz polls.');
        return;
      }

      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply('⚠️ Chat not detected.');
        return;
      }

      const questions = await getQuizPollQuestions(parsed.quizId, profile.user_id);
      if (questions.length === 0) {
        await ctx.reply('⚠️ No questions available for this quiz.');
        return;
      }

      await ctx.reply(
        `🚀 Sending ${parsed.questionCount} polls from quiz ${parsed.quizId} (${parsed.method}${
          parsed.method === 'timed' ? `, ${parsed.timerSeconds}s` : ''
        })...`
      );

      let sent = 0;
      let failed = 0;
      let attempts = 0;
      let cursor = 0;
      const maxAttempts = Math.max(parsed.questionCount * 5, questions.length);

      while (sent < parsed.questionCount && attempts < maxAttempts) {
        const question = questions[cursor % questions.length];
        cursor += 1;
        attempts += 1;

        try {
          await ctx.api.sendPoll(chatId, question.question, question.options, {
            type: 'quiz',
            correct_option_ids: [question.correct_option_index],
            open_period: parsed.method === 'timed' ? parsed.timerSeconds : undefined,
            is_anonymous: false,
            explanation: `Question ${sent + 1} of ${parsed.questionCount}`
          });

          sent += 1;

          if (parsed.method === 'regular' && sent % 5 === 0) {
            await sleep(1000);
          }

          if (parsed.method === 'timed' && sent < parsed.questionCount) {
            await sleep(parsed.timerSeconds * 1000);
          }
        } catch (error) {
          failed += 1;
          console.error('send poll failed, moving to next question:', error);
        }
      }

      if (sent < parsed.questionCount) {
        await ctx.reply(`⚠️ Sent ${sent}/${parsed.questionCount} polls. Failed attempts: ${failed}.`);
      } else {
        await ctx.reply(`✅ Finished sending ${sent} polls.\n📊 Score card: each correct poll answer = 1 point.`);
      }
    } catch (error) {
      console.error('send_polls command error:', error);
      await notifyAdmins(`🚨 send_polls failed\nUser: ${ctx.from?.id ?? 'unknown'}\nError: ${String(error)}`);
      await ctx.reply('⚠️ Failed to send polls.');
    }
  });
}
