import { generateFromChunk } from './aiService.js';
import type { GeneratedPayload, QuizQuestion } from '../types/pdfQuiz.js';

export async function processChunksSequentially(chunks: string[], apiKey: string, model: string): Promise<GeneratedPayload> {
  const keyPoints = new Set<string>();
  const questions: QuizQuestion[] = [];

  for (const chunk of chunks) {
    const generated = await generateFromChunk(chunk, apiKey, model);
    for (const point of generated.key_points) {
      if (point) keyPoints.add(point);
    }
    questions.push(...generated.questions);
    if (questions.length >= 20) {
      break;
    }
  }

  return {
    key_points: Array.from(keyPoints).slice(0, 30),
    questions: questions.slice(0, 20)
  };
}
