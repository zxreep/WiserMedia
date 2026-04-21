import type { FastifyReply, FastifyRequest } from 'fastify';
import { createTask, deleteTask, getTasks, updateTaskStatus } from '../services/taskService.js';
type TaskQuery = { taskid?: string; status?: string; action?: string };
type CreateTaskBody = { tasktype?: string; linktext?: string; fileid?: string };

export async function createTaskController(
  request: FastifyRequest<{ Body: CreateTaskBody }>,
  reply: FastifyReply
) {
  const taskType = request.body.tasktype?.trim();
  const linkText = request.body.linktext?.trim();
  const fileId = request.body.fileid?.trim();

  if (taskType !== 'link' && taskType !== 'file') {
    return reply.code(400).send({ success: false, error: 'tasktype must be link or file' });
  }

  if (taskType === 'link' && !linkText) {
    return reply.code(400).send({ success: false, error: 'linktext is required for link task' });
  }

  if (taskType === 'file' && !fileId) {
    return reply.code(400).send({ success: false, error: 'fileid is required for file task' });
  }

  const task = await createTask(
    taskType === 'link' ? { taskType, linkText: linkText! } : { taskType, fileId: fileId! }
  );
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
