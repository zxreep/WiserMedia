import { withTransaction } from '../db/query.js';

export type TelegramAuthInput = {
  telegram_id: string;
  username?: string;
  first_name?: string;
};

export type AuthUserData = {
  user_id: number;
  name: string;
  xp: number;
  role: string;
};

export async function authenticateTelegramUser(input: TelegramAuthInput): Promise<AuthUserData> {
  return withTransaction(async (client) => {
    const existing = await client.query<{ user_id: number }>(
      'SELECT user_id FROM telegram_accounts WHERE telegram_id = $1',
      [input.telegram_id]
    );

    let userId: number;

    if (existing.rows.length === 0) {
      const displayName = input.first_name ?? input.username ?? `tg_${input.telegram_id}`;
      const userInsert = await client.query<{ id: number }>(
        'INSERT INTO users (name, role) VALUES ($1, $2) RETURNING id',
        [displayName, 'student']
      );

      userId = userInsert.rows[0].id;

      await client.query(
        `INSERT INTO telegram_accounts (user_id, telegram_id, username, first_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (telegram_id) DO UPDATE
         SET username = EXCLUDED.username,
             first_name = EXCLUDED.first_name,
             updated_at = NOW()`,
        [userId, input.telegram_id, input.username ?? null, input.first_name ?? null]
      );
    } else {
      userId = existing.rows[0].user_id;
      await client.query(
        `UPDATE telegram_accounts
         SET username = $2,
             first_name = $3,
             updated_at = NOW()
         WHERE telegram_id = $1`,
        [input.telegram_id, input.username ?? null, input.first_name ?? null]
      );
    }

    const profile = await client.query<{
      id: number;
      name: string;
      role: string;
      xp: string;
    }>(
      `SELECT u.id,
              u.name,
              u.role,
              COALESCE(SUM(x.amount), 0)::text AS xp
       FROM users u
       LEFT JOIN xp_ledger x ON x.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [userId]
    );

    const row = profile.rows[0];

    return {
      user_id: row.id,
      name: row.name,
      xp: Number(row.xp),
      role: row.role
    };
  });
}
