import type { FastifyReply, FastifyRequest } from 'fastify';
import { createUploadSession, getUploadSession } from '../services/pdfSessionStore.js';
import { extractPdfText } from '../services/pdfService.js';
import { processChunksSequentially } from '../services/quizGenerationService.js';
import { getQuizQuestions, saveGeneratedQuiz, trackActivity } from '../db/pdfQuizRepo.js';
import { sendQuizPolls } from '../services/telegramService.js';
import type { GenerateQuizBody, ProcessUploadBody, SendTelegramBody } from '../types/pdfQuiz.js';

export async function uploadPdfController(request: FastifyRequest, reply: FastifyReply) {
  const file = await request.file();

  if (!file || file.mimetype !== 'application/pdf') {
    return reply.code(400).send({ success: false, error: 'invalid pdf' });
  }

  const buffer = await file.toBuffer();
  const extracted = await extractPdfText(buffer);
  const session = createUploadSession({
    fileName: file.filename,
    chunks: extracted.chunks,
    chunkCount: extracted.chunks.length,
    characterCount: extracted.text.length
  });

  request.log.info({ fileName: file.filename, chunkCount: session.chunkCount }, 'pdf uploaded and parsed');

  await trackActivity('upload_pdf', {
    upload_id: session.id,
    file_name: file.filename,
    chunk_count: session.chunkCount,
    char_count: session.characterCount
  });

  return reply.send({
    success: true,
    data: {
      uploadId: session.id,
      fileName: session.fileName,
      chunkCount: session.chunkCount,
      characterCount: session.characterCount
    }
  });
}

export async function processPdfController(request: FastifyRequest<{ Body: ProcessUploadBody }>, reply: FastifyReply) {
  const session = getUploadSession(request.body.uploadId);
  if (!session) {
    return reply.code(404).send({ success: false, error: 'upload not found' });
  }

  request.log.info({ uploadId: session.id, chunkCount: session.chunkCount }, 'pdf processing validated');

  await trackActivity('process_pdf', {
    upload_id: session.id,
    chunks: session.chunkCount
  });

  return reply.send({
    success: true,
    data: {
      uploadId: session.id,
      chunkCount: session.chunkCount,
      message: 'ready for quiz generation'
    }
  });
}

export async function generateQuizController(request: FastifyRequest<{ Body: GenerateQuizBody }>, reply: FastifyReply) {
  const { uploadId, aiApiKey, aiModel, outputMode, botToken, chatId } = request.body;
  const session = getUploadSession(uploadId);

  if (!session) {
    return reply.code(404).send({ success: false, error: 'upload not found' });
  }

  if (!aiApiKey) {
    return reply.code(400).send({ success: false, error: 'missing ai api key' });
  }

  if (!aiModel) {
    return reply.code(400).send({ success: false, error: 'missing ai model' });
  }

  request.log.info({ uploadId, outputMode, chunkCount: session.chunkCount, aiModel }, 'starting quiz generation');

  const generated = await processChunksSequentially(session.chunks, aiApiKey, aiModel);
  if (!generated.questions.length) {
    return reply.send({
      success: true,
      data: {
        quizId: null,
        keyPoints: generated.key_points,
        questions: [],
        telegramSent: false,
        message: 'insufficient content for question generation'
      }
    });
  }

  const quizId = await saveGeneratedQuiz({
    title: `CUET quiz for ${session.fileName}`,
    sourceFileName: session.fileName,
    keyPoints: generated.key_points,
    questions: generated.questions
  });

  let telegramSent = false;
  if (outputMode === 'telegram') {
    if (!botToken || !chatId) {
      return reply.code(400).send({ success: false, error: 'missing telegram credentials' });
    }
    await sendQuizPolls(botToken, chatId, generated.questions);
    telegramSent = true;
    await trackActivity('telegram_sent', { chat_id: chatId, question_count: generated.questions.length }, quizId);
  }

  request.log.info({ quizId, questionCount: generated.questions.length, telegramSent }, 'quiz generation complete');

  return reply.send({
    success: true,
    data: {
      quizId,
      keyPoints: generated.key_points,
      questions: generated.questions,
      telegramSent
    }
  });
}

export async function sendTelegramController(request: FastifyRequest<{ Body: SendTelegramBody }>, reply: FastifyReply) {
  const { quizId, botToken, chatId } = request.body;
  if (!botToken || !chatId) {
    return reply.code(400).send({ success: false, error: 'missing telegram credentials' });
  }

  const questions = await getQuizQuestions(quizId);
  if (!questions.length) {
    return reply.code(404).send({ success: false, error: 'quiz not found' });
  }

  await sendQuizPolls(botToken, chatId, questions);
  await trackActivity('telegram_sent', { chat_id: chatId, question_count: questions.length }, quizId);
  request.log.info({ quizId, sentCount: questions.length, chatId }, 'telegram quiz sent');

  return reply.send({ success: true, data: { quizId, sentCount: questions.length } });
}
