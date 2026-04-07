import { withTransaction } from '../db/query.js';

export async function createMentorshipRequest(userId: number) {
  return withTransaction(async (client) => {
    const user = await client.query<{ id: number }>('SELECT id FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) {
      throw new Error('missing user');
    }

    const existingOpen = await client.query<{ id: number }>(
      `SELECT id FROM mentorship_requests
       WHERE student_user_id = $1 AND status IN ('pending', 'accepted')`,
      [userId]
    );

    if (existingOpen.rows.length > 0) {
      throw new Error('duplicate request');
    }

    const mentor = await client.query<{ id: number }>(
      `SELECT u.id
       FROM users u
       WHERE u.id != $1
       ORDER BY (
         SELECT COALESCE(SUM(amount), 0)
         FROM xp_ledger xl
         WHERE xl.user_id = u.id
       ) DESC,
       u.id ASC
       LIMIT 1`,
      [userId]
    );

    const mentorId = mentor.rows[0]?.id ?? null;

    const requestInsert = await client.query<{
      id: number;
      student_user_id: number;
      mentor_user_id: number | null;
      status: string;
    }>(
      `INSERT INTO mentorship_requests (student_user_id, mentor_user_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING id, student_user_id, mentor_user_id, status`,
      [userId, mentorId]
    );

    return requestInsert.rows[0];
  });
}

export async function acceptMentorshipRequest(requestId: number, mentorUserId: number) {
  return withTransaction(async (client) => {
    const request = await client.query<{
      id: number;
      mentor_user_id: number | null;
      status: string;
    }>('SELECT id, mentor_user_id, status FROM mentorship_requests WHERE id = $1', [requestId]);

    if (request.rows.length === 0) {
      throw new Error('request not found');
    }

    const row = request.rows[0];

    if (row.status !== 'pending') {
      throw new Error('request already handled');
    }

    if (row.mentor_user_id !== null && row.mentor_user_id !== mentorUserId) {
      throw new Error('not assigned mentor');
    }

    const update = await client.query<{
      id: number;
      status: string;
      mentor_user_id: number;
    }>(
      `UPDATE mentorship_requests
       SET mentor_user_id = $2,
           status = 'accepted',
           accepted_at = NOW()
       WHERE id = $1
       RETURNING id, status, mentor_user_id`,
      [requestId, mentorUserId]
    );

    return update.rows[0];
  });
}
