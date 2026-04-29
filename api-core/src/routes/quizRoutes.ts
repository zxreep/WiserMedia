import type { FastifyInstance } from 'fastify';
import {
  logQuizShareController,
  quizPollQuestionsController,
  listQuizzesController,
  startQuizController,
  submitQuizController
} from '../controllers/quizController.js';

export async function quizRoutes(app: FastifyInstance) {
  app.get('/', listQuizzesController);
  app.post('/:id/start', startQuizController);
  app.post('/:id/submit', submitQuizController);
  app.get('/:id/poll-questions', quizPollQuestionsController);
  app.post('/shares', logQuizShareController);
}
