# Pipeline Task Decomposition

## Summary
SnapGram is a photo-sharing social app built on the scaffolded `enterprise` stack (Angular 19 standalone SPA + NestJS 10 + Prisma/Postgres, two Docker targets: nginx frontend + backend on port 3001, frontend API base `/api`). Members sign up, upload JPEG/PNG images (≤5 MB, magic-byte validated) stored in the provisioned MinIO/S3 bucket and served back through a public `/api/media/:key` proxy, then caption, like, comment on, follow, and report posts. A public explore grid and public post/profile pages are viewable logged out; a personalised feed (cursor-paginated, 10 per page) requires auth; a moderator-only moderation queue lists open reports and soft-removes posts (`removedAt`), which hides them from every read path. Denormalised `likeCount`/`commentCount` are maintained inside the same Prisma `$transaction` as the like/comment write, and an idempotent seed creates the demo accounts (platform-minted via `COLOSSUS_ACCOUNTS_JSON`) plus 15 posts with generated placeholder PNGs.

## Surface contract

### Backend REST routes (all under the `/api` global prefix)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/health` | public | `{status:'ok'}` |
| GET | `/api/health/deep` | public | Prisma `SELECT 1` + S3 `HeadBucket` |
| POST | `/api/auth/signup` | public | email, password ≥8, displayName → JWT; role `USER` |
| POST | `/api/auth/login` | public | 401 on bad creds |
| GET | `/api/auth/me` | JWT | current user |
| GET | `/api/users/:handle` | public (optional JWT) | profile + postCount/followerCount/followingCount + `viewerFollows` |
| PATCH | `/api/users/me` | JWT | displayName, bio only |
| PUT | `/api/users/me/avatar` | JWT | multipart `avatar` |
| POST | `/api/posts` | JWT | multipart `image` + caption ≤2200 |
| GET | `/api/posts/feed?cursor=&limit=10` | JWT | followed authors only |
| GET | `/api/posts/explore?limit=24` | public (optional JWT) | all members |
| GET | `/api/posts/:id` | public (optional JWT) | 404 if `removedAt` set |
| PATCH | `/api/posts/:id` | JWT (author) | caption; 403 otherwise |
| DELETE | `/api/posts/:id` | JWT (author) | hard delete + S3 object; 403 otherwise |
| POST | `/api/posts/:id/like` | JWT | toggle → `{liked, likeCount}` |
| GET | `/api/posts/:id/comments` | public | paginated |
| POST | `/api/posts/:id/comments` | JWT | text 1–500 trimmed |
| DELETE | `/api/comments/:id` | JWT (author or moderator) | |
| POST/DELETE | `/api/users/:handle/follow` | JWT | idempotent; self-follow → 400 |
| POST | `/api/posts/:id/report` | JWT | reason 1–500 → 201; idempotent per user |
| GET | `/api/moderation/reports?status=open\|closed` | `@Roles('ADMIN')` | 403 for members |
| POST | `/api/moderation/posts/:id/remove` | `@Roles('ADMIN')` | sets `removedAt`, closes reports |
| GET | `/api/media/:key` | public | streams S3 object, immutable cache header |
| GET | `/api/admin/settings` | `@Roles('ADMIN')` | masked service/integration credential status |
| PATCH | `/api/admin/settings` | `@Roles('ADMIN')` | upsert `SystemSetting` rows |

Existing scaffold tRPC procedures (`users.findAll`, `users.findById`) and `GET /health` stay in place untouched.

### Frontend routes (Angular, `withComponentInputBinding()`)
| Route | Guard | `data.flow` | Addressable query state |
|---|---|---|---|
| `''` → `/explore` | — | redirect | |
| `/explore` | public | `explore` | |
| `/login` | `guestGuard` | `auth-login` | `?returnUrl=` |
| `/signup` | `guestGuard` | `auth-signup` | `?returnUrl=` |
| `/feed` | `authGuard` | `feed` | `?limit=` restores loaded page count |
| `/upload` | `authGuard` | `upload` | |
| `/p/:postId` | public | `post-detail` | `?modal=report` |
| `/u/:handle` | public | `profile` | `?tab=posts\|followers\|following` |
| `/settings/profile` | `authGuard` | `profile-settings` | |
| `/moderation` | `moderatorGuard` | `moderation` | `?status=`, `?panel=<reportId>` |
| `/admin/settings` | `moderatorGuard` (ADMIN) | `admin-settings` | |
| `**` | — | `not-found` | |

