import type { FastifyReply, FastifyRequest } from 'fastify';
import { getPremiumStatus, manualUpgrade } from '../services/premiumService.js';

type StatusQuery = { user_id?: string };
type UpgradeBody = { user_id?: number; days?: number };

export async function premiumStatusController(
  request: FastifyRequest<{ Querystring: StatusQuery }>,
  reply: FastifyReply
) {
  const userId = Number(request.query.user_id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return reply.code(400).send({ success: false, error: 'valid user_id is required' });
  }

  const data = await getPremiumStatus(userId);
  return reply.send({ success: true, data });
}

export async function premiumManualWebhookController(
  request: FastifyRequest<{ Body: UpgradeBody }>,
  reply: FastifyReply
) {
  const userId = request.body.user_id;
  const days = request.body.days ?? 30;

  if (!userId) {
    return reply.code(400).send({ success: false, error: 'user_id is required' });
  }

  const data = await manualUpgrade(userId, days);
  return reply.send({ success: true, data });
}
