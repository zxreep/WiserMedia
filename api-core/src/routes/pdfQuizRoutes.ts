import type { FastifyInstance } from 'fastify';
import {
  addQuizFromJsonController,
  generateQuizController,
  processPdfController,
  requestRouterController,
  sendTelegramController,
  uploadPdfController
} from '../controllers/pdfQuizController.js';

export async function pdfQuizRoutes(app: FastifyInstance) {
  app.post('/upload-pdf', uploadPdfController);
  app.post('/process-pdf', processPdfController);
  app.post('/generate-quiz', generateQuizController);
  app.post('/add-quiz-json', addQuizFromJsonController);
  app.post('/request-router', requestRouterController);
  app.post('/send-telegram', sendTelegramController);
}
