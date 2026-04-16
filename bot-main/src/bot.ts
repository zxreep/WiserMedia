import Fastify from 'fastify';
import { Bot, webhookCallback } from 'grammy';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { registerStartHandlers } from './handlers/start.js';
import { registerQuizHandlers } from './handlers/quiz.js';
import { registerLeaderboardHandlers } from './handlers/leaderboard.js';
import { registerMentorshipHandlers } from './handlers/mentorship.js';

export type LocalQuizState = {
  quiz_id: number;
  attempt_id: number;
  questions: Array<{ id: number; question: string; options: string[] }>;
  current_question_index: number;
  answers: Array<{ question_id: number; selected_option: number }>;
};

export type UserState = {
  user_id: number;
  name: string;
  role: string;
  quiz_state?: LocalQuizState;
};

export const userSession = new Map<number, UserState>();

export function getSession(telegramId: number): UserState | undefined {
  return userSession.get(telegramId);
}

export function setSession(telegramId: number, session: UserState): void {
  userSession.set(telegramId, session);
}

export function clearQuizState(telegramId: number): void {
  const existing = userSession.get(telegramId);
  if (!existing) return;
  delete existing.quiz_state;
  userSession.set(telegramId, existing);
}

const bot = new Bot(config.botToken);

registerStartHandlers(bot);
registerQuizHandlers(bot);
registerLeaderboardHandlers(bot);
registerMentorshipHandlers(bot);

bot.catch(async (error) => {
  console.error('Bot error:', error.error);
  try {
    await error.ctx.reply('⚠️ Something went wrong. Please try again.');
  } catch {
    // ignore send failures
  }
});

async function bootstrap() {
  const server = Fastify({ logger: true });
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const quizHtmlPath = path.resolve(__dirname, '../../nta-mock-test.html');

  await bot.api.setWebhook(config.webhookUrl);

  server.post('/telegram/webhook', webhookCallback(bot, 'fastify'));
  server.get('/quiz', async (request, reply) => {
    const html = await readFile(quizHtmlPath, 'utf8');
    const attemptId = Number((request.query as { attempt_id?: string }).attempt_id);

    if (!Number.isInteger(attemptId)) {
      return reply.type('text/html; charset=utf-8').send(html);
    }

    const res = await fetch(`${config.apiBaseUrl}/webapp/quiz/${attemptId}`);
    const payload = await res.json();
    const injected = `<script>window.quizData=${JSON.stringify(payload?.data ?? null)};window.quizApiBase=${JSON.stringify(config.apiBaseUrl)};</script>`;
    const merged = html.replace('<script src="https://telegram.org/js/telegram-web-app.js"></script>', `${injected}\n<script src="https://telegram.org/js/telegram-web-app.js"></script>`);
    return reply.type('text/html; charset=utf-8').send(merged);
  });
  server.post('/quiz/submit', async (request, reply) => {
    const response = await fetch(`${config.apiBaseUrl}/webapp/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body ?? {})
    });
    const payload = await response.json();
    return reply.code(response.status).send(payload);
  });

  server.get('/health', async () => ({ success: true, data: { status: 'ok' } }));

  await server.listen({ port: config.port, host: '0.0.0.0' });
  server.log.info(`bot-main listening on ${config.port}`);
}

void bootstrap();
