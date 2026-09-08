# Architecture

## Requested stack
- `enterprise` — Angular 19 (standalone/signals-ready) frontend + NestJS 10 backend with tRPC + Prisma/PostgreSQL.

## Scaffolding status
- **enterprise**: ✅ newly scaffolded from `template-enterprise` (project was greenfield — only `README.md` and `.github/workflows/colossus-deploy.yml` existed).

## Layout
- `frontend/` — Angular app (`ng` project name: `frontend`). Entry: `frontend/src/app/app.component.ts`. Home route: `frontend/src/app/home/home.component.ts`, calls the tRPC client (`TRPC_CLIENT` token in `app.config.ts`) to list users.
- `backend/` — NestJS app. REST: `backend/src/health/health.controller.ts` (`GET /health`, Terminus-based). tRPC: `backend/src/users/users.router.ts` (`users.findAll`, `users.findById`), wired through `backend/src/trpc/trpc.router.ts`.
- `backend/prisma/` — Prisma schema/migrations (Postgres).
- `.pipeline/surface.json` — generated contract of routes/components/`data-testid`s for the test_spec and Playwright agents.
- `.colossus-acceptance.json` — acceptance contract for the post-deploy render gate (`ready_testid: app-ready`; `reject_signatures` catch the untouched template stub).
- `colossus.yaml` — build manifest for deploy agents (Angular frontend, NestJS backend, ports, output dirs).
- `docker-compose.yml` — local Postgres + pgAdmin.

## Plan alignment note
The scope agent's plan describes a different two-workspace layout in places (S3-backed storage, single-container multi-stage Docker build, JWT auth, posts/comments/follows/moderation domain). That plan's **features** are to be implemented on top of this fixed `enterprise` scaffold (Angular + NestJS + tRPC + Prisma/Postgres) per the stack contract — do not replace the framework, ORM, or routing layer (tRPC) with the plan's suggested alternatives (e.g. plain REST controllers, raw `pg`, a custom multi-stage root Dockerfile bypassing the template's per-service Dockerfiles) unless required to satisfy a spec requirement that is otherwise unimplementable.

## Next steps for the developer / coder agent
1. Copy env templates if/when added (`backend/.env` from `backend/.env.template`) — none exist yet in this template; configure `DATABASE_URL` and any `S3_*` vars needed for image storage directly in `backend/.env` per the plan.
2. `docker-compose up -d` to start Postgres locally (pgAdmin on `:5050`).
3. `cd backend && npx prisma migrate dev` to apply the schema once it is extended per the plan's data model (User/Post/Comment/Follow/Like/Report).
4. Extend `.pipeline/surface.json` as new routes/components/test IDs are added — the coder agent should keep it in sync since Playwright/test_spec agents read it as the source of truth.
5. Fill `expect_text` in `.colossus-acceptance.json` once the real front page (e.g. explore feed / SnapGram branding) replaces the template's default "Users" list.
6. Implement the plan's domain modules (auth, users, posts, comments, follows, reports, moderation, storage) inside `backend/src/`, and the corresponding Angular routes/components inside `frontend/src/app/`, keeping `frontend/package.json` dependencies verbatim unless a new dependency is genuinely required.

## Template sources
- `enterprise` ← `/app/scaffold-templates/template-enterprise/`
