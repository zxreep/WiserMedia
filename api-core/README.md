# api-core (Fastify + PostgreSQL + PDF Quiz Generator)

Full-stack service that converts uploaded PDFs into CUET-focused notes + difficult MCQs, stores quiz data in Neon, and optionally sends quiz polls to Telegram.

## What is included
- Backend API with modular routes/controllers/services.
- Frontend webpage served at `/`.
- PDF text extraction (no OCR) + chunked sequential AI processing.
- AI generation for key points + structured MCQs.
- Neon persistence for generated quizzes and user activity (no PDF text stored).
- Telegram Quiz Poll delivery with `correct_option_id` + explanation.
- Render deployment config (`render.yaml`).

## Environment variables
Required:
- `DATABASE_URL`

Optional:
- `PORT` (default `3000`)
- `NODE_ENV` (`development` or `production`)
- `AI_BASE_URL` (default OpenAI chat completions endpoint)
- `AI_MODEL` (default `gpt-4o-mini`)

## Local setup
```bash
cd api-core
npm install
npm run build
npm run dev
```

Open `http://localhost:3000`.

## Main API routes
- `POST /pdf-quiz/upload-pdf` (multipart upload)
- `POST /pdf-quiz/process-pdf`
- `POST /pdf-quiz/generate-quiz`
- `POST /pdf-quiz/send-telegram`

## Notes on security
- API keys and Telegram credentials are entered by the user on the web UI.
- The UI stores those values in browser `localStorage` for convenience.
- No hardcoded secrets are used.
- Uploaded PDF text is processed in memory only and is not stored in DB.

## Deploy to Render
- Use the included `render.yaml` from repository root.
- Render will run:
  - Build: `npm install && npm run build`
  - Start: `npm run start`
- Set `DATABASE_URL` in Render environment variables.
- For AI provider changes, set `AI_BASE_URL` and `AI_MODEL`.
