import type { GeneratedPayload } from '../types/pdfQuiz.js';
import { env } from '../utils/env.js';

const AI_BASE_URL = env.aiBaseUrl;
const AI_MODEL = env.aiModel;

const SYSTEM_PROMPT = `You are an expert CUET exam setter. Focus on conceptual and tricky questions.
Avoid direct fact recall and avoid obvious answer patterns.
Generate difficult MCQs that test understanding, inference and confusion between close options.
Return strict JSON only with keys: key_points, questions.
Each question must include: question, options (4), correct_option_id (0-3), explanation.`;

export async function generateFromChunk(chunk: string, apiKey: string): Promise<GeneratedPayload> {
  const response = await fetch(AI_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content:
            `Generate 2 key points and 2 difficult CUET-style MCQs from this chunk. ` +
            `Make options plausible and close. Chunk:\n${chunk}`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`ai api failure (${response.status})`);
  }

  const raw = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = raw.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('ai api failure (empty response)');
  }

  let parsed: GeneratedPayload;
  try {
    parsed = JSON.parse(content) as GeneratedPayload;
  } catch {
    throw new Error('ai api failure (invalid json)');
  }

  if (!Array.isArray(parsed.key_points) || !Array.isArray(parsed.questions)) {
    throw new Error('ai api failure (schema mismatch)');
  }

  return {
    key_points: parsed.key_points.map((x) => String(x)).slice(0, 10),
    questions: parsed.questions
      .map((q) => ({
        question: String(q.question ?? ''),
        options: Array.isArray(q.options) ? q.options.map((o) => String(o)).slice(0, 4) : [],
        correct_option_id: Number(q.correct_option_id),
        explanation: String(q.explanation ?? '')
      }))
      .filter((q) => q.question && q.options.length === 4 && q.correct_option_id >= 0 && q.correct_option_id <= 3)
      .slice(0, 8)
  };
}
