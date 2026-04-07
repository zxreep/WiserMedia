import { dbQuery } from '../db/query.js';

export async function getGlobalLeaderboard() {
  const result = await dbQuery<{
    name: string;
    xp: string;
  }>(
    `SELECT u.name,
            COALESCE(SUM(x.amount), 0)::text AS xp
     FROM users u
     LEFT JOIN xp_ledger x ON x.user_id = u.id
     GROUP BY u.id
     ORDER BY COALESCE(SUM(x.amount), 0) DESC, u.id ASC
     LIMIT 50`
  );

  return {
    users: result.rows.map((row) => ({
      name: row.name,
      xp: Number(row.xp)
    }))
  };
}
