import type { FastifyInstance } from 'fastify';
import { premiumManualWebhookController, premiumStatusController } from '../controllers/premiumController.js';

export async function premiumRoutes(app: FastifyInstance) {
  app.get('/status', premiumStatusController);
  app.post('/webhook/manual', premiumManualWebhookController);
}
