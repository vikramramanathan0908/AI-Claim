# AI-Claim

An AI-driven insurance claims processing pipeline. An EDI claim document goes in, and a final **APPROVED / DENIED** decision comes out — with an optional human-in-the-loop review step. Progress is streamed to the frontend in real time via Server-Sent Events (SSE).

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Python + FastAPI |
| AI / Agents | LangGraph + LangChain + OpenAI |
| RAG | Supabase pgvector (`text-embedding-3-small`) |
| Deployment | Vercel (`vercel.json` experimentalServices) |

## Project Structure

```
AI-Claim/
├── frontend/          # React + Vite app
│   └── src/
│       ├── pages/     # Landing.tsx, Console.tsx
│       └── components/# Navbar.tsx, Footer.tsx
├── backend/
│   ├── main.py        # FastAPI app, /api/process + /api/resume
│   ├── pipeline/      # orchestrator.py — drives the full pipeline
│   ├── graph/         # LangGraph state machine (builder, nodes, edges, state)
│   ├── agents/        # intake_agent, decision_agent, payment_agent
│   ├── rag/           # rules_retriever.py — Supabase pgvector RAG
│   ├── phi/           # phi_masker.py — PHI masking before any LLM call
│   ├── parser/        # edi_parser.py
│   └── db/            # setup.sql — Supabase schema
├── vercel.json
└── .env               # OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
```

## Setup

### 1. Environment variables

Create a `.env` file at the repo root:

```
OPENAI_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Runs on `http://localhost:8000`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`.

## How It Works

1. User pastes an EDI claim on the Console page and submits.
2. `/api/process` streams SSE events: `parsed → rules → node → interrupted|done`.
3. The LangGraph pipeline runs: `intake → decision → [human_review] → payment|denial`.
4. If the decision agent flags the claim for human review, an `interrupted` event is sent and the frontend shows a review prompt.
5. The reviewer clicks APPROVE or DENY → `/api/resume` resumes the graph and streams the final result.

### PHI Masking
Sensitive fields are masked via `phi/phi_masker.py` before any data touches an LLM or the RAG retriever. The `token_map` is kept server-side to unmask values when needed.

### RAG
Insurance rule `.txt` files in `backend/data/rules/` are chunked, embedded with `text-embedding-3-small`, and stored in a Supabase `rule_chunks` table. On first startup the table is populated automatically; subsequent restarts skip re-embedding. Retrieval uses cosine similarity via the `match_rule_chunks` Postgres function (top-4 chunks).

## Deployment

Deployed on Vercel via `vercel.json`:
- Frontend → `/`
- Backend → `/_/backend`
