import pdfParse from 'pdf-parse';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const CHUNK_SIZE = 3500;

export async function extractPdfText(buffer: Buffer) {
  if (!buffer.length) {
    throw new Error('invalid pdf');
  }
  if (buffer.length > MAX_SIZE_BYTES) {
    throw new Error('pdf too large');
  }

  let parsed;
  try {
    parsed = await pdfParse(buffer);
  } catch {
    throw new Error('invalid pdf');
  }

  const text = parsed.text?.replace(/\s+/g, ' ').trim();
  if (!text) {
    throw new Error('pdf has no extractable text');
  }

  const chunks = chunkText(text, CHUNK_SIZE);
  return { text, chunks };
}

function chunkText(input: string, size: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < input.length) {
    const end = Math.min(start + size, input.length);
    chunks.push(input.slice(start, end));
    start = end;
  }
  return chunks;
}
