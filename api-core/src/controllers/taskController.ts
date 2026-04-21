import type { FastifyReply, FastifyRequest } from 'fastify';
import { createTask, deleteTask, getTasks, updateTaskStatus } from '../services/taskService.js';

type TaskBody = { task?: string };
type TaskQuery = { taskid?: string; status?: string; action?: string };

export async function createTaskController(
  request: FastifyRequest<{ Body: TaskBody }>,
  reply: FastifyReply
) {
  const taskText = request.body.task?.trim();

  if (!taskText) {
    return reply.code(400).send({ success: false, error: 'task is required' });
  }

  const task = await createTask(taskText);
  return reply.code(201).send({ success: true, data: task });
}

export async function taskController(
  request: FastifyRequest<{ Querystring: TaskQuery }>,
  reply: FastifyReply
) {
  const taskId = request.query.taskid?.trim();
  const status = request.query.status?.trim();
  const action = request.query.action?.trim();

  if (taskId && action === 'delete') {
    const deleted = await deleteTask(taskId);
    return reply.send({ success: true, data: { deleted } });
  }

  if (taskId && status) {
    const updated = await updateTaskStatus(taskId, status);
    return reply.send({ success: true, data: { updated } });
  }

  const tasks = await getTasks();
  return reply.send({ success: true, data: tasks });
}
