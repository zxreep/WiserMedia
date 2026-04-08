import type { FastifyInstance } from 'fastify';
import {
  listQuizzesController,
  startQuizController,
  submitQuizController
} from '../controllers/quizController.js';

export async function quizRoutes(app: FastifyInstance) {
  app.get('/', listQuizzesController);
  app.post('/:id/start', startQuizController);
  app.post('/:id/submit', submitQuizController);
}
