import type { FastifyInstance } from 'fastify';
import {
  generateQuizController,
  processPdfController,
  sendTelegramController,
  uploadPdfController
} from '../controllers/pdfQuizController.js';

export async function pdfQuizRoutes(app: FastifyInstance) {
  app.post('/upload-pdf', uploadPdfController);
  app.post('/process-pdf', processPdfController);
  app.post('/generate-quiz', generateQuizController);
  app.post('/send-telegram', sendTelegramController);
}
