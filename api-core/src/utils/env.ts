import dotenv from 'dotenv';

dotenv.config();

const requiredVars = ['DATABASE_URL'] as const;

for (const key of requiredVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL as string,
  aiBaseUrl: process.env.AI_BASE_URL ?? 'https://api.openai.com/v1/chat/completions',
  aiModel: process.env.AI_MODEL ?? 'gpt-4o-mini'
};
