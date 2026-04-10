import cors from '@fastify/cors';
import path from 'node:path';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { authRoutes } from './routes/authRoutes.js';
import { quizRoutes } from './routes/quizRoutes.js';
import { leaderboardRoutes } from './routes/leaderboardRoutes.js';
import { mentorshipRoutes } from './routes/mentorshipRoutes.js';
import { premiumRoutes } from './routes/premiumRoutes.js';
import { webAppRoutes } from './routes/webAppRoutes.js';
import { pdfQuizRoutes } from './routes/pdfQuizRoutes.js';

export function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: '*' });
  
  app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1
    }
  });

  app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'src/public'),
    prefix: '/'
  });

  app.get('/health', async () => ({ success: true, data: { status: 'ok' } }));

  app.register(authRoutes, { prefix: '/auth' });
  app.register(quizRoutes, { prefix: '/quizzes' });
  app.register(webAppRoutes, { prefix: '/webapp' });
  app.register(leaderboardRoutes, { prefix: '/leaderboard' });
  app.register(mentorshipRoutes, { prefix: '/mentorship' });
  app.register(premiumRoutes, { prefix: '/premium' });
  app.register(pdfQuizRoutes, { prefix: '/pdf-quiz' });

  app.setErrorHandler((error, request, reply) => {
    app.log.error({ err: error, url: request.url, method: request.method }, 'request failed');
    const errorMessage = error instanceof Error ? error.message : 'unknown error';

    const exact400Errors = new Set([
      'invalid quiz',
      'invalid attempt',
      'attempt already submitted',
      'missing user',
      'duplicate request',
      'request not found',
      'request already handled',
      'not assigned mentor',
      'invalid pdf',
      'pdf too large',
      'pdf has no extractable text',
      'missing ai api key',
      'missing ai model',
      'missing telegram credentials',
      'upload not found',
      'quiz not found',
      'no questions generated',
      'invalid quiz payload',
      'invalid router payload'
    ]);

    if (exact400Errors.has(errorMessage)) {
      return reply.code(400).send({ success: false, error: errorMessage });
    }

    if (errorMessage.startsWith('ai api failure')) {
      return reply.code(502).send({ success: false, error: errorMessage });
    }

    if (errorMessage.startsWith('telegram api failure')) {
      return reply.code(502).send({ success: false, error: errorMessage });
    }

    return reply.code(500).send({ success: false, error: `Internal server error: ${errorMessage}` });
  });

  return app;
}
