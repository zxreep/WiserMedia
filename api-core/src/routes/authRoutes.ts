import type { FastifyInstance } from 'fastify';
import { telegramAuthController } from '../controllers/authController.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/telegram', telegramAuthController);
}
