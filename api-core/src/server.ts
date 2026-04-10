import { buildApp } from './app.js';
import { pool } from './db/pool.js';
import { seedDatabase } from './db/seed.js';
import { ensurePdfQuizTables } from './db/pdfQuizRepo.js';
import { env } from './utils/env.js';

async function startServer() {
  const app = await buildApp();

  try {
    await pool.query('SELECT 1');
    await seedDatabase();
    await ensurePdfQuizTables();
    app.log.info('Database connected and seed check complete.');

    await app.listen({ port: env.port, host: '0.0.0.0' });
    app.log.info(`api-core is running on port ${env.port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void startServer();
