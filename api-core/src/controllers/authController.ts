import type { FastifyReply, FastifyRequest } from 'fastify';
import { authenticateTelegramUser } from '../services/authService.js';

type AuthBody = {
  telegram_id?: string;
  username?: string;
  first_name?: string;
};

export async function telegramAuthController(request: FastifyRequest<{ Body: AuthBody }>, reply: FastifyReply) {
  const { telegram_id, username, first_name } = request.body;

  if (!telegram_id) {
    return reply.code(400).send({
      success: false,
      error: 'telegram_id is required'
    });
  }

  const user = await authenticateTelegramUser({ telegram_id, username, first_name });

  return reply.send({
    success: true,
    data: user
  });
}
