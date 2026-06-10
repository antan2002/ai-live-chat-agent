## Setup

### Prerequisites

- **Node.js** 18+ (uses `crypto.randomUUID()`)
- **PostgreSQL** running locally on default port 5432
- An **OpenRouter API key** (free, sign up at [openrouter.ai/keys](https://openrouter.ai/keys))

### 1. Create the database

```bash
createdb spur_chat
```

Or via psql:

```bash
psql -U postgres -c "CREATE DATABASE spur_chat;"
```

### 2. Backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
- Set `OPENROUTER_API_KEY` to your key from OpenRouter
- Set `DATABASE_URL` if your PostgreSQL config differs

```bash
npm install
npm run dev
```

The backend starts on `http://localhost:3001`. Tables are created automatically on first run.

### 3. Frontend

```bash
# from project root
cp .env.example .env
npm install
npm run dev
```

The frontend starts on `http://localhost:5173`. It proxies API calls to the backend via `VITE_API_URL` in `.env`.

### Verifying it works

Open `http://localhost:5173` in a browser. Type a message like "What's your return policy?" — the AI should respond.

---

## Architecture

### Backend Layers

| Layer          | Responsibility                                            | File                 |
| -------------- | --------------------------------------------------------- | -------------------- |
| **Routes**     | HTTP handling, input validation, request/response shaping | `routes/chat.ts`     |
| **Services**   | LLM integration, prompt building                          | `services/llm.ts`    |
| **Data**       | PostgreSQL queries via `pg` Pool, table init              | `db/index.ts`        |
| **Middleware** | CORS configuration                                        | `middleware/cors.ts` |
| **Entry**      | Server startup, health check, graceful shutdown           | `index.ts`           |

Each layer depends only on the one below it. Routes call Services and Data; Services only touch the LLM API; Data owns all SQL.

### Frontend Architecture

- **Single custom hook** (`useChat`) manages all chat state — no Redux, no Context API. Correct for this scope.
- **Session persistence** via `localStorage` — survives page refresh.
- **Optimistic UI updates** — user message appears immediately, before the API responds.
- **All styling** in one global CSS file (`App.css`) — Tailwind CSS 4 is installed but unused in JSX.
- **No router** — single-page app, one view.

### File Structure

**Backend**

```
backend/
├── src/
│   ├── index.ts              Server entry, Express setup, CORS, graceful shutdown
│   ├── routes/chat.ts        POST /chat/message, GET /conversations, GET /history/:sessionId
│   ├── services/llm.ts       generateReply, summarizeForSidebar, system prompt
│   ├── db/index.ts           pg Pool, ensureTables, all SQL queries
│   ├── middleware/cors.ts    CORS configuration
│   └── types/chat.ts         TypeScript interfaces (Message, ChatRequest)
├── .env.example
└── package.json
```

**Frontend**

```
src/
├── main.tsx                  React entry point
├── App.tsx                   Root component
├── App.css                   All styles (477 lines)
├── pages/
│   └── ChatPage.tsx          Layout: sidebar + message list + input
├── components/
│   ├── ChatHeader.tsx        Agent name, online status
│   ├── ChatMessage.tsx       Message bubble + option chips
│   ├── ChatInput.tsx         Textarea with auto-resize, Enter to send
│   ├── TypingIndicator.tsx   Animated dots during loading
│   └── SuggestedQuestions.tsx FAQ suggestion chips
├── hooks/
│   └── useChat.ts            Central state: messages, send, switchConversation, newChat
├── services/
│   └── chatApi.ts            HTTP client: sendMessage, fetchConversations, fetchHistory
└── types/
    └── chat.ts               Message, ChatState interfaces
```

### Key Design Decisions

1. **Raw SQL, no ORM** — For 2 tables, an ORM adds complexity with no real benefit. Parameterized queries are clearer and faster here.
2. **OpenRouter instead of direct OpenAI/Anthropic** — More on this in the LLM section below.
3. **No streaming** — The spec doesn't require it, and a half-working streaming implementation is worse than none. The trade-off is that users wait for the full response.
4. **sessionId as conversation identifier** — No auth, no user accounts. A UUID in `localStorage` is simple and sufficient.
5. **Optimistic user message rendering** — If the API call fails, the user's message stays visible with an error banner instead of silently disappearing.

---

## LLM Integration

### Why OpenRouter

I went with [OpenRouter](https://openrouter.ai) rather than calling OpenAI or Anthropic directly, and the reason is straightforward: neither offers a genuinely free tier for testing.

- **OpenAI** requires a paid plan to use GPT-4 or GPT-3.5 beyond the initial trial credits, which expire.
- **Anthropic (Claude)** has no free API tier at all — you need to add billing before you can make a single call.
- **Google Gemini** does have a free tier, but the token limits are tight enough that they run out quickly during development and testing.

OpenRouter gives a single API key that routes to 200+ models, including several genuinely free ones with no billing setup. This means anyone reviewing the project can sign up, get a free key, and run it without entering a credit card. That felt like the right call for a take-home assignment.

The model used by default is `google/gemini-2.0-flash-exp:free` — fast, capable, and free. Swapping models is a one-line env var change.

### Prompt Strategy

- **System prompt** (~90 lines) defines Spur as a customer engagement platform with knowledge about messaging channels, integrations, bulk campaigns, billing, and account settings
- **Tone rules** — Be warm and natural, use plain text (no markdown), use "happy" and "sorry" naturally, ban on filler phrases
- **Few-shot examples** — Q&A pairs at the end of the system prompt to steer format, length, and when to ask clarifying questions
- **Clarifying questions** — When the customer's request is ambiguous, the AI asks a clarifying question and provides clickable option chips instead of guessing
- **Length cap** — "Keep responses under 4 sentences unless a list is genuinely clearer"
- **Up to 20 messages** of conversation history included for context
- **Temperature: 0.3** — keeps answers grounded and consistent
- **Max tokens: 1024** — enough for any support reply
- **Sidebar summarization** — First user message summarized to 4-5 words via separate LLM call, stored in `metadata.preview`

### Error Handling

- LLM timeout/error → friendly fallback message, request doesn't crash
- Missing API key → error thrown, caught by route handler → 500 with a message
- Invalid model name → OpenRouter returns 4xx → caught and logged
- 30-second fetch timeout via `AbortController`

---

## API Reference

| Method | Endpoint                   | Body                                      | Returns                                                               |
| ------ | -------------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| `POST` | `/chat/message`            | `{ message: string, sessionId?: string }` | `{ reply: string, sessionId: string, options?: string[] }`            |
| `GET`  | `/chat/conversations`      | —                                         | `[{ id, preview, created_at }]`                                       |
| `GET`  | `/chat/history/:sessionId` | —                                         | `[{ id, conversation_id, sender, text, created_at }]`                 |

The spec requires only `POST /chat/message`. The other two endpoints power the conversation sidebar and history restore on reload.

**Validation:**

- `message` required, non-empty, max 10,000 characters
- `sessionId` optional — if missing or empty, a new UUID is generated
- `GET /history/:sessionId` rejects an empty `sessionId` with 400

---

## Trade-offs & If I Had More Time

### What was left out

| Trade-off                  | Why                                                                                                                                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No tests**               | Time constraint. Would add Vitest + React Testing Library for the frontend, Supertest + Jest for the backend.                                                                                                    |
| **Sidebar summarization adds an extra LLM call per conversation** | The first user message triggers a separate summarization request. Could batch it with the main reply call, or generate previews client-side from the reply text.                            |
| **No accessibility**       | `aria-label` on the toggle and send button only. Would add ARIA live regions, keyboard nav, and proper focus management.                                                                                         |
| **No streaming**           | The spec doesn't ask for it. Streaming improves perceived speed but adds real complexity: partial state management, assembling the full reply before saving to DB. Not worth the risk of a buggy implementation. |
| **Single CSS file**        | Works fine for this scope. Would split into per-component CSS modules for anything larger.                                                                                                                       |
| **Tailwind unused in JSX** | Installed as a dependency but not used. Would either remove it or migrate all styles to Tailwind utilities.                                                                                                      |

### If I had more time

1. **Rate limiting** — `express-rate-limit` on the `/chat/message` endpoint to prevent LLM abuse
2. **Conversation metadata** — Store browser info, referrer, etc. in the `metadata` JSONB column for basic analytics
3. **Conversation search** — Full-text search on messages via PostgreSQL `tsvector`
4. **Multi-channel abstraction** — The LLM service is already decoupled from the routes; it would be straightforward to plug the same `generateReply()` function into a WhatsApp or Instagram handler
5. **Admin dashboard** — Simple page to view all conversations, reply manually, toggle AI on/off
6. **File attachments** — Image/file upload in chat with a vision-capable model
7. **Redis caching** — Cache conversation history lookups for faster responses on warm sessions
8. **Mobile layout** — Basic breakpoint is in, but the sidebar overlay needs more work on small screens

---

## Known Gaps

- **No tests** — Would add Vitest + React Testing Library for the frontend, Supertest for the backend.
- **No auth** — API is fully open. Production would need API key or JWT auth.
- **No accessibility audit** — Minimal ARIA labels only.
- **No HTTPS** — Dev only. Production would sit behind nginx or Caddy, or use platform TLS (Render handles this automatically).
