# LeadLens AI

Turn business cards into structured leads with AI. Bulk-upload business-card
images, extract structured fields with a Qwen vision-language model (VLM), review
and correct the results, and export an Excel workbook.

> **Read [Verification status](#verification-status) first.** It states exactly
> what has been tested and what has not. Qwen3-VL currently runs on a **Hugging Face
> ZeroGPU Space**, which is *not* AWS; it has **not** been deployed on AWS.

## Overview

LeadLens AI reads each card image directly with a Qwen VLM — there is no separate
OCR step and no hand-written extraction rules. Every field the model cannot see on
the card comes back `null` rather than guessed, and the UI flags those leads
"needs review".

## Features

- Drag-and-drop bulk upload (JPG / PNG / WEBP, up to 50 images per batch)
- Live per-card progress over Server-Sent Events; one bad card never fails a batch
- Qwen VLM extraction with schema validation, tolerant JSON recovery, and one retry
- In-batch duplicate-image detection (exact SHA-256 of the normalized image)
- Editable, searchable, sortable, filterable lead table; side-panel editor with the
  source image; status and counts recompute when you correct a lead
- Excel export: a `Leads` sheet with exactly the 7 required columns, plus a
  `Processing Summary` sheet
- Dark / light glassmorphism UI with persistence; responsive down to phone width
- Batch history (browser-local — see [Known limitations](#known-limitations))

## Architecture

```
Browser ── multipart upload ──▶ POST /api/extract   (Next.js Route Handler, SSE response)
                                   │  per image, 3 at a time:
                                   ├─ validate      type/size, sniffed with sharp (not the client's mime)
                                   ├─ preprocess    auto-rotate, sRGB, downscale only if > 2000 px
                                   ├─ dedupe        SHA-256 of the preprocessed image
                                   ├─ Qwen VLM      provider chosen by env (see below); zod-validated (one retry)
                                   ├─ normalize     trim; derive status (extracted / needs_review)
                                   └─ stream        card_started / completed / failed / duplicate … done
Browser ── edits leads ── POST /api/export ──▶ .xlsx
```

There is no database and no job queue: a batch runs inside one request with
limited concurrency and streams progress as it goes. That covers the stated scale
(≤ 50 images) but not arbitrarily large batches — see limitations.

### Where Qwen runs — three modes, one validation path

The app talks to an OpenAI-compatible endpoint, a Hugging Face Space, or the AI Gateway, chosen by env vars
(`src/lib/config/model.ts`):

| Mode | Selected when | What it is | Satisfies "Qwen deployed on AWS"? |
| --- | --- | --- | --- |
| **Self-hosted** | `QWEN_BASE_URL` is set | Your own server: **vLLM on AWS** (production target) or **Ollama** (local dev) | Yes, once deployed on AWS — **not yet done** |
| **Hugging Face Space** | `HF_SPACE_ID` set (and `QWEN_BASE_URL` empty) | `Qwen/Qwen3-VL-4B-Instruct` in a Gradio Space on **ZeroGPU**, called server-side via `@gradio/client` | **No.** Hugging Face, not AWS. Free, but has a small daily GPU quota (see below). |
| **Vercel AI Gateway** | both empty | Hosted Qwen via `alibaba/qwen3.5-flash` | **No.** Hosted inference, not a deployment. Kept only as a fallback. |

## Tech stack

The brief describes a React + FastAPI + Pydantic + AWS stack. This repository was
scaffolded as a **Next.js monolith** instead: route handlers play the backend role,
`zod` plays Pydantic's role, `sharp` replaces Pillow, and `exceljs` replaces
OpenPyXL. This is a deliberate substitution with real trade-offs (one process, no
Python service) — it does not by itself satisfy the deployment requirement; see
[Verification status](#verification-status).

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui ·
Vercel AI SDK (`generateObject`, `@ai-sdk/openai-compatible`) · zod · sharp ·
ExcelJS · Vitest.

## Qwen VLM

**Model (self-hosted target):** `Qwen/Qwen3-VL-4B-Instruct` — Apache-2.0, ~4.4B
parameters, image+text input (checked against the Hugging Face API). Served by
vLLM on AWS; locally by Ollama as `qwen3-vl:4b` (a **quantized Q4_K_M** build — not
byte-identical to the FP16 weights vLLM would serve, so accuracy on AWS may differ).

**Where it is configured:** env vars `QWEN_BASE_URL`, `QWEN_MODEL`, `QWEN_API_KEY`
→ `src/lib/config/model.ts` → `src/lib/services/qwen-service.ts`. The extraction
prompt is `src/lib/prompts/extraction-prompt.ts`; the output schema is
`src/lib/schemas/lead.ts`.

**Request / response flow:** the preprocessed JPEG is sent as an `image_url` part
with the system prompt and a JSON-schema `response_format`. The reply's `content`
is parsed against the zod schema; a reasoning-capable model may also return a
separate `reasoning` field, which is ignored.

**Missing fields:** every field is `string | null`. The prompt forbids inference;
the UI marks any lead with a missing field "needs review" and never fills it in.

**Malformed output** (`src/lib/utils/json-parser.ts`, tested in
`tests/integration/malformed-output.test.ts` against a fake OpenAI-compatible
server): clean JSON, whitespace-padded JSON, Markdown-fenced JSON and JSON inside
prose are recovered; truncated output, no JSON, and schema-violating types (e.g. a
numeric phone) are rejected. A rejected card is retried once, then marked
`failed` with a user-safe reason.

**Error classes** (`ExtractionError`): auth/billing (`401/402/403`, never retried),
unreachable server (retried once), rate-limited, unreadable model output, unknown.
Technical detail is logged server-side as JSON; users see a generic message.

### Hugging Face Space mode (current)

`hf-space/` is a Gradio app (`app.py`) that loads `Qwen/Qwen3-VL-4B-Instruct` in
bf16 and exposes one endpoint, `/extract` (image + prompts → raw model text +
GPU inference time). It runs on **ZeroGPU** (`zero-a10g` hardware flag). The Space
returns raw text only; **the Next.js server does all JSON extraction and zod
validation**, so every provider gets the same checks and a bad reply becomes a
failed card, never a made-up lead.

- The Space is **public** and works without a token; `HF_TOKEN` is optional and
  server-side only (it only changes whose daily quota is charged).
- The exact JSON key template is appended to the prompt on this path. Without it the
  model chose its own keys (`title`, `address`) and every card failed validation.
- **Quota is the real constraint.** ZeroGPU gives a free account about 5 GPU-minutes
  a day (2 anonymous). It checks the *requested* duration against what is left
  before running, so `@spaces.GPU(duration=…)` is set to 25 s (a first value of 60 s
  was rejected with 73 s left). When quota runs out the app reports
  `quota_exceeded` and does not retry.
- Because the Space is public, anyone can spend that quota.

Measured through `/api/extract` (3 cards concurrently, 2026-09-20): image
preparation 6–22 ms, model request 9.2–10.0 s wall-clock, **GPU inference 3.0–5.1 s**
inside the Space, parsing 0–1 ms. The gap is queueing/transfer. These are few
samples, not a benchmark, and a cold Space is slower (24–34 s seen).

## Project structure

```
src/app/api/{health,extract,export}/route.ts   API routes
src/app/{page,leads,history}                   Dashboard / upload+results / history
src/components/{layout,dashboard,upload,leads,ui}
src/hooks/use-extraction.ts                    upload state + SSE client
src/lib/{config,schemas,services,prompts,utils}
hf-space/                                      Gradio app for the Hugging Face Space
tests/{unit,api,integration,fixtures}
docker/                                        Dockerfile, compose (local + AWS), Caddyfile
docs/AWS_DEPLOYMENT.md                         AWS runbook (not executed)
```

## Local setup

```bash
npm install
cp .env.example .env.local
```

Run Qwen locally (real inference, on your machine):

```bash
ollama pull qwen3-vl:4b          # ~3.3 GB
# .env.local
QWEN_BASE_URL=http://localhost:11434/v1
QWEN_MODEL=qwen3-vl:4b
npm run dev
```

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `QWEN_BASE_URL` | For self-hosted | OpenAI-compatible base URL, e.g. `http://localhost:11434/v1` |
| `QWEN_MODEL` | With `QWEN_BASE_URL` | e.g. `qwen3-vl:4b` (Ollama) / `Qwen/Qwen3-VL-4B-Instruct` (vLLM). No default — the app refuses to guess. |
| `HF_SPACE_ID` | For Space mode | e.g. `prakhu23/leadlens-qwen3-vl`. Server-side only. |
| `HF_TOKEN` | Optional | Only for a private Space or to charge a specific account's quota. Server-side only, never `NEXT_PUBLIC_`. |
| `HF_SPACE_MODEL` | Optional | Display label only; the Space decides the real model |
| `QWEN_API_KEY` | Optional | Required in the AWS compose (vLLM `--api-key`) |
| `SITE_ADDRESS` | AWS compose only | DNS name Caddy serves over HTTPS |
| `AI_GATEWAY_API_KEY` / `AI_GATEWAY_MODEL` | Fallback only | Used when `QWEN_BASE_URL` is empty. Vercel AI Gateway needs a card on file. |
| `MAX_UPLOAD_IMAGES` | No (50) | Enforced server-side |
| `MAX_IMAGE_SIZE_MB` | No (8) | Enforced server-side, and via `Content-Length` before the body is buffered |

`.env*` is git-ignored except `.env.example`. No secrets are committed.

## API endpoints

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/health` | GET | `{status, provider, model, timestamp}` (never exposes the endpoint URL or keys) |
| `/api/extract` | POST | `multipart/form-data` (`files`, repeated). Streams SSE events, ending in one `done` event with summary + records. `413` if the declared body is too large; `400` for empty/oversized batches. |
| `/api/export` | POST | JSON `{leads, summary}` (≤ 1000 leads) → `.xlsx` |

The brief suggested `/api/v1/jobs/{id}` polling endpoints; this build streams
progress over SSE from a single request instead.

## Docker

```bash
docker compose -f docker/docker-compose.yml up --build      # http://localhost:3000
```

Multi-stage standalone build, runs as a non-root user. To reach an Ollama server on
the host, set `QWEN_BASE_URL=http://host.docker.internal:11434/v1`.

## AWS deployment

See [`docs/AWS_DEPLOYMENT.md`](docs/AWS_DEPLOYMENT.md). **It has not been
executed.** In short: one GPU EC2 instance (`g5.xlarge` suggested), running vLLM +
the app + Caddy via `docker/docker-compose.aws.yml`. This is **not free tier** and
will incur real charges; new accounts usually need a GPU-quota increase first.

## Usage

1. **Leads** → drag in card images → **Extract Leads**.
2. Watch per-card progress. Failed cards show their reason in the table.
3. Click (or focus + Enter) a row to edit it, with the source image beside it.
4. **Export Excel**, or reopen the batch later from **History**.

## Excel export

`Leads` has exactly: First Name, Last Name, Position / Job Title, Company,
Location, Phone Number, Email Address — one row per extracted or needs-review card
(failed and duplicate cards are omitted; missing values are empty cells).
`Processing Summary` has total / extracted / needs review / failed / duplicates /
processed-at. Cell text is written as strings, so a value like `=1+1` is never
evaluated as a formula (tested).

## Testing

```bash
npm test          # vitest run
npm run lint
npx tsc --noEmit
npm run build
```

**65 tests in 12 files, all passing** (last run 2026-09-20): unit (image
validation/preprocessing, normalization + status, summary, Excel, hashing,
concurrency, model config, JSON extraction, Qwen retry/classification), API
(health, export, extract incl. size guards and "one failed card doesn't crash the
batch"), and integration (real `generateObject` against a fake OpenAI-compatible
server returning malformed output) and the Space provider (mocked `@gradio/client`). Qwen is mocked or faked in tests — **no automated test
calls a real model**; live checks are listed below. There are **no automated UI tests**; the UI was verified by
hand (below).

## Verification status

Verified on 2026-09-20 on an Apple-silicon Mac (16 GB), Docker 28.5.2 (arm64):

| Claim | Evidence |
| --- | --- |
| Real Qwen3-VL extraction through the whole pipeline | Live run against local Ollama `qwen3-vl:4b`: on the full synthetic card, **all 7 fields correct**; on a card with no phone/location, both came back `null` (not invented); a corrupt file was rejected without failing the batch |
| Same, from inside the Docker image | Container → host Ollama gave identical results |
| Duplicate detection; degraded card | Identical copy skipped; a rotated + blurred + q30 card still extracted all 7 fields (one synthetic case — not evidence about real photos) |
| Excel structure | Generated from the live results and inspected by parsing the raw `.xlsx` XML: exact 7 headers, failed record omitted, blanks not invented |
| Docker | `docker build` exit 0; container runs non-root, `/api/health` OK, sharp works inside the slim image |
| UI | Dashboard/Leads/History, dark+light, theme persists across reload, multi-select, removal, progress, edit (status/counts recompute, persisted to History), search, sort, filter, empty and failed states, phone-width (400 px) layout via device emulation, row keyboard handler, zero console errors/warnings |

Verified live against the Hugging Face Space on 2026-09-20:

| Claim | Evidence |
| --- | --- |
| Real Qwen3-VL extraction on the reference card | `tests/fixtures/morgan-maxwell-card.png` (1654×951): all 7 fields matched what is printed on the card in 4/4 command-line runs (with and without a token), plus one HTTP-API run and one browser-UI run |
| 4-card batch through `/api/extract` | 2 extracted, 1 needs review (missing phone/location came back `null`), 1 corrupt file failed alone; batch completed |
| Full UI flow | upload → progress → table → edit (persisted to History after refresh) → Excel export; the downloaded `.xlsx` was re-read: exact 7 headers, edit included, blanks blank |
| Quota failure handling | A real `quota exceeded` reply from ZeroGPU was surfaced as its own error code and not retried |

**Not verified — do not assume these work:**

- **Phone-width layout after the latest layout change.** The browser tool could not
  produce a narrow viewport this session (window resize had no effect; iframes and
  popups were blocked), so only the earlier device-emulation check stands.

- **Qwen on AWS.** `docker/docker-compose.aws.yml` and the runbook were never run.
  No AWS credentials/CLI were available. **This is the biggest submission risk.**
- **vLLM specifics:** the pinned image tag, flags, and JSON-schema output *with*
  image input.
- **A public app URL.** The Space is public; the app itself is not yet deployed.
- **Vercel AI Gateway path.** A live call failed with `403 customer_verification_required`
  (no payment card on the Vercel team), so it was never validated end to end.
- **Real photographs.** Test cards are synthetic renders
  (`tests/fixtures/make-cards.mjs`) plus the one designed reference card above. Accuracy on real, messy photos is unmeasured.
- **Performance at scale.** Only a handful of ZeroGPU calls were timed (above); the local Ollama numbers (22–82 s per 2-card batch) are from a laptop with a quantized model.
- **x86 image.** The Docker image was built on arm64 only.
- **Real key presses / screen readers.** Row keyboard handling was verified via a
  dispatched event (the test tool cannot inject real keystrokes); no screen reader was used.
- **Row selection** (multi-select checkboxes) is not implemented.

## Known limitations

- **No database.** History lives in `localStorage` (last 20 batches, this browser
  only). Source images are not stored, so History shows extracted text without the
  original photo.
- **Duplicates are exact and in-batch only.** A near-identical re-photograph, or the
  same card in a later batch, is not detected.
- **One request per batch,** 3 cards at a time, capped by the function timeout
  (`maxDuration = 300` on hosts that honor it). Very large batches need a real queue.
- **Free GPU quota.** About 5 GPU-minutes/day per account on ZeroGPU; a large batch
  or repeated demo can exhaust it, after which cards fail with `quota_exceeded`
  until it resets. Not sized for production traffic.
- **No retry / "view image" action on failed cards yet.** A failed card can be
  edited by hand from the table; a one-click retry is not implemented.
- **No authentication or rate limiting.** A public deployment lets anyone consume
  model capacity; add auth or IP restrictions before sharing.
- **Accuracy depends on the image and model.** Handwriting, stylized fonts, glare,
  heavy rotation, multilingual cards and low resolution are unmeasured risks. The
  model is told to return `null` rather than guess, but a confident misread is possible.
- **Quantized local model ≠ AWS model.** Local results do not predict vLLM results.
- **Dependency audit:** `npm audit` reports 2 moderate findings, both `uuid` inside
  `exceljs`. The advisory concerns `uuid` v3/v5/v6 with a caller-supplied buffer;
  `exceljs` only calls `v4`, so it is not reachable here. The suggested "fix"
  downgrades `exceljs` to a 2019 release and was not applied.

## Future improvements

Deploy and validate the AWS path; measure accuracy on real cards; persist batches and
images (e.g. Postgres + object storage); move extraction to a durable queue;
perceptual hashing; authentication and rate limiting; row selection; UI tests.

## AI Usage

Built with [Claude Code](https://claude.com/claude-code) (Claude Sonnet 5).

- **Used for:** architecture and stack proposal, the Qwen model selection (checked
  against the live Vercel AI Gateway catalog and the Hugging Face API rather than
  guessed), the extraction prompt and schema, the API/service layer, the UI, the
  tests, the Docker/AWS files, and this documentation.
- **Adopted:** the pipeline (validate → preprocess → dedupe → extract → normalize →
  stream), SSE progress instead of job polling, client-side history instead of a
  database, and — after review — self-hosted Qwen on AWS as the production target.
- **Rejected / corrected during the build** (all found by running things, not by
  inspection):
  - The first README claimed the hosted-gateway design satisfied the "deploy Qwen"
    requirement. It does not; that claim was removed.
  - A code comment claimed the AI SDK already repaired fenced/prose-wrapped JSON.
    Testing showed it did not; a tested JSON extractor was added.
  - The Excel `Leads` sheet had an extra `Status` column and blank rows for failed
    cards; both were removed.
  - Billing/auth failures were shown as "try again" and retried; they are now
    classified, not retried, and reported honestly.
  - Status and summary counts did not update after manual edits; edits also weren't
    persisted to History. Both fixed.
  - The Hugging Face Space path first failed every card: the model invented its
    own JSON keys because the schema is not sent on that path. Fixed by putting the
    exact key template in the prompt.
  - ZeroGPU rejected calls that reserved 60 s when little quota remained; lowered
    the reservation to 25 s and added a distinct `quota_exceeded` error instead of
    the misleading "configuration or billing" message.
  - Mobile navigation was unreachable; table rows were not keyboard-accessible;
    progress showed the wrong denominator; several smaller issues.
- **Author's statement:** *[Author: before submitting, confirm that you have
  personally reviewed and understand all generated code — this sentence can only be
  truthfully made by you. Generated code was tested as described in
  [Testing](#testing).]*
