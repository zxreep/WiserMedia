import { randomUUID } from 'node:crypto';
import { dbQuery } from '../db/query.js';

type TaskRow = {
  id: string;
  task_text: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export async function createTask(taskText: string) {
  const id = randomUUID();
  const result = await dbQuery<TaskRow>(
    `INSERT INTO admin_tasks (id, task_text, status)
     VALUES ($1, $2, 'pending')
     RETURNING id, task_text, status, created_at::text, updated_at::text`,
    [id, taskText]
  );

  return result.rows[0];
}

export async function getTasks() {
  const result = await dbQuery<TaskRow>(
    `SELECT id, task_text, status, created_at::text, updated_at::text
     FROM admin_tasks
     ORDER BY created_at DESC`
  );

  return result.rows;
}

export async function updateTaskStatus(taskId: string, status: string) {
  const result = await dbQuery<TaskRow>(
    `UPDATE admin_tasks
     SET status = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, task_text, status, created_at::text, updated_at::text`,
    [taskId, status]
  );

  if (!result.rows[0]) {
    throw new Error('task not found');
  }

  return result.rows[0];
}

export async function deleteTask(taskId: string) {
  const result = await dbQuery<TaskRow>(
    `DELETE FROM admin_tasks
     WHERE id = $1
     RETURNING id, task_text, status, created_at::text, updated_at::text`,
    [taskId]
  );

  if (!result.rows[0]) {
    throw new Error('task not found');
  }

  return result.rows[0];
}
