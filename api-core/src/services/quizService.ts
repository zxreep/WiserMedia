import { dbQuery, withTransaction } from '../db/query.js';

export async function listPublishedQuizzes() {
  const result = await dbQuery<{
    id: number;
    title: string;
    description: string;
    duration_minutes: number;
    question_count: string;
  }>(
    `SELECT q.id,
            q.title,
            q.description,
            q.duration_minutes,
            COUNT(qq.id)::text AS question_count
     FROM quizzes q
     LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
     WHERE q.is_published = true
     GROUP BY q.id
     ORDER BY q.id DESC`
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    duration_minutes: row.duration_minutes,
    question_count: Number(row.question_count)
  }));
}

export async function startQuiz(quizId: number, userId: number) {
  return withTransaction(async (client) => {
    const quiz = await client.query<{ id: number }>('SELECT id FROM quizzes WHERE id = $1 AND is_published = true', [quizId]);

    if (quiz.rows.length === 0) {
      throw new Error('invalid quiz');
    }

    const attemptInsert = await client.query<{ id: number }>(
      `INSERT INTO quiz_attempts (quiz_id, user_id, started_at, status)
       VALUES ($1, $2, NOW(), 'started')
       RETURNING id`,
      [quizId, userId]
    );

    const questions = await client.query<{
      id: number;
      question_text: string;
      options: string;
      question_order: number;
    }>(
      `SELECT id, question_text, options::text, question_order
       FROM quiz_questions
       WHERE quiz_id = $1
       ORDER BY question_order ASC`,
      [quizId]
    );

    return {
      attempt_id: attemptInsert.rows[0].id,
      questions: questions.rows.map((q) => ({
        id: q.id,
        question: q.question_text,
        options: JSON.parse(q.options)
      }))
    };
  });
}

type SubmitAnswer = {
  question_id: number;
  selected_option: number;
};

export async function submitQuiz(quizId: number, attemptId: number, answers: SubmitAnswer[]) {
  return withTransaction(async (client) => {
    const attemptCheck = await client.query<{
      id: number;
      user_id: number;
      status: string;
    }>(
      `SELECT id, user_id, status
       FROM quiz_attempts
       WHERE id = $1 AND quiz_id = $2`,
      [attemptId, quizId]
    );

    if (attemptCheck.rows.length === 0) {
      throw new Error('invalid attempt');
    }

    if (attemptCheck.rows[0].status === 'submitted') {
      throw new Error('attempt already submitted');
    }

    const questions = await client.query<{
      id: number;
      correct_option_index: number;
    }>(
      'SELECT id, correct_option_index FROM quiz_questions WHERE quiz_id = $1',
      [quizId]
    );

    const byId = new Map(questions.rows.map((q) => [q.id, q]));
    let correct = 0;

    for (const answer of answers) {
      const question = byId.get(answer.question_id);
      if (!question) {
        continue;
      }

      const isCorrect = answer.selected_option === question.correct_option_index;
      if (isCorrect) {
        correct += 1;
      }

      await client.query(
        `INSERT INTO quiz_attempt_answers (attempt_id, question_id, selected_option, is_correct)
         VALUES ($1, $2, $3, $4)`,
        [attemptId, answer.question_id, answer.selected_option, isCorrect]
      );
    }

    const total = questions.rows.length;
    const score = total === 0 ? 0 : Math.round((correct / total) * 100);
    const xpEarned = correct * 10;

    await client.query(
      `UPDATE quiz_attempts
       SET submitted_at = NOW(),
           status = 'submitted',
           score = $2,
           correct_count = $3,
           total_questions = $4
       WHERE id = $1`,
      [attemptId, score, correct, total]
    );

    await client.query(
      `INSERT INTO xp_ledger (user_id, source, source_ref, amount)
       VALUES ($1, 'quiz_submit', $2, $3)`,
      [attemptCheck.rows[0].user_id, `attempt:${attemptId}`, xpEarned]
    );

    return {
      score,
      correct,
      total,
      xp_earned: xpEarned
    };
  });
}

export async function getWebAppQuiz(attemptId: number) {
  const attempt = await dbQuery<{ id: number; quiz_id: number; title: string; duration_minutes: number }>(
    `SELECT qa.id, qa.quiz_id, q.title, q.duration_minutes
     FROM quiz_attempts qa
     INNER JOIN quizzes q ON q.id = qa.quiz_id
     WHERE qa.id = $1`,
    [attemptId]
  );

  if (attempt.rows.length === 0) {
    throw new Error('invalid attempt');
  }

  const questions = await dbQuery<{
    id: number;
    question_text: string;
    options: string;
    question_order: number;
  }>(
    `SELECT id, question_text, options::text, question_order
     FROM quiz_questions
     WHERE quiz_id = $1
     ORDER BY question_order ASC`,
    [attempt.rows[0].quiz_id]
  );

  return {
    attempt_id: attemptId,
    quiz_id: attempt.rows[0].quiz_id,
    title: attempt.rows[0].title,
    duration: attempt.rows[0].duration_minutes * 60,
    questions: questions.rows.map((q) => ({
      id: q.id,
      question: q.question_text,
      options: JSON.parse(q.options)
    }))
  };
}

export async function submitWebAppQuiz(attemptId: number, answers: SubmitAnswer[]) {
  const attempt = await dbQuery<{ quiz_id: number }>('SELECT quiz_id FROM quiz_attempts WHERE id = $1', [attemptId]);
  if (attempt.rows.length === 0) {
    throw new Error('invalid attempt');
  }

  return submitQuiz(attempt.rows[0].quiz_id, attemptId, answers);
}
