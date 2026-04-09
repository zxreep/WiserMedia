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

export interface SendTelegramBody {
  quizId: number;
  botToken: string;
  chatId: string;
}
