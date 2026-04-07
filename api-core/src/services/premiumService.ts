import { dbQuery } from '../db/query.js';

export async function getPremiumStatus(userId: number) {
  const result = await dbQuery<{ is_active: boolean; expires_at: string | null }>(
    `SELECT (status = 'active' AND (expires_at IS NULL OR expires_at > NOW())) AS is_active,
            expires_at::text
     FROM subscriptions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return { is_active: false, expires_at: null };
  }

  return {
    is_active: result.rows[0].is_active,
    expires_at: result.rows[0].expires_at
  };
}

export async function manualUpgrade(userId: number, days: number) {
  const result = await dbQuery<{
    id: number;
    status: string;
    expires_at: string;
  }>(
    `INSERT INTO subscriptions (user_id, plan, status, started_at, expires_at)
     VALUES ($1, 'premium', 'active', NOW(), NOW() + ($2 || ' days')::interval)
     RETURNING id, status, expires_at::text`,
    [userId, days]
  );

  return result.rows[0];
}
