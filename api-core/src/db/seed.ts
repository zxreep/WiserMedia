import type { PoolClient } from 'pg';
import { dbQuery, withTransaction } from './query.js';

type SeedQuestion = {
  question: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
};

type SeedQuiz = {
  title: string;
  description: string;
  duration_minutes: number;
  questions: SeedQuestion[];
};

const SAMPLE_QUIZZES: SeedQuiz[] = [
  {
    title: 'CUET General Test - Quant Basics',
    description: 'Arithmetic and number system basics for CUET practice.',
    duration_minutes: 15,
    questions: [
      {
        question: 'If 25% of a number is 45, what is the number?',
        options: ['120', '150', '180', '200'],
        correct_option_index: 2,
        explanation: 'Let number be x. 25% of x = 45 => x = 45 / 0.25 = 180.'
      },
      {
        question: 'The LCM of 12 and 18 is:',
        options: ['24', '36', '48', '54'],
        correct_option_index: 1,
        explanation: 'Prime factors: 12=2^2*3, 18=2*3^2. LCM=2^2*3^2=36.'
      },
      {
        question: 'A train covers 120 km in 2 hours. Its speed is:',
        options: ['40 km/h', '50 km/h', '60 km/h', '70 km/h'],
        correct_option_index: 2,
        explanation: 'Speed = distance/time = 120/2 = 60 km/h.'
      },
      {
        question: 'If x:y = 3:5 and x = 24, y is:',
        options: ['32', '36', '40', '44'],
        correct_option_index: 2,
        explanation: '3 parts = 24 => 1 part = 8. Then y = 5 parts = 40.'
      },
      {
        question: 'Simple interest on ₹1000 at 10% per annum for 2 years is:',
        options: ['₹100', '₹150', '₹200', '₹250'],
        correct_option_index: 2,
        explanation: 'SI = (P*R*T)/100 = (1000*10*2)/100 = 200.'
      }
    ]
  },
  {
    title: 'CUET Language & Reasoning Basics',
    description: 'English usage and logical reasoning foundational set.',
    duration_minutes: 15,
    questions: [
      {
        question: 'Choose the correctly spelled word.',
        options: ['Accomodate', 'Acommodate', 'Accommodate', 'Acomodate'],
        correct_option_index: 2,
        explanation: '“Accommodate” has double c and double m.'
      },
      {
        question: 'Find the odd one out: 2, 6, 12, 20, 30, 42, 52',
        options: ['20', '30', '42', '52'],
        correct_option_index: 3,
        explanation: 'Pattern n(n+1): 1*2=2,2*3=6,3*4=12,...6*7=42; next should be 7*8=56, not 52.'
      },
      {
        question: 'If all roses are flowers and some flowers are red, then:',
        options: [
          'All roses are red',
          'Some roses are definitely red',
          'No rose is red',
          'No definite conclusion about roses being red'
        ],
        correct_option_index: 3,
        explanation: 'Given statements do not guarantee overlap between roses and red flowers.'
      },
      {
        question: 'The synonym of “brief” is:',
        options: ['Lengthy', 'Short', 'Complex', 'Ancient'],
        correct_option_index: 1,
        explanation: 'Brief means short in duration or length.'
      },
      {
        question: 'Complete series: A, C, F, J, O, ?',
        options: ['S', 'T', 'U', 'V'],
        correct_option_index: 2,
        explanation: 'Positions increase by +2,+3,+4,+5, so next +6 from O(15) = U(21).'
      }
    ]
  }
];

async function insertQuizWithQuestions(client: PoolClient, quiz: SeedQuiz): Promise<void> {
  const quizInsert = await client.query<{ id: number }>(
    `INSERT INTO quizzes (title, description, duration_minutes, is_published)
     VALUES ($1, $2, $3, true)
     RETURNING id`,
    [quiz.title, quiz.description, quiz.duration_minutes]
  );

  const quizId = quizInsert.rows[0].id;

  for (const [idx, q] of quiz.questions.entries()) {
    await client.query(
      `INSERT INTO quiz_questions
       (quiz_id, question_text, options, correct_option_index, explanation, question_order)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6)`,
      [quizId, q.question, JSON.stringify(q.options), q.correct_option_index, q.explanation, idx + 1]
    );
  }
}

export async function seedDatabase(): Promise<void> {
  const countResult = await dbQuery<{ count: string }>('SELECT COUNT(*)::text AS count FROM quizzes');
  const quizCount = Number(countResult.rows[0]?.count ?? '0');

  if (quizCount > 0) {
    return;
  }

  await withTransaction(async (client) => {
    for (const quiz of SAMPLE_QUIZZES) {
      await insertQuizWithQuestions(client, quiz);
    }
  });
}
