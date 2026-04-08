import type { FastifyInstance } from 'fastify';
import { webAppQuizController, webAppSubmitController } from '../controllers/quizController.js';

export async function webAppRoutes(app: FastifyInstance) {
  app.get('/quiz/:attempt_id', webAppQuizController);
  app.post('/submit', webAppSubmitController);
}
