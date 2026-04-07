# api-core (Fastify + PostgreSQL)

Production-ready MVP backend service for Telegram-based CUET preparation.

## Features
- Telegram auth (`POST /auth/telegram`) with idempotent user creation.
- Quiz list/start/submit.
- XP ledger updates on quiz submit.
- Global leaderboard.
- Mentorship request + mentor acceptance.
- Premium status + manual premium upgrade endpoint.
- Automatic DB seeding of 2 sample quizzes (5 MCQs each) on startup.

## Project structure

```txt
src/
  server.ts
  app.ts
  routes/
  controllers/
  services/
  db/
  utils/
  types/
sql/
  schema.sql
```

## Environment variables
Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Required:
- `DATABASE_URL`: Neon PostgreSQL connection string.
- `PORT`: API port (default `3000`).

## Local setup
1. Install dependencies:
```bash
npm install
```

2. Run DB schema:
```bash
psql "$DATABASE_URL" -f sql/schema.sql
```

3. Start in dev mode:
```bash
npm run dev
```

On startup, service checks `quizzes` table and seeds sample data only if empty.

## API endpoints

### Health
- `GET /health`

### Auth
- `POST /auth/telegram`

Request body:
```json
{
  "telegram_id": "123456789",
  "username": "student1",
  "first_name": "Aman"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "user_id": 1,
    "name": "Aman",
    "xp": 0,
    "role": "student"
  }
}
```

### Quiz
- `GET /quizzes`
- `POST /quizzes/:id/start`
- `POST /quizzes/:id/submit`

Start request body:
```json
{ "user_id": 1 }
```

Submit request body:
```json
{
  "attempt_id": 10,
  "answers": [
    { "question_id": 101, "selected_option": 2 },
    { "question_id": 102, "selected_option": 1 }
  ]
}
```

### Leaderboard
- `GET /leaderboard/global`

### Mentorship
- `POST /mentorship/requests`
- `POST /mentorship/requests/:id/accept`

### Premium
- `GET /premium/status?user_id=1`
- `POST /premium/webhook/manual`

## Standard error format

```json
{
  "success": false,
  "error": "Message"
}
```

## Telegram bot integration flow (grammY)

### 1) `/start` flow
1. User sends `/start`.
2. Bot calls `POST /auth/telegram` with `telegram_id`, `username`, `first_name`.
3. Bot stores returned `user_id` in session (memory/redis/db).
4. Bot shows menu buttons:
   - 🎯 Start Quiz
   - 📊 My Progress
   - 🏆 Leaderboard
   - 🤝 Find Mentor

### 2) Start quiz flow
1. On 🎯, bot calls `GET /quizzes`.
2. Bot renders list of quizzes.
3. On user quiz selection, bot calls `POST /quizzes/:id/start` with `user_id`.
4. API returns `attempt_id` and questions.
5. Bot asks each question and captures options.

### 3) Submit flow
1. Bot collects answers array:
   - `{ question_id, selected_option }`
2. Bot calls `POST /quizzes/:id/submit`.
3. API returns score summary and `xp_earned`.
4. Bot displays result and XP earned.

### 4) Leaderboard flow
1. On 🏆, bot calls `GET /leaderboard/global`.
2. Bot displays top users (`name`, `xp`).

### 5) Mentorship flow
1. On 🤝, bot calls `POST /mentorship/requests` with `user_id`.
2. API auto-assigns highest-XP available mentor.
3. Bot confirms request creation.
4. Mentor-side bot action calls `POST /mentorship/requests/:id/accept` with `mentor_user_id`.

## Deploy on Render

### Service type
- Create a **Web Service** from `api-core` root.

### Build and start commands
- Build: `npm install && npm run build`
- Start: `npm run start`

### Environment variables
- `DATABASE_URL` (Neon connection string)
- `PORT` (Render injects or set manually)
- `NODE_ENV=production`

### First deploy checklist
1. Run schema manually once (via Neon SQL editor or `psql`).
2. Deploy service.
3. Verify `/health` endpoint.
4. Hit `/auth/telegram` from bot `/start` handler.
