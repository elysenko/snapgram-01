# SnapGram

Photo sharing — a public explore gallery, a following-based home feed, uploads with
likes and comments, and a moderation queue for reported posts.

## Layout

| Path        | What it is                                                              |
|-------------|-------------------------------------------------------------------------|
| `frontend/` | Angular 19 standalone SPA. Served by nginx, which proxies `/api/` on.    |
| `backend/`  | NestJS 11 REST API under the `/api` prefix, Prisma + PostgreSQL.         |
| `backend/prisma/` | Schema, migrations, and the essential (platform accounts) seed.   |

## Configuration

Every value is read from the environment. Nothing is hardcoded, and the app boots
without the optional keys — a missing integration degrades that one feature (HTTP
503 from `ServiceUnconfiguredError`) instead of crash-looping the pod.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string. |
| `JWT_SECRET` | yes | HS256 signing key for access tokens. |
| `PORT` | no (`3001`) | Port the API binds. |
| `S3_ENDPOINT` | for uploads | Object-storage endpoint. Also accepts `MINIO_ENDPOINT`. |
| `S3_BUCKET` | no (`snapgram`) | Bucket for post images and avatars. Created on boot if absent. |
| `S3_REGION` | no (`us-east-1`) | Region. Also accepts `MINIO_REGION` / `AWS_REGION`. |
| `S3_ACCESS_KEY_ID` | for uploads | Also accepts `MINIO_ROOT_USER` / `MINIO_ACCESS_KEY`. |
| `S3_SECRET_ACCESS_KEY` | for uploads | Also accepts `MINIO_ROOT_PASSWORD` / `MINIO_SECRET_KEY`. |
| `S3_FORCE_PATH_STYLE` | no (`true`) | Required by MinIO and most S3-compatible servers. |
| `COLOSSUS_ACCOUNTS_JSON` | at deploy | Platform-minted logins consumed by the seed. |

Any of these can also be set at runtime from **Admin → Settings**, which writes the
`SystemSetting` table; the resolver reads the environment first and falls back to
that row.

## Accounts

Logins are platform-owned. `prisma/seed/seed.js` reads `COLOSSUS_ACCOUNTS_JSON`
and upserts one `colossus_accounts` row plus one `User` per entry, hashing with
`bcryptjs` into the same `User.passwordHash` column the auth service compares.
It is idempotent — the password hash is re-asserted on every run — and it prints
roles only, never an email, password or hash. There are no demo or sample accounts,
and the seed writes no business data: every screen renders its empty state on a
fresh database.

Signing up through the app always creates a `USER`. The moderation queue requires
`ADMIN` (or `MODERATOR`).

## Local development

```bash
docker compose up -d                 # PostgreSQL

cd backend
npm install
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app
npx prisma generate
npx prisma migrate deploy
npm run start:dev                    # API on :3001, Swagger at /api/docs

cd ../frontend
npm install
npm start                            # SPA on :4200, proxying /api to :3001
```

## API

All routes are under `/api`. Browsable at `/api/docs`.

| Method | Route | Auth |
|---|---|---|
| `POST` | `/auth/signup`, `/auth/login` | public |
| `GET` | `/auth/me` | bearer |
| `GET` | `/users/:handle` | public (personalised when a token is sent) |
| `PATCH` | `/users/me` | bearer |
| `PUT` | `/users/me/avatar` | bearer |
| `POST`/`DELETE` | `/users/:handle/follow` | bearer |
| `POST` | `/posts` | bearer, multipart, JPEG/PNG ≤ 5 MB |
| `GET` | `/posts/explore`, `/posts/by/:handle`, `/posts/:id` | public |
| `GET` | `/posts/feed` | bearer |
| `PATCH`/`DELETE` | `/posts/:id` | bearer, author only |
| `POST` | `/posts/:id/like`, `/posts/:id/report` | bearer |
| `GET`/`POST` | `/posts/:id/comments` | public read, bearer write |
| `DELETE` | `/comments/:id` | bearer, author or moderator |
| `GET` | `/moderation/reports` | `ADMIN` / `MODERATOR` |
| `POST` | `/moderation/posts/:id/remove` | `ADMIN` / `MODERATOR` |
| `GET` | `/media/*key` | public — streams from object storage |
| `GET` | `/health`, `/health/deep` | public |

Uploads are validated by magic bytes, not by the client-supplied MIME type, and the
5 MB cap surfaces as `400`. Author deletion is a hard delete that cascades to likes,
comments and reports; moderator removal is a soft delete that also closes the post's
open reports, and every read path filters removed posts out.
