import { pool } from './pool.js';
import type { QuizQuestion } from '../types/pdfQuiz.js';

export async function ensurePdfQuizTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS generated_quizzes (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      key_points JSONB NOT NULL,
      source_file_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS generated_quiz_questions (
      id BIGSERIAL PRIMARY KEY,
      quiz_id BIGINT NOT NULL REFERENCES generated_quizzes(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      options JSONB NOT NULL,
      correct_option_id INT NOT NULL,
      explanation TEXT,
      question_order INT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generation_activity (
      id BIGSERIAL PRIMARY KEY,
      quiz_id BIGINT REFERENCES generated_quizzes(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      metadata JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function saveGeneratedQuiz(params: {
  title: string;
  keyPoints: string[];
  sourceFileName: string;
  questions: QuizQuestion[];
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const quiz = await client.query<{ id: number }>(
      `INSERT INTO generated_quizzes (title, key_points, source_file_name) VALUES ($1, $2::jsonb, $3) RETURNING id`,
      [params.title, JSON.stringify(params.keyPoints), params.sourceFileName]
    );

    const quizId = quiz.rows[0].id;

    for (const [index, q] of params.questions.entries()) {
      await client.query(
        `INSERT INTO generated_quiz_questions (quiz_id, question_text, options, correct_option_id, explanation, question_order)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6)`,
        [quizId, q.question, JSON.stringify(q.options), q.correct_option_id, q.explanation, index + 1]
      );
    }

    await client.query(
      `INSERT INTO generation_activity (quiz_id, event_type, metadata) VALUES ($1, $2, $3::jsonb)`,
      [quizId, 'quiz_generated', JSON.stringify({ question_count: params.questions.length })]
    );

    await client.query('COMMIT');
    return quizId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getQuizQuestions(quizId: number): Promise<QuizQuestion[]> {
  const { rows } = await pool.query<{
    question_text: string;
    options: string[];
    correct_option_id: number;
    explanation: string;
  }>(
    `SELECT question_text, options, correct_option_id, explanation
      FROM generated_quiz_questions
      WHERE quiz_id = $1
      ORDER BY question_order ASC`,
    [quizId]
  );

  return rows.map((r) => ({
    question: r.question_text,
    options: r.options,
    correct_option_id: r.correct_option_id,
    explanation: r.explanation
  }));
}

export async function trackActivity(eventType: string, metadata: Record<string, unknown>, quizId?: number) {
  await pool.query(`INSERT INTO generation_activity (quiz_id, event_type, metadata) VALUES ($1, $2, $3::jsonb)`, [
    quizId ?? null,
    eventType,
    JSON.stringify(metadata)
  ]);
}