### Entities
`User` (id, email, passwordHash, handle, displayName, bio, avatarUrl, role, createdAt), `Post` (id, authorId, imageKey, imageUrl, caption, likeCount, commentCount, removedAt, createdAt), `Comment` (id, postId, authorId, text, createdAt), `Like` (`@@id([postId,userId])`), `Follow` (`@@id([followerId,followeeId])`), `Report` (id, postId, reporterId, reason, status, createdAt), `SystemSetting` (key, value, updatedAt).

## db_agent tasks
- [ ] Extend `backend/prisma/schema.prisma` with `enum UserRole { ADMIN MODERATOR USER }` and `enum ReportStatus { open closed }`; add `role UserRole @default(USER)` to the `User` model (spec `moderator` maps to `ADMIN`, spec `member` maps to `USER`).
- [ ] Extend the `User` model with `email @unique`, `passwordHash`, `handle String @unique`, `displayName`, `bio String?`, `avatarUrl String?`, `createdAt`, and the self-relations `following`/`followers` used by `Follow`.
- [ ] Add the `Post` model — `id`, `authorId`, `imageKey`, `imageUrl`, `caption String?` (≤2200 enforced in DTO), `likeCount Int @default(0)`, `commentCount Int @default(0)`, `removedAt DateTime?`, `createdAt`, with `author` relation `onDelete: Cascade` from `User`.
- [ ] Add the `Comment` model (`postId`, `authorId`, `text`, `createdAt`) and the `Like` model (`@@id([postId, userId])`), both with `onDelete: Cascade` from `Post` so author hard-delete cascades.
- [ ] Add the `Follow` model with `@@id([followerId, followeeId])` and the `Report` model (`postId`, `reporterId`, `reason`, `status ReportStatus @default(open)`, `createdAt`) with a unique constraint on `(postId, reporterId)` for idempotent reporting.
- [ ] Add the `SystemSetting` model — `key String @id`, `value String`, `updatedAt DateTime @updatedAt` — backing admin settings for `postgresql`, `minio`, and `llm`.
- [ ] Add indexes: `Post(authorId, createdAt)`, `Post(createdAt)`, `Comment(postId, createdAt)`, `Follow(followerId)`, `Report(status, createdAt)` — required by cursor pagination on `(createdAt desc, id desc)` and the moderation queue.
- [ ] Generate the migration (`npx prisma migrate dev`) producing `backend/prisma/migrations/0001_init/migration.sql` (or an additive migration on top of the scaffold's existing one) and run `npx prisma generate`.
- [ ] Rewrite `backend/prisma/seed/seed.js` to be idempotent (`upsert` by email; skip post creation if posts already exist): consume `COLOSSUS_ACCOUNTS_JSON` for platform-minted logins, then create `alice`/`bob`/`carol`/`dave` (`USER`) and `mod` (`ADMIN`), all bcrypt-hashed `Demo1234!` via `bcryptjs`.
- [ ] In the seed, generate placeholder PNGs in-process (hand-built IHDR/IDAT/IEND with zlib `deflateSync`, one solid colour per author — no network fetch), upload each via the storage service, and create 3 posts per user (15 total) with staggered `createdAt`; make alice follow bob and carol; add likes from multiple users and comments to ≥2 posts, updating `likeCount`/`commentCount` to match.
- [ ] Verify the seed is re-runnable: a second `npx prisma db seed` on a seeded DB changes no row counts.

## backend_agent tasks
- [ ] Configure `backend/src/main.ts` — global `/api` prefix, `ValidationPipe({whitelist:true, transform:true})`, raised body limit, listen on port 3001 (scaffold contract), keeping the existing scaffold bootstrap intact.
- [ ] Update `backend/src/app.module.ts` — `ConfigModule.forRoot({isGlobal:true})` plus the new feature modules (auth, users, storage, posts, comments, follows, reports, moderation, admin-settings), leaving the existing tRPC and health modules registered.
- [ ] Add `backend/src/health/health.controller.ts` routes `GET /api/health` → `{status:'ok'}` and `GET /api/health/deep` → Prisma `SELECT 1` + S3 `HeadBucket`, reporting each dependency separately; a failing `HeadBucket` at startup logs a loud warning but must not crash the process.
- [ ] Create `backend/src/common/image-validation.ts` — magic-byte sniff for JPEG (`FF D8 FF`) and PNG (`89 50 4E 47 0D 0A 1A 0A`), a `MAX_IMAGE_BYTES = 5 * 1024 * 1024` constant, and an extension mapper.
- [ ] Create a Multer exception filter that converts `LIMIT_FILE_SIZE` into **400** `{message:'Image exceeds 5 MB'}` instead of a 500, and register it globally.
- [ ] Create `backend/src/lib/config.ts` exporting `resolveConfig(key: string): Promise<string | null>` — reads `process.env[key]` first; if absent or equal to `PLACEHOLDER_CONFIGURE_IN_SETTINGS`, falls back to the `SystemSetting` row; returns `null` if neither is set. Export `ServiceUnconfiguredError` mapping to HTTP 503.
- [ ] Create `backend/src/lib/integrations/s3-object-storage.ts` — typed client for the S3-compatible object storage integration: resolves `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` (and the pipeline-supplied `S3_COMPATIBLE_OBJECT_STORAGE_AWS_SDK_V3_AWS_SDK_CLIENT_S3_API_KEY`) via `resolveConfig`, throws `ServiceUnconfiguredError` when any is null or still the placeholder, and exports `putObject`, `getObjectStream`, `deleteObject`, `headBucket` over `@aws-sdk/client-s3` with `forcePathStyle:true`.
- [ ] Create `backend/src/storage/storage.module.ts` + `storage.service.ts` wrapping the integration client, and `storage/media.controller.ts` — public `GET /api/media/:key` (wildcard key segment) that pipes the S3 body with the object `Content-Type` and `Cache-Control: public, max-age=31536000, immutable`, mapping `NoSuchKey` → 404.
- [ ] Create `backend/src/auth/` — `auth.module.ts`, `auth.service.ts` (bcryptjs cost 10, `signAccessToken` HS256/7d from `JWT_SECRET`), `jwt.strategy.ts` with payload `{sub,email,role,handle}`, `jwt-auth.guard.ts`, `optional-jwt.guard.ts`, `roles.guard.ts` + `roles.decorator.ts` (throws `ForbiddenException` → 403), `current-user.decorator.ts`.
- [ ] Create `backend/src/auth/auth.controller.ts` with `POST /api/auth/signup` (dto: email, password ≥8, displayName; role `USER`; handle derived from the email local part with a numeric suffix on collision), `POST /api/auth/login` (401 on bad creds), `GET /api/auth/me`; plus `dto/signup.dto.ts` and `dto/login.dto.ts`.
- [ ] Create `backend/src/users/` — `GET /api/users/:handle` (public, `OptionalJwtGuard`, counts via `_count` excluding `removedAt` posts, plus `viewerFollows`), `PATCH /api/users/me` (`dto/update-profile.dto.ts`, displayName/bio only, scoped to `req.user.sub`), `PUT /api/users/me/avatar` (`FileInterceptor` → validate → `putObject('avatars/<userId>.<ext>')` → set `avatarUrl`).
- [ ] Create `backend/src/posts/posts.controller.ts` + `posts.service.ts` write paths — `POST /api/posts` (memory storage, 5 MB limit, magic-byte reject → 400 with zero rows created, `putObject('posts/<uuid>.<ext>')` before `post.create`, `imageUrl = /api/media/<key>`), `PATCH /api/posts/:id` (caption), `DELETE /api/posts/:id` (403 unless author; delete S3 object then row) + `dto/create-post.dto.ts`.
- [ ] Implement the posts read paths — `GET /api/posts/feed?cursor=&limit=10` (`JwtAuthGuard`, authors the caller follows, `removedAt: null`, order `createdAt desc, id desc`, `take limit+1` → `nextCursor`), `GET /api/posts/explore?limit=24` (public, all members), `GET /api/posts/:id` (public, 404 when removed) + `dto/cursor-query.dto.ts`; every read filters `removedAt: null`.
- [ ] Implement `POST /api/posts/:id/like` as a `$transaction` toggle (delete Like + `likeCount decrement 1`, or create + `increment 1`) returning `{liked, likeCount}`; all counter mutations live in `PostsService` transaction helpers only.
- [ ] Create `backend/src/comments/` — `POST /api/posts/:id/comments` (`@Length(1,500)` on trimmed text → 400 otherwise, `$transaction` create + `commentCount increment`), `GET /api/posts/:id/comments` (public, paginated), `DELETE /api/comments/:id` (author or `ADMIN`, `$transaction` delete + decrement) + `dto/create-comment.dto.ts`.
- [ ] Create `backend/src/follows/` — `POST /api/users/:handle/follow` (`upsert`, idempotent) and `DELETE` (`deleteMany`, idempotent), returning 400 `BadRequestException('Cannot follow self')` when `followeeId === req.user.sub`.
- [ ] Create `backend/src/reports/` — `POST /api/posts/:id/report` with `dto/create-report.dto.ts` (reason 1–500), `status: open`, 201 confirmation, idempotent for a repeat report by the same user on the same post.
- [ ] Create `backend/src/moderation/` — `GET /api/moderation/reports?status=open|closed` and `POST /api/moderation/posts/:id/remove` behind `@Roles('ADMIN')`; remove sets `Post.removedAt` and closes all open reports for that post in one `$transaction`.
- [ ] Create the admin settings module — `GET /api/admin/settings` listing the `postgresql`, `minio`, and `llm` service credential keys plus the S3 integration env keys with masked values and a configured/unconfigured flag, and `PATCH /api/admin/settings` upserting `SystemSetting` key/value pairs; both `@Roles('ADMIN')`.
- [ ] Add the backend dependencies the spec requires (`@nestjs/{config,jwt,passport}`, `passport`, `passport-jwt`, `bcryptjs`, `class-validator`, `class-transformer`, `@aws-sdk/client-s3`, `multer`, `@types/multer`) to `backend/package.json` — no `file-type` — and confirm `npx prisma generate && npx tsc --noEmit` passes.

## ui_agent tasks
- [ ] Update `frontend/src/app/app.component.ts` shell — header rendering the literal text `SnapGram` at all times including logged out, primary nav (Explore / Feed / Upload), user menu or Sign in link, `<router-outlet>`, and the `app-ready` test id retained on the root element.
- [ ] Update `frontend/src/app/app.config.ts` — `provideRouter(routes, withComponentInputBinding())` and `provideHttpClient(withInterceptors([authInterceptor]))`, keeping the existing tRPC client provider.
- [ ] Update `frontend/src/app/app.routes.ts` to the full route table above with `data.flow` on every route, `''` redirecting to `/explore`, and a `**` not-found route.
- [ ] Create `frontend/src/app/core/auth.guard.ts`, `guest.guard.ts`, and `moderator.guard.ts` — auth guard redirects to `/login?returnUrl=`, guest guard bounces authenticated users off `/login`/`/signup`, moderator guard requires role `ADMIN`.
- [ ] Create `frontend/src/app/features/auth/login.component.ts` and `signup.component.ts` — reactive forms with validation messages (password ≥8), honouring `?returnUrl=` after success.
- [ ] Create `frontend/src/app/features/explore/explore.component.ts` — public 24-item grid with loading, empty, and error states.
- [ ] Create `frontend/src/app/features/feed/feed.component.ts` — 10 posts per page, "Load more" appending via `nextCursor`, `trackBy` post id so no duplicates render, `?limit=` restoring the loaded page count on reload.
- [ ] Create `frontend/src/app/features/upload/upload.component.ts` — a route (not a modal) with `<input type="file" accept="image/jpeg,image/png">`, client-side size/type precheck, caption field (≤2200), and surfacing of the server's 400 message.
- [ ] Create `frontend/src/app/features/post/post-detail.component.ts` — image, author link, caption, likes, comments, and `?modal=report` opening the report dialog.
- [ ] Create `frontend/src/app/features/profile/profile.component.ts` — avatar/displayName/bio, post/follower/following counts, newest-first grid, `?tab=posts|followers|following`, follow button hidden on own profile.
- [ ] Create `frontend/src/app/features/settings/profile-settings.component.ts` (display name, bio, avatar upload) and `features/not-found.component.ts`.
- [ ] Create `frontend/src/app/features/moderation/moderation.component.ts` — open/closed report table filtered by `?status=`, `?panel=<reportId>` detail pane, Remove action with optimistic row close.
- [ ] Create `frontend/src/app/features/admin/admin-settings.component.ts` at `/admin/settings` — one section per provisioned service (`postgresql`, `minio`, `llm`) and per integration (S3-compatible object storage) with a configured/unconfigured badge and credential input fields, plus a prominent banner: "The following need credentials to activate: S3-compatible object storage (AWS SDK v3 `@aws-sdk/client-s3`)."
- [ ] Create the shared components `post-card.component.ts` (image, author link, caption, like toggle with optimistic count, comment box, report link → `?modal=report`), `post-grid.component.ts`, `comment-list.component.ts`, `report-dialog.component.ts`, `follow-button.component.ts`.
- [ ] Give every list, form, and state element a `data-testid` and extend `.pipeline/surface.json` with the new routes, components, and test ids; update `.colossus-acceptance.json` `expect_text` to the real front page ("SnapGram" / explore grid).
- [ ] Update `frontend/src/index.html` `<title>` to `SnapGram` and add base styling in `frontend/src/styles.css` (no UI library).

## service_agent tasks
- [ ] Create `frontend/src/app/core/models.ts` — TypeScript interfaces for `User`, `PostSummary`, `PostDetail`, `Comment`, `Report`, `Paged<T>` (`items`, `nextCursor`), and `AdminSetting`, matching the backend response shapes exactly.
- [ ] Create `frontend/src/app/core/api.service.ts` — typed `HttpClient` wrapper over the `/api` base with `get/post/patch/put/delete` helpers and multipart `FormData` support for image/avatar upload.
- [ ] Create `frontend/src/app/core/auth.service.ts` — signup/login/logout, JWT persisted in `localStorage`, a `currentUser` signal hydrated from `GET /api/auth/me` on bootstrap, and an `isModerator` computed signal.
- [ ] Create `frontend/src/app/core/auth.interceptor.ts` — attaches `Authorization: Bearer <token>`, and on 401 clears the session and redirects to `/login?returnUrl=<current url>`.
- [ ] Add posts data-layer methods — `explore(limit)`, `feed(cursor, limit)`, `getPost(id)`, `createPost(file, caption)`, `updateCaption(id, caption)`, `deletePost(id)`, `toggleLike(id)` returning `{liked, likeCount}`.
- [ ] Add comments data-layer methods — `listComments(postId, cursor)`, `addComment(postId, text)`, `deleteComment(id)`.
- [ ] Add profile/follow data-layer methods — `getProfile(handle)`, `updateMe({displayName, bio})`, `uploadAvatar(file)`, `follow(handle)`, `unfollow(handle)`.
- [ ] Add moderation and reports data-layer methods — `reportPost(postId, reason)`, `listReports(status)`, `removePost(postId)`.
- [ ] Add admin settings data-layer methods — `getAdminSettings()` and `saveAdminSettings(pairs)` against `/api/admin/settings`.
- [ ] Centralise HTTP error mapping in the client layer — surface the backend's `message` field to components (400 validation, 401, 403, 404, 503 unconfigured service) so UI components never parse raw `HttpErrorResponse`.
- [ ] Verify the nginx/dev proxy config (`frontend/proxy.conf.json` and `frontend/nginx.conf`) forwards `/api` to the backend on port 3001 so the SPA and API share an origin in both dev and the deployed image.

## tester tasks
- [ ] `backend/test/health.e2e-spec.ts` — `GET /api/health` returns `{status:'ok'}`; `GET /api/health/deep` reports both Postgres and the bucket.
- [ ] `backend/test/auth.e2e-spec.ts` — signup creates a `USER` with a handle derived from the email local part (collision → numeric suffix), member and moderator login succeed, bad password → 401, `GET /api/auth/me` reflects the token.
- [ ] `backend/test/profile.e2e-spec.ts` — `PATCH /api/users/me` updates only the caller's displayName/bio and leaves other members' profiles unchanged; avatar upload sets `avatarUrl`.
- [ ] `backend/test/upload.e2e-spec.ts` — 5 MB JPEG and PNG accepted; 6 MB file → 400 `Image exceeds 5 MB`; PDF → 400 with zero Post rows and zero S3 objects created.
- [ ] `backend/test/post-lifecycle.e2e-spec.ts` — author `DELETE` cascades likes and comments and removes the S3 object; non-author `DELETE` and `PATCH` → 403.
- [ ] `backend/test/follows.e2e-spec.ts` — follow/unfollow produce the expected follower/following count deltas, repeat calls are idempotent, self-follow → 400.
- [ ] `backend/test/feed.e2e-spec.ts` — feed excludes non-followed authors; 30 posts paginate 10 + 10 with disjoint id sets via `nextCursor`; explore returns 24 newest-first.
- [ ] `backend/test/likes-comments.e2e-spec.ts` — double-like returns `likeCount` to the original value; comment of 1 and 500 chars accepted, empty/whitespace and 501 chars → 400; `commentCount` matches row count.
- [ ] `backend/test/moderation.e2e-spec.ts` — report enters the queue (duplicate report idempotent); moderator remove hides the post from feed, explore, profile, and `GET /api/posts/:id` (404) and closes the report; a member hitting `/api/moderation/reports` → 403.
- [ ] `backend/test/seed.e2e-spec.ts` — fresh DB yields 5 accounts, alice's 2 follows, 15 posts with fetchable `imageUrl` returning a valid PNG signature through `/api/media/:key`, ≥2 posts with likes and comments; re-running the seed changes no counts.
- [ ] `backend/test/admin-settings.e2e-spec.ts` — `GET /api/admin/settings` masks values and flags unconfigured services for an ADMIN, `PATCH` upserts `SystemSetting` rows, and both return 403 for a member.
- [ ] Frontend guard unit tests — unauthenticated `/feed`, `/upload`, `/settings/profile` redirect to `/login?returnUrl=`; a member hitting `/moderation` is redirected; `/explore` stays viewable logged out.
- [ ] Playwright smoke — `/` renders the literal text `SnapGram` while logged out and shows the explore grid; deep links `/p/:id`, `/u/:handle?tab=followers`, and `/moderation?status=open&panel=<id>` restore their state; use the `getAllAngularTestabilities().every(t => t.isStable())` wait strategy from the stack contract.
- [ ] Deploy check — build both Docker targets, run the compose stack, `curl /api/health/deep` (must confirm Postgres and the bucket), and load `/` to confirm the SPA renders.

## Open questions
- **REST vs tRPC.** The scaffolder fixed the stack on tRPC and says not to replace the routing layer unless a spec requirement is otherwise unimplementable. The spec's normative surface is REST (multipart upload, streamed `/api/media/:key`, supertest e2e against `/api/...`), which tRPC cannot express — so this decomposition adds REST controllers under `/api` and leaves the scaffold's existing tRPC `users` router in place. Confirm this coexistence is acceptable rather than porting the domain to tRPC.
- **Single container vs two Docker targets.** The spec assumes one multi-stage image where Nest serves the SPA from `/app/static` on port 3000; the scaffold contract (`colossus.yaml`, `colossus.stack.json`) specifies an nginx frontend plus a backend on port 3001. Tasks follow the scaffold. If the Playwright oracle requires the single-container topology, the deploy chain (`Dockerfile`, `entrypoint.sh`, `ServeStaticModule`) must be re-scoped.
- **Role naming.** The spec's actors are `member` and `moderator`; the pipeline auth model supplies `admin`/`user` and the stack contract lists `ADMIN`/`MANAGER`/`USER`. This decomposition maps moderator → `ADMIN` and member → `USER` and retains a `MODERATOR` enum value for future use. Confirm the moderation queue should be gated on `ADMIN`.
- **Platform-minted accounts.** `colossus.stack.json` requires the seed to consume `COLOSSUS_ACCOUNTS_JSON`, while the spec hardcodes `alice/bob/carol/dave/mod` with password `Demo1234!`. Tasks do both (platform accounts first, demo accounts as additions); confirm the demo credentials may still be seeded.
- **The `llm` deployment.** `postgresql`, `minio`, and `llm` are provisioned, but the spec describes no LLM feature. The `llm` entry is surfaced in `/admin/settings` only; no LLM behaviour is implemented.
- **Malformed integration entry.** `"No other third-party APIs (per spec)."` was parsed as an integration with env key `NO_OTHER_THIRD_PARTY_APIS_PER_SPEC_API_KEY`. It is a spec sentence, not a service, so no client module or settings field is generated for it — confirm.
- **Presigned URLs vs proxying.** The spec proxies media through Node with immutable caching. If demo-scale latency proves unacceptable, presigning is the documented escape hatch but would change `Post.imageUrl` semantics.
- **File budget.** `.pipeline/surface.json` sets `maxLines: 400` / `hardLimit: 500` per component. `post-card.component.ts` and `moderation.component.ts` are the likeliest to exceed it and may need splitting.
