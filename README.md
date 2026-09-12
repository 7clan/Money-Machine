# Money Machine — Autonomous Content Production Agent

Money Machine is an experimental **autonomous content-production system** built to study how an AI-driven workflow can research, plan, produce, review, publish, and learn from its own outputs while remaining controllable and auditable.

Despite the repository name, the engineering focus is not a claim of guaranteed revenue. The project is primarily about **agent orchestration, reliability, safety gates, artifact durability, and feedback-driven automation**.

## What the system does

The core agent coordinates an end-to-end workflow:

1. Research and score candidate content niches.
2. Select a niche and generate a channel strategy.
3. Choose a topic and gather supporting research.
4. Generate a script and production plan.
5. Produce narration and visual assets.
6. Render a video and thumbnail.
7. Run quality, policy, factual, and duration checks.
8. Upload or hold the result according to the active operating mode.
9. Collect analytics when available.
10. Feed those observations back into later strategy decisions.

The implementation is organized as separate engine modules for research, niche scoring, strategy, scripting, rendering, review, publishing, analytics, job scheduling, operating modes, and artifact persistence.

## Reliability and control

A major goal of this project was to avoid treating an autonomous agent as a single opaque `generate-and-upload` call. The code instead uses explicit controls around execution:

- **Operating modes** separate dry-run/private/reviewed/autonomous behavior.
- **Emergency stop and pause/resume controls** can interrupt the agent loop.
- **Persistent job queue** supports scheduled work, retry, and backoff.
- **Publishing gates** keep factual review, quality review, duration integrity, physical-file checks, creative-lock checks, and privacy/mode checks independent.
- **Audit logs and state persistence** record what the agent is doing and what it plans to do next.
- **Artifact tracking** records generated files, hashes, validation state, and persistence state.
- **Analytics ingestion** is designed to use real platform data rather than fabricated metrics.

## Architecture

```text
Niche Research
     ↓
Channel Strategy
     ↓
Topic Research
     ↓
Script Generation
     ↓
Media Production
     ↓
Quality / Fact / Policy Gates
     ↓
Review or Publishing
     ↓
Analytics Collection
     ↓
Strategy Feedback
```

Representative engine modules live under `src/engine/`:

```text
agent.ts
analytics-agent.ts
artifact-store.ts
emergency-stop.ts
job-queue.ts
niche-research.ts
operating-mode.ts
publishing-safety-gate.ts
quality-review.ts
research.ts
script-writer.ts
video-renderer.ts
```

## Technical stack

- Next.js 16 / React 19 / TypeScript
- Prisma + SQLite
- Remotion and FFmpeg-based production tooling
- Z.AI SDK integration for model-backed generation tasks
- YouTube OAuth/upload/analytics integration
- GitHub Releases support for off-machine artifact persistence

## Artifact durability

The project distinguishes temporary workspace files from durable copies. Final outputs can be registered with hashes, validated, persisted locally, and optionally copied off-machine. A reconstruction workflow was also added to regenerate a final production from preserved creative intent while verifying script/visual hashes and duration integrity.

This was introduced after discovering that an application-level "persistent" directory was still on the same machine and therefore was not truly durable against workspace loss.

## Security and credentials

Real credentials are expected through local environment variables and are not part of the documented setup. `.env.example` contains placeholders only. OAuth/database runtime material is excluded from normal source tracking.

The repository history also records security-hardening work performed during development, including removal of accidentally logged credential material and tightening of ignore rules. That history is intentionally not rewritten here to create a cleaner-looking development story; the important engineering lesson was to improve secret handling and persistence boundaries after the issue was discovered.

## Development approach

This project was built with **AI-assisted development tools** as implementation accelerators. The repository's work log deliberately records agent-assisted tasks. The project should therefore be read as evidence of system design, requirements decomposition, architecture, debugging, validation, integration, and iterative engineering—not as a claim that every source line was manually typed without assistance.

## Current status

The repository contains a working autonomous pipeline, review tooling, publishing controls, artifact storage logic, and analytics infrastructure. Some external capabilities still depend on user-owned service configuration such as OAuth credentials and platform permissions.

The most useful part of the project is the set of engineering patterns around **controlled autonomy**: explicit state, independent gates, auditability, retries, durable artifacts, and feedback loops.

## Running locally

Install dependencies and create a local environment file from `.env.example`:

```bash
bun install
cp .env.example .env
```

Generate/push the local Prisma schema, then start the application:

```bash
bun run db:generate
bun run db:push
bun run dev
```

Agent CLI helpers include:

```bash
bun run agent:status
bun run agent:start
bun run agent:pause
bun run agent:resume
bun run agent:stop
bun run agent:produce-next
```

External publishing/analytics functions require the corresponding user-owned credentials and permissions.
