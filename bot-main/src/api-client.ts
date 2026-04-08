import axios from 'axios';
import { config } from './config.js';

type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type AuthUser = {
  user_id: number;
  name: string;
  xp: number;
  role: string;
};

export type Quiz = {
  id: number;
  title: string;
  description: string;
  duration_minutes: number;
  question_count: number;
};

export type QuizQuestion = {
  id: number;
  question: string;
  options: string[];
};

export type QuizStartData = {
  attempt_id: number;
  questions: QuizQuestion[];
};

export type QuizSubmitInput = {
  attempt_id: number;
  answers: Array<{ question_id: number; selected_option: number }>;
};

export type QuizSubmitResult = {
  score: number;
  correct: number;
  total: number;
  xp_earned: number;
};

export type LeaderboardData = {
  users: Array<{ name: string; xp: number }>;
};

const api = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 10000
});

function unwrap<T>(payload: ApiEnvelope<T>): T {
  if (!payload.success) {
    throw new Error(payload.error);
  }

  return payload.data;
}

export async function authUser(input: {
  telegram_id: string;
  username?: string;
  first_name?: string;
}): Promise<AuthUser> {
  const response = await api.post<ApiEnvelope<AuthUser>>('/auth/telegram', input);
  return unwrap(response.data);
}

export async function getQuizzes(): Promise<Quiz[]> {
  const response = await api.get<ApiEnvelope<{ quizzes: Quiz[] }>>('/quizzes');
  return unwrap(response.data).quizzes;
}

export async function startQuiz(quizId: number, userId: number): Promise<QuizStartData> {
  const response = await api.post<ApiEnvelope<QuizStartData>>(`/quizzes/${quizId}/start`, {
    user_id: userId
  });
  return unwrap(response.data);
}

export async function submitQuiz(quizId: number, input: QuizSubmitInput): Promise<QuizSubmitResult> {
  const response = await api.post<ApiEnvelope<QuizSubmitResult>>(`/quizzes/${quizId}/submit`, input);
  return unwrap(response.data);
}

export async function submitWebAppQuiz(input: QuizSubmitInput): Promise<QuizSubmitResult> {
  const response = await api.post<ApiEnvelope<QuizSubmitResult>>('/webapp/submit', input);
  return unwrap(response.data);
}

export async function getLeaderboard(): Promise<LeaderboardData> {
  const response = await api.get<ApiEnvelope<LeaderboardData>>('/leaderboard/global');
  return unwrap(response.data);
}

export async function requestMentorship(userId: number) {
  const response = await api.post<ApiEnvelope<{ id: number; mentor_user_id: number | null }>>('/mentorship/requests', {
    user_id: userId
  });
  return unwrap(response.data);
}
