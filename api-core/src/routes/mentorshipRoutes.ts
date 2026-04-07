import type { FastifyInstance } from 'fastify';
import { acceptMentorshipController, createMentorshipRequestController } from '../controllers/mentorshipController.js';

export async function mentorshipRoutes(app: FastifyInstance) {
  app.post('/requests', createMentorshipRequestController);
  app.post('/requests/:id/accept', acceptMentorshipController);
}
