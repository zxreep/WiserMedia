import type { FastifyReply, FastifyRequest } from 'fastify';
import { getWebAppQuiz, listPublishedQuizzes, logQuizShare, startQuiz, submitQuiz, submitWebAppQuiz } from '../services/quizService.js';

type StartBody = { user_id?: number };
type SubmitBody = {
  attempt_id?: number;
  answers?: Array<{ question_id: number; selected_option: number }>;
};

type ShareLogBody = {
  quiz_id?: number;
  shared_by_user_id?: number;
  shared_by_telegram_id?: string;
  inline_message_id?: string;
  result_id?: string;
};

export async function listQuizzesController(_request: FastifyRequest, reply: FastifyReply) {
  const quizzes = await listPublishedQuizzes();
  return reply.send({ success: true, data: { quizzes } });
}

export async function startQuizController(
  request: FastifyRequest<{ Params: { id: string }; Body: StartBody }>,
  reply: FastifyReply
) {
  const quizId = Number(request.params.id);
  const userId = request.body.user_id;

  if (!Number.isInteger(quizId) || !userId) {
    return reply.code(400).send({ success: false, error: 'invalid quiz or user_id missing' });
  }

  const data = await startQuiz(quizId, userId);
  return reply.send({ success: true, data });
}

export async function submitQuizController(
  request: FastifyRequest<{ Params: { id: string }; Body: SubmitBody }>,
  reply: FastifyReply
) {
  const quizId = Number(request.params.id);
  const attemptId = request.body.attempt_id;
  const answers = request.body.answers;

  if (!Number.isInteger(quizId) || !attemptId || !Array.isArray(answers)) {
    return reply.code(400).send({ success: false, error: 'invalid submit payload' });
  }

  const data = await submitQuiz(quizId, attemptId, answers);
  return reply.send({ success: true, data });
}

export async function webAppQuizController(
  request: FastifyRequest<{ Params: { attempt_id?: string } }>,
  reply: FastifyReply
) {
  const attemptId = Number(request.params.attempt_id);
  if (!Number.isInteger(attemptId)) {
    return reply.code(400).send({ success: false, error: 'invalid attempt' });
  }

  const data = await getWebAppQuiz(attemptId);
  return reply.send({ success: true, data });
}

export async function webAppSubmitController(
  request: FastifyRequest<{ Body: SubmitBody }>,
  reply: FastifyReply
) {
  const attemptId = request.body.attempt_id;
  const answers = request.body.answers;
  if (!attemptId || !Array.isArray(answers)) {
    return reply.code(400).send({ success: false, error: 'invalid submit payload' });
  }

  const data = await submitWebAppQuiz(attemptId, answers);
  return reply.send({ success: true, data });
}

export async function logQuizShareController(
  request: FastifyRequest<{ Body: ShareLogBody }>,
  reply: FastifyReply
) {
  const { quiz_id, shared_by_user_id, shared_by_telegram_id, inline_message_id, result_id } = request.body;
  if (!quiz_id || !shared_by_telegram_id) {
    return reply.code(400).send({ success: false, error: 'invalid share log payload' });
  }

  const data = await logQuizShare({
    quiz_id,
    shared_by_user_id,
    shared_by_telegram_id,
    inline_message_id,
    result_id
  });

  return reply.send({ success: true, data });
}
