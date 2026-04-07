import { Pool } from 'pg';
import { env } from '../utils/env.js';

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: { rejectUnauthorized: false }
});
