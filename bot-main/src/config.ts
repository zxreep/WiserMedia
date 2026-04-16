import dotenv from 'dotenv';

dotenv.config();

const required = ['BOT_TOKEN', 'API_BASE_URL', 'WEBHOOK_URL'] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const webhookUrl = process.env.WEBHOOK_URL as string;
const publicBaseUrl = new URL(webhookUrl).origin;

export const config = {
  botToken: process.env.BOT_TOKEN as string,
  apiBaseUrl: process.env.API_BASE_URL as string,
  webhookUrl,
  publicBaseUrl,
  port: Number(process.env.PORT ?? 3001),
  adminTelegramIds: (process.env.ADMIN_TELEGRAM_IDS ?? '')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
};
