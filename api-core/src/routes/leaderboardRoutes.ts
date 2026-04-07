import type { FastifyInstance } from 'fastify';
import { globalLeaderboardController } from '../controllers/leaderboardController.js';

export async function leaderboardRoutes(app: FastifyInstance) {
  app.get('/global', globalLeaderboardController);
}
