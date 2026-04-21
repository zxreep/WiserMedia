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

let ensureTablePromise: Promise<void> | null = null;

async function ensureAdminTasksTable(): Promise<void> {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await dbQuery(`
        CREATE TABLE IF NOT EXISTS admin_tasks (
          id TEXT PRIMARY KEY,
          task_type TEXT NOT NULL CHECK (task_type IN ('link', 'file')),
          link_text TEXT,
          file_id TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CHECK (
            (task_type = 'link' AND link_text IS NOT NULL AND file_id IS NULL)
            OR
            (task_type = 'file' AND file_id IS NOT NULL AND link_text IS NULL)
          )
        )
      `);

      await dbQuery(
        'CREATE INDEX IF NOT EXISTS idx_admin_tasks_created_at ON admin_tasks (created_at DESC)'
      );
    })();
  }

  await ensureTablePromise;
}

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
  await ensureAdminTasksTable();
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
  await ensureAdminTasksTable();
  const result = await dbQuery<TaskRow>(
    `SELECT id, task_type, link_text, file_id, status, created_at::text, updated_at::text
     FROM admin_tasks
     ORDER BY created_at DESC`
  );

  return result.rows.map(mapTask);
}

export async function updateTaskStatus(taskId: string, status: string) {
  await ensureAdminTasksTable();
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
  await ensureAdminTasksTable();
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
