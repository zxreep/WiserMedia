import type { FastifyReply, FastifyRequest } from 'fastify';
import { getGlobalLeaderboard } from '../services/leaderboardService.js';

export async function globalLeaderboardController(_request: FastifyRequest, reply: FastifyReply) {
  const data = await getGlobalLeaderboard();
  return reply.send({ success: true, data });
}
