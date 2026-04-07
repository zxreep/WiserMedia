import dotenv from 'dotenv';

dotenv.config();

const required = ['BOT_TOKEN', 'API_BASE_URL', 'WEBHOOK_URL'] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const config = {
  botToken: process.env.BOT_TOKEN as string,
  apiBaseUrl: process.env.API_BASE_URL as string,
  webhookUrl: process.env.WEBHOOK_URL as string,
  port: Number(process.env.PORT ?? 3001)
};
