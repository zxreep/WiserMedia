import type { FastifyReply, FastifyRequest } from 'fastify';
import { acceptMentorshipRequest, createMentorshipRequest } from '../services/mentorshipService.js';

type CreateBody = { user_id?: number };
type AcceptBody = { mentor_user_id?: number };

export async function createMentorshipRequestController(
  request: FastifyRequest<{ Body: CreateBody }>,
  reply: FastifyReply
) {
  const userId = request.body.user_id;

  if (!userId) {
    return reply.code(400).send({ success: false, error: 'user_id is required' });
  }

  const data = await createMentorshipRequest(userId);
  return reply.send({ success: true, data });
}

export async function acceptMentorshipController(
  request: FastifyRequest<{ Params: { id: string }; Body: AcceptBody }>,
  reply: FastifyReply
) {
  const requestId = Number(request.params.id);
  const mentorUserId = request.body.mentor_user_id;

  if (!Number.isInteger(requestId) || !mentorUserId) {
    return reply.code(400).send({ success: false, error: 'invalid request id or mentor_user_id missing' });
  }

  const data = await acceptMentorshipRequest(requestId, mentorUserId);
  return reply.send({ success: true, data });
}
