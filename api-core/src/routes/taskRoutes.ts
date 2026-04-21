import type { FastifyInstance } from 'fastify';
import { createTaskController, taskController } from '../controllers/taskController.js';

export async function taskRoutes(app: FastifyInstance) {
  app.get('/', taskController);
  app.post('/', createTaskController);
}
