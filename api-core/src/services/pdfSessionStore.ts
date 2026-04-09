import { randomUUID } from 'node:crypto';
import type { UploadSession } from '../types/pdfQuiz.js';

const sessions = new Map<string, UploadSession>();
const TTL_MS = 1000 * 60 * 20;

function cleanup() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > TTL_MS) {
      sessions.delete(id);
    }
  }
}

export function createUploadSession(data: Omit<UploadSession, 'id' | 'createdAt'>): UploadSession {
  cleanup();
  const session: UploadSession = {
    ...data,
    id: randomUUID(),
    createdAt: Date.now()
  };
  sessions.set(session.id, session);
  return session;
}

export function getUploadSession(uploadId: string): UploadSession | undefined {
  cleanup();
  return sessions.get(uploadId);
}
