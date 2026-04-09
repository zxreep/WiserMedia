import type { GeneratedPayload } from '../types/pdfQuiz.js';

const NVIDIA_CHAT_COMPLETIONS_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';
const FALLBACK_JSON_MODEL = 'meta/llama-3.1-70b-instruct';

const SYSTEM_PROMPT = `You are an expert exam paper setter for CUET-level competitive exams.

Your task:
Generate high-quality, difficult multiple-choice questions from the given content.

Rules:
- Focus on conceptual, tricky, and application-based questions.
- Avoid simple factual or direct questions.
- Questions should test understanding, not memorization.

Output Requirements (STRICT):
- Return ONLY valid JSON.
- Do NOT include any explanation outside JSON.
- Do NOT include markdown, code blocks, or extra text.
- Output must be directly parsable using JSON.parse().

Format:
{
  "key_points": ["..."],
  "questions": [
    {
      "question_text": "...",
      "options": ["A", "B", "C", "D"],
      "correct_option_id": 0,
      "explanation": "...",
      "question_order": 1
    }
  ]
}

Constraints:
- Always provide exactly 4 options.
- Only one correct answer.
- Ensure answer matches one of the options exactly.
- Keep explanations concise but meaningful.

If content is large:
- Extract key concepts and generate multiple questions.

If content is insufficient:
- Return an empty JSON array: []

IMPORTANT:
Any response that is not strictly valid JSON is considered incorrect.`;

export async function generateFromChunk(chunk: string, apiKey: string, model: string): Promise<GeneratedPayload> {
  const initialRaw = await requestCompletion(model, apiKey, [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content:
        `Generate 2 key points and 2 difficult CUET-style MCQs from this chunk. ` +
        `Make options plausible and close. Return valid JSON only. Chunk:\n${chunk}`
    }
  ]);

  const parsed = await parseOrRepairJson(initialRaw, apiKey);
  return sanitizeGeneratedPayload(parsed);
}

async function requestCompletion(model: string, apiKey: string, messages: Array<{ role: string; content: string }>) {
  const response = await fetch(NVIDIA_CHAT_COMPLETIONS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      top_p: 0.7,
      max_tokens: 1200,
      messages
    })
  });

  if (!response.ok) {
    throw new Error(`ai api failure (${response.status})`);
  }

  const raw = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };

  const content = normalizeContent(raw.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error('ai api failure (empty response)');
  }

  return content;
}

async function parseOrRepairJson(content: string, apiKey: string): Promise<unknown> {
  try {
    return JSON.parse(content);
  } catch {
    const repaired = await requestCompletion(FALLBACK_JSON_MODEL, apiKey, [
      {
        role: 'system',
        content:
          'You are a JSON repair engine. Convert user content into strict valid JSON only. No markdown, no explanations.'
      },
      {
        role: 'user',
        content:
          `Fix this into valid JSON only. Keep same intended structure. If impossible, return [] exactly.\n\n${content}`
      }
    ]);

    try {
      return JSON.parse(repaired);
    } catch {
      throw new Error('ai api failure (invalid json)');
    }
  }
}

function sanitizeGeneratedPayload(parsed: unknown): GeneratedPayload {
  if (Array.isArray(parsed) && parsed.length === 0) {
    return { key_points: [], questions: [] };
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('ai api failure (schema mismatch)');
  }

  const record = parsed as {
    key_points?: unknown[];
    questions?: Array<{
      question?: unknown;
      question_text?: unknown;
      options?: unknown[];
      correct_option_id?: unknown;
      explanation?: unknown;
    }>;
  };

  const keyPoints = Array.isArray(record.key_points) ? record.key_points.map((x) => String(x)).slice(0, 10) : [];
  const questions = Array.isArray(record.questions)
    ? record.questions
        .map((q) => {
          const questionText = String(q.question_text ?? q.question ?? '');
          const options = Array.isArray(q.options) ? q.options.map((o) => String(o)).slice(0, 4) : [];
          const correctOption = Number(q.correct_option_id);
          return {
            question: questionText,
            options,
            correct_option_id: correctOption,
            explanation: String(q.explanation ?? '')
          };
        })
        .filter((q) => q.question && q.options.length === 4 && q.correct_option_id >= 0 && q.correct_option_id <= 3)
        .slice(0, 8)
    : [];

  return { key_points: keyPoints, questions };
}

function normalizeContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
          return part.text;
        }
        return '';
      })
      .join('')
      .trim();
  }

  return '';
}
