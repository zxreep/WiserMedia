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

async function getSubmittedAttemptResult(
  client: { query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> },
  attemptId: number
) {
  const summary = await client.query<{
    score: number;
    correct_count: number;
    total_questions: number;
    user_id: number;
  }>(
    `SELECT score, correct_count, total_questions, user_id
     FROM quiz_attempts
     WHERE id = $1`,
    [attemptId]
  );

  if (summary.rows.length === 0) {
    throw new Error('invalid attempt');
  }

  const answerRows = await client.query<{
    question_id: number;
    selected_option: number;
    is_correct: boolean;
    question_text: string;
    options: string;
    correct_option_index: number;
  }>(
    `SELECT qaa.question_id,
            qaa.selected_option,
            qaa.is_correct,
            qq.question_text,
            qq.options::text AS options,
            qq.correct_option_index
     FROM quiz_attempt_answers qaa
     INNER JOIN quiz_questions qq ON qq.id = qaa.question_id
     WHERE qaa.attempt_id = $1`,
    [attemptId]
  );

  const wrongQuestions = answerRows.rows
    .filter((row) => !row.is_correct)
    .map((row) => {
      const options = JSON.parse(row.options) as string[];
      const selectedOption = Number(row.selected_option);
      const correctOption = Number(row.correct_option_index);

      return {
        question_id: Number(row.question_id),
        question: row.question_text,
        selected_option: selectedOption,
        correct_option: correctOption,
        selected_text: options[selectedOption] ?? '',
        correct_text: options[correctOption] ?? ''
      };
    });

  return {
    score: Number(summary.rows[0].score ?? 0),
    correct: Number(summary.rows[0].correct_count ?? 0),
    total: Number(summary.rows[0].total_questions ?? 0),
    xp_earned: Number(summary.rows[0].correct_count ?? 0) * 10,
    wrong_questions: wrongQuestions
  };
}

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
      return getSubmittedAttemptResult(client, attemptId);
    }

    const questions = await client.query<{
      id: number;
      correct_option_index: number;
      question_text: string;
      options: string;
    }>(
      'SELECT id, correct_option_index, question_text, options::text FROM quiz_questions WHERE quiz_id = $1',
      [quizId]
    );

    const byId = new Map(questions.rows.map((q) => [Number(q.id), q]));
    const normalizedAnswers = answers
      .map((answer) => ({
        question_id: Number(answer.question_id),
        selected_option: Number(answer.selected_option)
      }))
      .filter(
        (answer) =>
          Number.isInteger(answer.question_id) &&
          Number.isInteger(answer.selected_option) &&
          answer.selected_option >= 0 &&
          answer.selected_option <= 3
      );

    let correct = 0;
    const wrongQuestions: Array<{
      question_id: number;
      question: string;
      selected_option: number;
      correct_option: number;
      selected_text: string;
      correct_text: string;
    }> = [];

    for (const answer of normalizedAnswers) {
      const question = byId.get(answer.question_id);
      if (!question) {
        continue;
      }

      const correctOption = Number(question.correct_option_index);
      const isCorrect = answer.selected_option === correctOption;
      if (isCorrect) {
        correct += 1;
      } else {
        const options = JSON.parse(question.options) as string[];
        wrongQuestions.push({
          question_id: Number(question.id),
          question: question.question_text,
          selected_option: answer.selected_option,
          correct_option: correctOption,
          selected_text: options[answer.selected_option] ?? '',
          correct_text: options[correctOption] ?? ''
        });
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
      xp_earned: xpEarned,
      wrong_questions: wrongQuestions
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
