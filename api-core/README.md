# api-core (Fastify + PostgreSQL + PDF Quiz Generator)

Full-stack service that converts uploaded PDFs into CUET-focused notes + difficult MCQs, stores quiz data in Neon, and optionally sends quiz polls to Telegram.

## What is included
- Backend API with modular routes/controllers/services.
- Frontend UI is provided via `src/public/pdf-quiz-generator.html` and served at `/pdf-quiz-generator.html` (root redirects there).
- PDF text extraction (no OCR) + chunked sequential AI processing.
- AI generation for key points + structured MCQs using NVIDIA API.
- Generated quiz is stored in existing `quizzes` and `quiz_questions` tables so it appears in `Start Quiz` flows.
- JSON ingestion endpoint to add quizzes directly from structured payload.
- Telegram Quiz Poll delivery with `correct_option_id` + explanation.
- Render deployment config (`render.yaml`).

## Environment variables
Required:
- `DATABASE_URL`

Optional:
- `PORT` (default `3000`)
- `NODE_ENV` (`development` or `production`)

## AI configuration
- AI base URL is fixed in code to NVIDIA endpoint: `https://integrate.api.nvidia.com/v1/chat/completions`.
- AI model is selected by the user from the web UI per request.
- NVIDIA API key is provided by the user on the web UI per request.

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
- `POST /pdf-quiz/add-quiz-json`
- `POST /pdf-quiz/request-router` (server-side proxy for NVIDIA requests to avoid browser CORS blocks)
- `POST /pdf-quiz/send-telegram`

### Add quiz via JSON payload
`POST /pdf-quiz/add-quiz-json`

```json
{
  "title": "CUET Practice: Thermodynamics",
  "description": "Concept-heavy mixed difficulty",
  "questions": [
    {
      "question_text": "...",
      "options": ["A", "B", "C", "D"],
      "correct_option_id": 2,
      "explanation": "..."
    }
  ]
}
```

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


### Request router (CORS-safe proxy)
`POST /pdf-quiz/request-router`

```json
{
  "provider": "nvidia",
  "path": "/chat/completions",
  "method": "POST",
  "apiKey": "nvapi-...",
  "payload": { "model": "meta/llama-3.1-70b-instruct", "messages": [{ "role": "user", "content": "hello" }] }
}
```
