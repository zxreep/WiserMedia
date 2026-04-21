import { randomUUID } from 'node:crypto';
import { dbQuery } from '../db/query.js';

type TaskRow = {
  id: string;
  task_type: 'link' | 'file';
  link_text: string | null;
  file_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type CreateTaskInput =
  | { taskType: 'link'; linkText: string }
  | { taskType: 'file'; fileId: string };

function mapTask(row: TaskRow) {
  return {
    id: row.id,
    tasktype: row.task_type,
    linktext: row.link_text,
    fileid: row.file_id,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export async function createTask(input: CreateTaskInput) {
  const id = randomUUID();

  const linkText = input.taskType === 'link' ? input.linkText : null;
  const fileId = input.taskType === 'file' ? input.fileId : null;

  const result = await dbQuery<TaskRow>(
    `INSERT INTO admin_tasks (id, task_type, link_text, file_id, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id, task_type, link_text, file_id, status, created_at::text, updated_at::text`,
    [id, input.taskType, linkText, fileId]
  );

  return mapTask(result.rows[0]);
}

export async function getTasks() {
  const result = await dbQuery<TaskRow>(
    `SELECT id, task_type, link_text, file_id, status, created_at::text, updated_at::text
     FROM admin_tasks
     ORDER BY created_at DESC`
  );

  return result.rows.map(mapTask);
}

export async function updateTaskStatus(taskId: string, status: string) {
  const result = await dbQuery<TaskRow>(
    `UPDATE admin_tasks
     SET status = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, task_type, link_text, file_id, status, created_at::text, updated_at::text`,
    [taskId, status]
  );

  if (!result.rows[0]) {
    throw new Error('task not found');
  }

  return mapTask(result.rows[0]);
}

export async function deleteTask(taskId: string) {
  const result = await dbQuery<TaskRow>(
    `DELETE FROM admin_tasks
     WHERE id = $1
     RETURNING id, task_type, link_text, file_id, status, created_at::text, updated_at::text`,
    [taskId]
  );

  if (!result.rows[0]) {
    throw new Error('task not found');
  }

  return mapTask(result.rows[0]);
}
