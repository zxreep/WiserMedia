# bot-main (grammY + Fastify webhook)

Production-ready Telegram bot service for CUET Prep that connects directly to `api-core`.

## Features
- `/start` onboarding and Telegram auth via `POST /auth/telegram`
- Inline main menu callbacks (no text matching)
- Quiz flow: list -> launch dynamic web quiz hosted by the same bot service (`/quiz`)
- Leaderboard view
- Mentorship request flow
- Premium locked feature prompt
- Webhook mode for Render

## Project structure

```txt
src/
  bot.ts
  api-client.ts
  config.ts
  handlers/
    start.ts
    quiz.ts
    leaderboard.ts
    mentorship.ts
  keyboards/
    mainMenu.ts
    quiz.ts
```

## Environment
Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Required variables:
- `BOT_TOKEN`
- `API_BASE_URL`
- `WEBHOOK_URL` (must be full URL ending with `/telegram/webhook`)
- `PORT` (optional, default `3001`)

## Local run
1. Install deps:
```bash
npm install
```

2. Start dev server:
```bash
npm run dev
```

3. Build and run production mode:
```bash
npm run build
npm run start
```

## Webhook setup (Render)

### 1) Create Web Service
Create a Render Web Service pointing to `bot-main/`.

### 2) Commands
- Build: `npm install && npm run build`
- Start: `npm run start`

### 3) Environment variables
- `BOT_TOKEN`: Telegram bot token
- `API_BASE_URL`: your api-core URL
- `WEBHOOK_URL`: Render service public URL + `/telegram/webhook`
  - Example: `https://bot-main.onrender.com/telegram/webhook`
- `PORT`: Render injected or set manually

### 4) Health check
- `GET /health`

### 5) Telegram webhook route
- `POST /telegram/webhook`
- `GET /quiz` (serves `nta-mock-test.html` from this repository)

## Bot flow with api-core
1. User sends `/start`.
2. Bot extracts `telegram_id`, `username`, `first_name`.
3. Bot calls `POST {API_BASE_URL}/auth/telegram`.
4. Bot stores returned `user_id` in in-memory session map.
5. Bot sends welcome + inline menu.

### Quiz flow
1. Callback `start_quiz` -> `GET /quizzes`.
2. If empty: show “No quizzes” + refresh/leaderboard buttons.
3. For each quiz, bot sends a URL button to `{PUBLIC_BASE_URL}/quiz` with query params:
   - `quizId`
   - `userId`
   - `telegramId`
4. User takes quiz on the web app instead of answering questions in chat.

### Leaderboard flow
- Callback `show_leaderboard` -> `GET /leaderboard/global`

### Mentorship flow
- Callback `find_mentor` -> `POST /mentorship/requests`

## Error handling
All API calls are wrapped in `try/catch`. On failures bot responds with:
- `⚠️ Something went wrong. Please try again.`
