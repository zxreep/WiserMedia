export type OutputMode = 'telegram' | 'json';

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_option_id: number;
  explanation: string;
}

export interface GeneratedPayload {
  key_points: string[];
  questions: QuizQuestion[];
}

export interface UploadSession {
  id: string;
  fileName: string;
  createdAt: number;
  chunks: string[];
  chunkCount: number;
  characterCount: number;
}

export interface ProcessUploadBody {
  uploadId: string;
}

export interface GenerateQuizBody {
  uploadId: string;
  aiApiKey: string;
  aiModel: string;
  outputMode: OutputMode;
  botToken?: string;
  chatId?: string;
}

export interface AddQuizBody {
  title: string;
  description?: string;
  key_points?: string[];
  questions: Array<{
    question_text?: string;
    question?: string;
    options: string[];
    correct_option_id: number;
    explanation: string;
    question_order?: number;
  }>;
}


export interface RouteRequestBody {
  provider: 'nvidia';
  path: string;
  method?: 'GET' | 'POST';
  apiKey: string;
  payload?: Record<string, unknown>;
}

export interface SendTelegramBody {
  quizId: number;
  botToken: string;
  chatId: string;
}
