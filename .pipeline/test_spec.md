# Test Specification

> **⚠️ Warning — `surface.json` is stale.** `.pipeline/surface.json` still contains the
> generic scaffold surface (`GET /health`, `GET /trpc/users.findAll`, `GET /trpc/users.findById`)
> and has not been regenerated from the SnapGram spec. The authoritative API surface used below is
> derived from `.pipeline/tasks.md` ("Surface contract") plus the spec. The three scaffold routes
> are retained and tested (`tasks.md`: "Existing scaffold tRPC procedures ... stay in place untouched").
>
> **Contract deltas this spec tests against (tasks.md wins over spec prose where they disagree):**
> - Backend listens on **3001**, two Docker targets (nginx SPA + Nest API), not the spec's single
>   port-3000 image. Tests hit the API via the shared origin `/api` prefix.
> - Roles are **`ADMIN`** (spec "moderator") and **`USER`** (spec "member"). Assertions use the enum values.
> - Extra surface beyond the spec: `GET/PATCH /api/admin/settings` and the `/admin/settings` screen.

## Coverage summary
- Total cases: 345 (227 API, 91 UI/journey, 22 data integrity, 5 deploy/smoke)
- API endpoints covered: 29 / 29 (3 of 3 routes listed in `surface.json`, plus 26 spec/tasks routes it omits)
- User journeys covered: 12

---

## API tests

Shared fixtures used below: seeded users `alice`, `bob`, `carol`, `dave` (role `USER`) and `mod`
(role `ADMIN`), all with password `Demo1234!`; alice follows bob and carol; 15 posts (3 per user)
with staggered `createdAt`. `TOKEN(x)` = JWT from `POST /api/auth/login` as user `x`.

### `GET /api/health`
- **Happy path**: `GET /api/health` with no headers → `200`, body exactly `{"status":"ok"}` (API-001). Responds without a DB connection being required (API-002).
- **Validation failures**: n/a — no inputs.
- **Auth failures**: reachable with no `Authorization` header and with a garbage `Authorization: Bearer nope` header — both `200` (API-003).
- **Idempotency / edge cases**: 5 sequential calls all return `200` with identical bodies (API-004).

### `GET /api/health/deep`
- **Happy path**: `200` with a body reporting each dependency separately, e.g. `{status:'ok', checks:{database:'ok', storage:'ok'}}`; `database` reflects a successful Prisma `SELECT 1` and `storage` a successful S3 `HeadBucket` (API-005). Both keys must be present — a body that omits `storage` fails (API-006).
- **Validation failures**: n/a.
- **Auth failures**: public — no token required, `200` (API-007).
- **Idempotency / edge cases**: with `S3_BUCKET` pointed at a non-existent bucket, the endpoint still responds (non-`5xx` process-crash) and reports `storage` as failing while `database` stays `ok` (API-008). Startup with a bad bucket logs a warning but the process stays up and `GET /api/health` still returns `200` (API-009).

### `POST /api/auth/signup`
- **Happy path**: `{email:'newbie@demo', password:'Demo1234!', displayName:'Newbie'}` → `201` (or `200`) with `{accessToken:<jwt>, user:{id, email:'newbie@demo', handle:'newbie', displayName:'Newbie', role:'USER'}}`; `passwordHash` MUST NOT appear anywhere in the body (API-010). Handle is derived from the email local part (API-011). Decoding the JWT yields `{sub, email, role:'USER', handle}` (API-012).
- **Validation failures**: missing `email` → `400` (API-013); `email:'not-an-email'` → `400` (API-014); `password:'short7!'` (7 chars) → `400` while `'exactly8'` (8 chars) → `201` (API-015); missing `displayName` → `400` (API-016); duplicate email `alice@demo` → `409` (or `400`) and no second row created (API-017); `whitelist:true` strips an injected `role:'ADMIN'` field so the created user is still `USER` (API-018).
- **Auth failures**: n/a — public.
- **Idempotency / edge cases**: signing up `alice@other.test` (local part `alice`, colliding with seeded alice) yields a distinct handle with a numeric suffix, e.g. `alice2`, and both users remain fetchable at their own `/api/users/:handle` (API-019). Signup never mints `ADMIN` — the only `ADMIN` is the seeded `mod` (API-020).

### `POST /api/auth/login`
- **Happy path**: `{email:'alice@demo', password:'Demo1234!'}` → `200` with `accessToken` + user, `role:'USER'` (API-021). `{email:'mod@demo', password:'Demo1234!'}` → `200` with `role:'ADMIN'` (API-022).
- **Validation failures**: missing `password` → `400` (API-023); malformed `email` → `400` (API-024).
- **Auth failures**: correct email + wrong password `'Wrong1234!'` → `401`, and the response body must not distinguish "no such user" from "bad password" (API-025); unknown email `ghost@demo` → `401` (API-026).
- **Idempotency / edge cases**: two logins for the same user both succeed and both tokens independently authorize `GET /api/auth/me` (API-027).

### `GET /api/auth/me`
- **Happy path**: with `TOKEN(alice)` → `200` `{id, email:'alice@demo', handle:'alice', displayName, bio, avatarUrl, role:'USER'}`, no `passwordHash` (API-028). With `TOKEN(mod)` → `role:'ADMIN'` (API-029).
- **Validation failures**: n/a.
- **Auth failures**: no header → `401` (API-030); `Bearer garbage` → `401` (API-031); a token signed with a different `JWT_SECRET` → `401` (API-032); an expired token (`exp` in the past) → `401` (API-033).
- **Idempotency / edge cases**: after `PATCH /api/users/me` changes `displayName`, the same token's `me` reflects the new value without re-login (API-034).

### `GET /api/users/:handle`
- **Happy path**: `GET /api/users/bob` unauthenticated → `200` with `{handle:'bob', displayName, bio, avatarUrl, postCount:3, followerCount:1, followingCount:0}` (bob is followed by alice only) (API-035). Counts are numbers, not strings (API-036).
- **Validation failures**: `GET /api/users/nosuchhandle` → `404` (API-037).
- **Auth failures**: public — no token still `200` (API-038); with `TOKEN(alice)` the body additionally carries `viewerFollows:true` for bob (API-039) and `viewerFollows:false` for dave (API-040); unauthenticated the field is `false`/absent, never `true` (API-041).
- **Idempotency / edge cases**: `postCount` excludes soft-removed posts — after a moderator removes one of bob's 3 posts, `postCount` is `2` (API-042). `viewerFollows` on your own handle is `false` and the payload marks it as self (`isSelf:true` or equivalent) so the UI can hide the follow button (API-043).

### `PATCH /api/users/me`
- **Happy path**: `TOKEN(alice)` + `{displayName:'Alice A.', bio:'photographer'}` → `200` with the updated profile; `GET /api/users/alice` reflects both fields (API-044). Sending only `bio` leaves `displayName` unchanged (API-045).
- **Validation failures**: `{displayName:''}` → `400` (API-046); a bio over the documented max → `400` (API-047); `{}` (no updatable fields) → `400` or `200`-no-op, but must never null out existing values (API-048).
- **Auth failures**: no token → `401` (API-049).
- **Idempotency / edge cases**: **isolation** — with `TOKEN(alice)`, an attempt to patch with an injected `id`/`handle`/`email`/`role` in the body is stripped by `whitelist:true`; alice's `handle`, `email` and `role` are unchanged and **bob's, carol's, and dave's profile rows are byte-identical before and after** (API-050). Applying the same patch twice yields the same final state (API-051).

### `PUT /api/users/me/avatar`
- **Happy path**: `TOKEN(alice)` + multipart field `avatar` = a 100 KB valid PNG → `200`; `avatarUrl` becomes `/api/media/avatars/<alice.id>.png` and `GET` on that URL returns `200` with `Content-Type: image/png` (API-052). A valid JPEG → key ends `.jpg`/`.jpeg` with `Content-Type: image/jpeg` (API-053).
- **Validation failures**: a 6 MB image → `400` `{message:'Image exceeds 5 MB'}` (never `500`) (API-054); a PDF renamed `avatar.png` → `400` on the magic-byte sniff, and `avatarUrl` is unchanged (API-055); no file part at all → `400` (API-056).
- **Auth failures**: no token → `401` (API-057).
- **Idempotency / edge cases**: uploading a second avatar overwrites the same deterministic key `avatars/<userId>.<ext>` and the fetched bytes match the second upload (API-058). A rejected upload creates zero S3 objects (API-059). Only the caller's `avatarUrl` changes; bob's is untouched (API-060).

### `POST /api/posts`
- **Happy path**: `TOKEN(alice)` + multipart `image` = valid JPEG + `caption:'sunset'` → `201` with `{id, authorId:alice.id, imageUrl:'/api/media/posts/<uuid>.jpg', caption:'sunset', likeCount:0, commentCount:0, removedAt:null, createdAt}` (API-061). `GET imageUrl` returns `200` and the exact uploaded bytes (API-062). A PNG upload works identically with a `.png` key (API-063). Caption omitted entirely → `201` with `caption:null` (API-064). A file of **exactly 5 MB (5\*1024\*1024 bytes)** JPEG → `201` (API-065); the same size as PNG → `201` (API-066).
- **Validation failures**: a 6 MB JPEG → **`400`** with `{message:'Image exceeds 5 MB'}` — asserting `400`, explicitly **not** `500` or `413` (API-067); a PDF (`%PDF-` magic) sent as `image.jpg` → `400`, and **`Post` row count is unchanged and no S3 object was written** (API-068); a zero-byte file → `400` (API-069); a caption of 2201 chars → `400`, and 2200 chars → `201` (API-070); missing `image` part → `400` (API-071); a GIF (valid image, unsupported type) → `400` (API-072).
- **Auth failures**: no token → `401`, and no row created (API-073).
- **Idempotency / edge cases**: ordering guarantee — for every rejected request, **zero** `Post` rows exist for that author beyond the pre-request count (S3 put must not precede a failed validation) (API-074). Two uploads of the identical file produce two distinct posts with distinct `imageKey`s (no key collision) (API-075).

### `GET /api/posts/feed`
- **Happy path**: `TOKEN(alice)` (follows bob, carol) → `200` `{items:[...], nextCursor}`; every returned post's `authorId` is bob's or carol's (API-076). Items are ordered strictly by `createdAt desc, id desc` (API-077). Default page size is 10 (API-078).
- **Validation failures**: `?limit=abc` → `400` (API-079); `?limit=0` and `?limit=-1` → `400` (API-080); `?limit=1000` → `400` or clamped, never returns >100 items (API-081); `?cursor=notacursor` → `400` (API-082).
- **Auth failures**: no token → `401` (feed is not public) (API-083).
- **Idempotency / edge cases**: **pagination** — with 30 posts from followed authors, page 1 (`limit=10`) returns 10 items + a `nextCursor`; page 2 via that cursor returns 10 items; the two id sets are **disjoint** and their union has 20 distinct ids (API-084). Paging to exhaustion returns `nextCursor: null` on the last page and never repeats an id (API-085). Feed **excludes** dave (not followed) (API-086) and **excludes the caller's own posts unless the spec's follow graph includes them** — assert the documented behaviour consistently (API-087). Soft-removed posts are absent from the feed (API-088). A user following nobody gets `{items:[], nextCursor:null}`, not a `404` (API-089).

### `GET /api/posts/explore`
- **Happy path**: unauthenticated `GET /api/posts/explore` → `200` with posts from **all** members including non-followed ones (API-090). Fixed page size 24: with ≥24 non-removed posts the response has exactly 24 items (API-091). Newest-first ordering by `createdAt desc, id desc` (API-092). Each item carries `imageUrl`, `caption`, and an author stub `{handle, displayName, avatarUrl}` (API-093).
- **Validation failures**: `?limit=abc` → `400` (API-094).
- **Auth failures**: public — `200` with no token (API-095). With `TOKEN(alice)` items additionally carry `viewerHasLiked` (API-096); unauthenticated it is `false`/absent, never `true` (API-097).
- **Idempotency / edge cases**: soft-removed posts never appear (API-098). With fewer than 24 posts in the DB, all of them return with no error (API-099).

### `GET /api/posts/:id`
- **Happy path**: public `GET /api/posts/<bobPost.id>` → `200` with `{id, imageUrl, caption, likeCount, commentCount, createdAt, author:{handle, displayName, avatarUrl}}` (API-100).
- **Validation failures**: a well-formed but unknown id → `404` (API-101); a malformed id (e.g. `not-a-uuid`) → `400` or `404`, never `500` (API-102).
- **Auth failures**: public — `200` with no token (API-103). With `TOKEN(alice)` after alice likes it, `viewerHasLiked:true` (API-104).
- **Idempotency / edge cases**: after a moderator removes the post, the same id → **`404`** even for the author and even for the moderator via this route (API-105). After the author hard-deletes it → `404` (API-106).

### `PATCH /api/posts/:id`
- **Happy path**: `TOKEN(alice)` patching alice's own post with `{caption:'new caption'}` → `200`; a re-`GET` shows the new caption (API-107). `{caption:''}` clears the caption if the spec allows optional captions → `200` with `caption:''`/`null` (API-108).
- **Validation failures**: caption of 2201 chars → `400` (API-109); a body attempting `{likeCount:999}` is stripped by `whitelist` and `likeCount` is unchanged (API-110); a body attempting `{imageKey:'other'}` is stripped (API-111).
- **Auth failures**: no token → `401` (API-112); **`TOKEN(bob)` patching alice's post → `403`** and the caption is unchanged (API-113); `TOKEN(mod)` patching alice's post → `403` (moderators use the moderation route, not this one) (API-114).
- **Idempotency / edge cases**: patching a soft-removed post → `404` (API-115); patching a non-existent id → `404` (API-116).

### `DELETE /api/posts/:id`
- **Happy path**: `TOKEN(alice)` deleting alice's own post (which has 2 likes and 3 comments) → `200`/`204`; the `Post` row is gone, **its `Like` and `Comment` rows are gone via cascade**, and the S3 object at `imageKey` is deleted so `GET /api/media/<key>` → `404` (API-117).
- **Validation failures**: malformed id → `400`/`404`, never `500` (API-118).
- **Auth failures**: no token → `401` (API-119); **`TOKEN(bob)` deleting alice's post → `403`** and the post still exists (API-120); `TOKEN(mod)` deleting alice's post via this route → `403` (API-121).
- **Idempotency / edge cases**: deleting the same id twice → second call `404` (API-122). Deleting a post that has open `Report` rows also removes them via cascade, leaving no orphan reports in the moderation queue (API-123).

### `POST /api/posts/:id/like`
- **Happy path**: `TOKEN(bob)` on alice's post (`likeCount:0`) → `200` `{liked:true, likeCount:1}`; the `Like` row exists (API-124).
- **Validation failures**: unknown post id → `404` (API-125); a soft-removed post → `404` and no `Like` row created (API-126).
- **Auth failures**: no token → `401` (API-127).
- **Idempotency / edge cases**: **double-like toggles back** — a second call by the same user → `{liked:false, likeCount:0}` and the `Like` row is gone; the final `likeCount` equals the original (API-128). A third call → `{liked:true, likeCount:1}` (API-129). Likes from two different users → `likeCount:2`; one of them unliking → `likeCount:1` (API-130). `likeCount` always equals `COUNT(*)` of `Like` rows for that post after every toggle (API-131). Self-like by the author is permitted and counted once (API-132).

### `GET /api/posts/:id/comments`
- **Happy path**: public `GET` on a post with 3 comments → `200` `{items:[3], nextCursor}` each `{id, text, createdAt, author:{handle, displayName, avatarUrl}}` (API-133). Deterministic ordering by `createdAt, id` (API-134).
- **Validation failures**: unknown post id → `404` (API-135); `?limit=abc` → `400` (API-136).
- **Auth failures**: public — `200` with no token (API-137).
- **Idempotency / edge cases**: paginates — with 25 comments, two pages via `nextCursor` return disjoint id sets (API-138). A post with no comments → `{items:[], nextCursor:null}`, not `404` (API-139). Comments on a soft-removed post → `404` (API-140).

### `POST /api/posts/:id/comments`
- **Happy path**: `TOKEN(bob)` + `{text:'nice shot'}` → `201` with the created comment; the post's `commentCount` increments by exactly 1 in the same transaction (API-141). Text of exactly **1** char → `201` (API-142); exactly **500** chars → `201` (API-143).
- **Validation failures**: `{text:''}` → `400` (API-144); `{text:'   '}` (whitespace only, trims to empty) → `400` (API-145); text of **501** chars → `400` (API-146); missing `text` → `400` (API-147). After every `400`, `commentCount` is unchanged and no `Comment` row was created (API-148).
- **Auth failures**: no token → `401` (API-149).
- **Idempotency / edge cases**: commenting on a soft-removed post → `404` with no counter change (API-150). After N successful comments, `commentCount === COUNT(*)` of `Comment` rows (API-151).

### `DELETE /api/comments/:id`
- **Happy path**: the comment's author deletes it → `200`/`204`, row gone, `commentCount` decremented by exactly 1 (API-152). A moderator (`ADMIN`) deletes another user's comment → `200`/`204` with the same counter decrement (API-153).
- **Validation failures**: unknown comment id → `404` (API-154).
- **Auth failures**: no token → `401` (API-155); a third `USER` who is neither the comment author nor the post author → `403`, comment intact, counter unchanged (API-156).
- **Idempotency / edge cases**: deleting twice → second call `404` and `commentCount` decremented only once (never negative) (API-157). `commentCount` never goes below 0 (API-158).

### `POST /api/users/:handle/follow`
- **Happy path**: `TOKEN(dave)` → `POST /api/users/bob/follow` → `200`/`201`; bob's `followerCount` +1 and dave's `followingCount` +1 (API-159). Bob's posts now appear in dave's feed (API-160).
- **Validation failures**: unknown handle → `404` (API-161).
- **Auth failures**: no token → `401` (API-162).
- **Idempotency / edge cases**: **self-follow** — `TOKEN(alice)` → `POST /api/users/alice/follow` → **`400`** with message `Cannot follow self`, and no `Follow` row created (API-163). Following the same user twice (upsert) → second call succeeds and `followerCount` is still +1 total, not +2 (API-164).

### `DELETE /api/users/:handle/follow`
- **Happy path**: `TOKEN(alice)` → `DELETE /api/users/bob/follow` → `200`/`204`; bob's `followerCount` −1, alice's `followingCount` −1, and bob's posts disappear from alice's feed (API-165).
- **Validation failures**: unknown handle → `404` (API-166).
- **Auth failures**: no token → `401` (API-167).
- **Idempotency / edge cases**: unfollowing someone you never followed → success (`deleteMany` no-op), counts unchanged, never `500` (API-168). Follow → unfollow → follow returns counts to exactly +1 from baseline (API-169). Self-unfollow → `400` `Cannot follow self` or a no-op, never a negative count (API-170).

### `POST /api/posts/:id/report`
- **Happy path**: `TOKEN(bob)` + `{reason:'spam'}` on alice's post → **`201`** with a confirmation body; a `Report` row exists with `status:'open'` (API-171). The report is visible in `GET /api/moderation/reports?status=open` for `mod` (API-172).
- **Validation failures**: `{reason:''}` → `400` (API-173); reason of 501 chars → `400`, and 500 chars → `201` (API-174); reason of 1 char → `201` (API-175); missing `reason` → `400` (API-176).
- **Auth failures**: no token → `401` (API-177).
- **Idempotency / edge cases**: the **same user reporting the same post twice** → still `201`/`200` and exactly **one** `Report` row exists (unique `(postId, reporterId)`), never a `500` unique-constraint leak (API-178). Two different users reporting the same post → two rows, both in the queue (API-179). Reporting a soft-removed post → `404` (API-180). Reporting your own post is permitted (or `400` per spec) but never `500` (API-181).

### `GET /api/moderation/reports`
- **Happy path**: `TOKEN(mod)` + `?status=open` → `200` with only `status:'open'` reports, each carrying `{id, reason, createdAt, reporter:{handle}, post:{id, imageUrl, author:{handle}}}` (API-182). `?status=closed` returns only closed reports (API-183). Ordering newest-first by `createdAt` (API-184).
- **Validation failures**: `?status=bogus` → `400` (API-185); omitted `status` → defaults to `open` or returns all, but never `500` (API-186).
- **Auth failures**: no token → `401` (API-187); **`TOKEN(alice)` (role `USER`) → `403`** — this is the spec's "Member cannot access the moderation queue" case, and the body must not leak any report data (API-188).
- **Idempotency / edge cases**: reports whose post was hard-deleted by its author do not appear as orphans (API-189).

### `POST /api/moderation/posts/:id/remove`
- **Happy path**: `TOKEN(mod)` → `200`; `Post.removedAt` is set non-null and **all open reports for that post move to `status:'closed'` in the same transaction** (API-190). The post then disappears from: `GET /api/posts/explore` (API-191), alice's `GET /api/posts/feed` (API-192), the author's `GET /api/users/:handle` grid and `postCount` (API-193), and `GET /api/posts/:id` returns **`404`** (API-194).
- **Validation failures**: unknown post id → `404` (API-195).
- **Auth failures**: no token → `401` (API-196); `TOKEN(alice)` (role `USER`) → **`403`** and `removedAt` stays null (API-197).
- **Idempotency / edge cases**: removing an already-removed post → succeeds or `404`, but never resets `removedAt` to null and never re-opens reports (API-198). The underlying row and S3 object still exist (soft delete, not hard delete) — verified by direct DB read (API-199).

### `GET /api/media/:key`
- **Happy path**: `GET /api/media/posts/<uuid>.png` → `200`, body bytes identical to the uploaded file, `Content-Type: image/png`, and `Cache-Control: public, max-age=31536000, immutable` exactly (API-200). A JPEG key → `Content-Type: image/jpeg` (API-201). An avatar key `avatars/<userId>.png` resolves identically (API-202).
- **Validation failures**: an unknown key → **`404`** (S3 `NoSuchKey` mapped, not a `500`) (API-203); a path-traversal key `../../etc/passwd` → `400`/`404` and never returns file contents (API-204).
- **Auth failures**: **public** — `200` with no `Authorization` header, because explore is public (API-205).
- **Idempotency / edge cases**: the multi-segment key (`posts/<uuid>.png`) resolves through the wildcard route rather than being swallowed by the SPA fallback — this is the documented `/api` prefix vs. static-fallback ordering risk (API-206). Two sequential fetches return byte-identical bodies (API-207).

### `GET /api/admin/settings`
- **Happy path**: `TOKEN(mod)` → `200` listing the `postgresql`, `minio`, and `llm` service credentials plus the S3 integration env keys, each with a **masked** value and a `configured: true|false` flag (API-208). No raw secret value appears anywhere in the body — assert the live `S3_SECRET_ACCESS_KEY` substring is absent (API-209).
- **Validation failures**: n/a — no inputs.
- **Auth failures**: no token → `401` (API-210); `TOKEN(alice)` (`USER`) → `403` (API-211).
- **Idempotency / edge cases**: a key whose env value is `PLACEHOLDER_CONFIGURE_IN_SETTINGS` reports `configured:false` (API-212).

### `PATCH /api/admin/settings`
- **Happy path**: `TOKEN(mod)` + `{"S3_BUCKET":"newbucket"}` → `200`; a `SystemSetting` row is upserted and a follow-up `GET` shows `configured:true` for that key (API-213).
- **Validation failures**: a non-object body or an unknown key → `400` (API-214).
- **Auth failures**: no token → `401` (API-215); `TOKEN(alice)` → `403` and no `SystemSetting` row written (API-216).
- **Idempotency / edge cases**: patching the same key twice updates in place (one row, `updatedAt` advanced), never duplicates (API-217).

### `GET /health` *(scaffold route retained — listed in `surface.json`)*
- **Happy path**: `GET /health` (outside the `/api` prefix) → `200` and still reachable after the `/api` global prefix is introduced (API-218).
- **Validation failures**: n/a.
- **Auth failures**: public (API-219).
- **Idempotency / edge cases**: it is not shadowed by the SPA fallback (API-220).

### `GET /trpc/users.findAll` *(scaffold route retained — listed in `surface.json`)*
- **Happy path**: `200` with the tRPC envelope and a users array; the procedure still resolves after the Prisma `User` model gains `handle`/`role`/`passwordHash` (API-221).
- **Validation failures**: n/a.
- **Auth failures**: unchanged from the scaffold (API-222).
- **Idempotency / edge cases**: **must not leak `passwordHash`** now that the field exists on `User` — assert it is absent from every returned record (API-223).

### `GET /trpc/users.findById` *(scaffold route retained — listed in `surface.json`)*
- **Happy path**: with a seeded user id → `200` with that user (API-224).
- **Validation failures**: unknown id → the scaffold's documented not-found shape, never a `500` (API-225).
- **Auth failures**: unchanged from the scaffold (API-226).
- **Idempotency / edge cases**: `passwordHash` absent from the payload (API-227).

---

## UI / journey tests

Playwright wait strategy per the stack contract: wait for `[data-testid="app-ready"]` and
`getAllAngularTestabilities().every(t => t.isStable())` before asserting.

### Journey: Logged-out front page (acceptance oracle)
- **Steps**: (1) clear `localStorage`; (2) navigate to `/`.
- **Expected outcomes**: URL redirects to `/explore` (UI-001); the header renders the literal text **`SnapGram`** while logged out (UI-002); `<title>` is `SnapGram` (UI-003); the explore grid renders with post image tiles, each `<img>` resolving `200` from `/api/media/...` (UI-004); a **Sign in** link is visible and no user menu (UI-005); none of the `.colossus-acceptance.json` reject signatures appear — no `home-title">Users<`, no `Loading...`, no `Failed to load users.` in the settled DOM (UI-006).
- **Negative path**: if `/api/posts/explore` returns `500`, an error state with a retry affordance renders and the `SnapGram` header is still present (UI-007); if it returns an empty list, an empty-state message renders rather than a blank page or a stuck spinner (UI-008).

### Journey: Signup
- **Steps**: (1) go to `/signup`; (2) fill email `newbie@demo`, displayName `Newbie`, password `Demo1234!`; (3) submit.
- **Expected outcomes**: navigation leaves `/signup`; the header shows the user menu for `Newbie` instead of Sign in (UI-009); a JWT is persisted in `localStorage` (UI-010); `/u/newbie` renders the new profile with 0 posts (UI-011).
- **Negative path**: a 7-char password shows an inline "at least 8 characters" message and the submit is blocked / no request fires (UI-012); a malformed email shows an inline validation message (UI-013); a duplicate email surfaces the **server's** message rather than a raw `HttpErrorResponse` and leaves the user on `/signup` with the form intact (UI-014).

### Journey: Login with returnUrl
- **Steps**: (1) logged out, navigate directly to `/feed`; (2) on the login page, submit `alice@demo` / `Demo1234!`.
- **Expected outcomes**: step 1 redirects to `/login?returnUrl=%2Ffeed` (UI-015); after login the app lands back on `/feed`, not on `/explore` (UI-016); the feed shows only posts from bob and carol (UI-017).
- **Negative path**: a wrong password shows an inline error, keeps the user on `/login`, preserves `?returnUrl=`, and writes no token to `localStorage` (UI-018). An expired/invalid token during a session triggers the interceptor's 401 handling: session cleared and redirect to `/login?returnUrl=<current url>` (UI-019).

### Journey: Guard redirects (auth / guest / moderator)
- **Steps**: attempt each protected route logged out, then as a `USER`, then as `mod`.
- **Expected outcomes**: logged out, `/feed`, `/upload`, and `/settings/profile` each redirect to `/login?returnUrl=<that route>` (UI-020, UI-021, UI-022); `/explore`, `/p/:id`, and `/u/:handle` stay viewable logged out (UI-023); a `USER` hitting `/moderation` is redirected away and never sees report rows (UI-024); `mod` reaches `/moderation` successfully (UI-025); an authenticated user hitting `/login` or `/signup` is bounced by `guestGuard` (UI-026); `/admin/settings` is reachable by `mod` and redirects a `USER` (UI-027); an unknown path renders the not-found view with `flow: 'not-found'` (UI-028).
- **Negative path**: guards must not flash protected content before redirecting — assert the protected component's testid never appears (UI-029).

### Journey: Upload a post
- **Steps**: (1) log in as alice; (2) go to `/upload` (a route, not a modal — the URL must be `/upload`); (3) choose a valid 200 KB JPEG; (4) type a caption; (5) submit.
- **Expected outcomes**: the app navigates to the new post's `/p/:postId` (or the feed) and the image renders (UI-030); the post appears first on `/u/alice` (newest-first) (UI-031) and on `/explore` (UI-032); the file input carries `accept="image/jpeg,image/png"` (UI-033).
- **Negative path**: selecting a 6 MB file triggers the **client-side** precheck message before any request (UI-034); if the client precheck is bypassed, the **server's** `Image exceeds 5 MB` string is displayed verbatim (UI-035); selecting a PDF is rejected with a type message and no post is created (UI-036); a 2201-char caption blocks submission with an inline counter/message (UI-037).

### Journey: Personalised feed + pagination
- **Steps**: (1) log in as alice (following bob and carol, who have 30 posts between them); (2) open `/feed`; (3) click **Load more**.
- **Expected outcomes**: 10 post cards render initially (UI-038); after Load more, exactly 20 cards render with **no duplicate post ids in the DOM** (`trackBy` post id) (UI-039); dave's posts never appear (UI-040); the URL updates to `?limit=20` via `replaceUrl:true` (UI-041); reloading `/feed?limit=20` restores 20 loaded posts in one shot (UI-042); when the cursor is exhausted the Load more button hides or disables (UI-043).
- **Negative path**: a `500` on the second page shows an error without discarding the already-rendered first page (UI-044).

### Journey: Post detail — like, comment, report
- **Steps**: (1) log in as bob; (2) open `/p/<alicePostId>`; (3) click Like; (4) click Like again; (5) type a comment and submit; (6) click Report → the URL gains `?modal=report`; (7) submit a reason.
- **Expected outcomes**: the like count increments optimistically then settles to the server's `likeCount` (UI-045); the second click returns the count to its original value and the button reverts to unliked (UI-046); the new comment appears in the list without a full reload and `commentCount` increments (UI-047); `?modal=report` opens the report dialog, and **deep-linking directly to `/p/:id?modal=report` opens it on load** (UI-048); submitting the report shows a confirmation and clears `?modal=report` from the URL (UI-049); browser Back after opening the dialog closes it and returns to the plain post URL (UI-050).
- **Negative path**: an empty comment is blocked with an inline message (UI-051); a 501-char comment is blocked (UI-052); logged out, Like and the comment box prompt sign-in / redirect to `/login?returnUrl=/p/:id` rather than erroring (UI-053); an empty report reason is blocked (UI-054).

### Journey: Profile view, tabs, follow / unfollow
- **Steps**: (1) log in as dave; (2) open `/u/bob`; (3) click Follow; (4) click Unfollow; (5) switch to the `followers` and `following` tabs; (6) open `/u/dave` (own profile).
- **Expected outcomes**: the profile shows avatar, displayName, bio, and post/follower/following counts (UI-055); the grid is newest-first (UI-056); Follow flips the button to Unfollow and increments the follower count by 1 (UI-057); Unfollow restores both (UI-058); tab clicks write `?tab=followers` / `?tab=following` to the URL (UI-059); **deep-linking `/u/bob?tab=followers` opens that tab directly on load** (UI-060); the follow button is **hidden** on your own profile (UI-061); logged out, `/u/bob` renders read-only with the follow button hidden or prompting sign-in (UI-062).
- **Negative path**: `/u/nosuchhandle` renders a not-found / empty profile state rather than a crash or infinite spinner (UI-063).

### Journey: Profile settings (isolation)
- **Steps**: (1) log in as alice; (2) open `/settings/profile`; (3) change displayName and bio; (4) save; (5) upload a new avatar.
- **Expected outcomes**: the form is prefilled with alice's current values (UI-064); after save, the header user menu and `/u/alice` both show the new displayName (UI-065); the avatar upload updates the visible avatar image and its `src` points at `/api/media/avatars/...` (UI-066); **`/u/bob` is completely unchanged after alice's edits** (UI-067).
- **Negative path**: an empty displayName is blocked with an inline message (UI-068); a 6 MB avatar surfaces the size error and leaves the old avatar in place (UI-069).

### Journey: Moderation queue
- **Steps**: (1) bob reports one of alice's posts; (2) log in as `mod`; (3) open `/moderation`; (4) filter `?status=open`; (5) click a row to open `?panel=<reportId>`; (6) click Remove.
- **Expected outcomes**: the reported post's report row is visible in the open queue with the reason and reporter handle (UI-070); `?status=open` / `?status=closed` filter the table and are reflected in the URL (UI-071); **deep-linking `/moderation?status=open&panel=<reportId>` opens the detail pane on load** (UI-072); Remove optimistically closes the row (UI-073); afterwards the post is gone from `/explore` (UI-074), gone from alice's `/u/alice` grid with `postCount` decremented (UI-075), and `/p/<removedId>` renders the not-found state (UI-076); the report now appears under `?status=closed` (UI-077).
- **Negative path**: a `USER` navigating to `/moderation` never renders the table (UI-078); if Remove returns a `403`/`500`, the optimistic row close is rolled back and an error is shown (UI-079).

### Journey: Admin settings
- **Steps**: (1) log in as `mod`; (2) open `/admin/settings`.
- **Expected outcomes**: one section per provisioned service (`postgresql`, `minio`, `llm`) and one for the S3-compatible object storage integration, each with a configured/unconfigured badge (UI-080); values are masked, never rendered in full (UI-081); the banner reads "The following need credentials to activate: S3-compatible object storage (AWS SDK v3 `@aws-sdk/client-s3`)." when that integration is unconfigured (UI-082); saving a credential re-renders the badge as configured (UI-083).
- **Negative path**: a `USER` is redirected away by `moderatorGuard` (UI-084); a `403`/`503` from the API surfaces the backend `message` rather than a raw error object (UI-085).

### Journey: URL addressability & error surfacing (cross-cutting)
- **Steps**: for every route in the table, navigate directly by URL in a fresh tab and assert the rendered state; then use browser back/forward across a representative path.
- **Expected outcomes**: every route in the frontend route table is directly addressable and carries its documented `data.flow` (UI-086); query state (`?tab=`, `?status=`, `?panel=`, `?modal=`, `?limit=`, `?returnUrl=`) survives a hard reload (UI-087); back/forward restores prior query state without duplicate history entries from `replaceUrl:true` patches (UI-088); every API error path (400/401/403/404/503) renders the backend's `message` string, never `[object Object]` or a stack trace (UI-089); no route ever leaves a permanent `Loading...` in the settled DOM (UI-090).
- **Negative path**: with the API entirely unreachable, the shell still renders `SnapGram` and each route shows an error state instead of a blank page (UI-091).

---

## Data integrity tests

- **DI-001** — `Post.likeCount` equals `COUNT(*)` of `Like` rows for that post after every like/unlike, including interleaved likes from 3 users; verified by direct DB query, not the API response.
- **DI-002** — `Post.commentCount` equals `COUNT(*)` of `Comment` rows for that post after every create/delete; never negative.
- **DI-003** — A failed comment create (empty / 501 chars) leaves `commentCount` and the `Comment` table untouched — the counter mutation is inside the same `$transaction` as the write.
- **DI-004** — A failed like transaction leaves no orphan `Like` row and no counter drift.
- **DI-005** — Author hard-delete of a post removes all dependent `Like`, `Comment`, and `Report` rows (`onDelete: Cascade`); zero rows reference the deleted `postId` afterwards.
- **DI-006** — Author hard-delete also removes the S3 object; `HeadObject` on the old key fails.
- **DI-007** — Moderator remove is a **soft** delete: the `Post` row still exists with `removedAt` non-null, and its `Like`/`Comment` rows are intact.
- **DI-008** — Every read path filters `removedAt: null` — a raw DB query for non-removed posts matches the union of what feed, explore, profile, and `GET /api/posts/:id` expose, for both an authenticated and an anonymous viewer.
- **DI-009** — `Follow` has no self-referential rows: `SELECT * FROM "Follow" WHERE "followerId" = "followeeId"` is empty after all follow tests.
- **DI-010** — `Follow` composite PK `(followerId, followeeId)` prevents duplicates: repeated follows leave exactly one row.
- **DI-011** — `Like` composite PK `(postId, userId)` prevents duplicates: exactly one row per user per post.
- **DI-012** — `Report` unique `(postId, reporterId)` prevents duplicates: a repeat report leaves exactly one row.
- **DI-013** — `User.email` and `User.handle` are both unique; a colliding handle derivation produces a suffixed handle rather than a constraint error.
- **DI-014** — `passwordHash` is a bcrypt hash (`$2a$`/`$2b$` prefix, cost 10), never the plaintext, and is absent from every API response body across all 29 endpoints.
- **DI-015** — Moderator remove closes reports atomically: after `POST /api/moderation/posts/:id/remove`, zero `Report` rows for that post remain `open`, and `removedAt` is set — asserted in a single post-transaction read.
- **DI-016** — **Seed idempotency**: on a fresh DB the seed yields 5 demo accounts (+ any `COLOSSUS_ACCOUNTS_JSON` accounts), alice with exactly 2 follows, 15 posts, ≥2 posts carrying likes and comments with counters matching row counts; running the seed a **second** time changes no row count in any table and mutates no `createdAt`.
- **DI-017** — Every seeded `Post.imageUrl` is fetchable through `GET /api/media/:key` and the returned bytes begin with the PNG signature `89 50 4E 47 0D 0A 1A 0A` — this catches hand-built CRC/zlib framing errors in the generated placeholders.
- **DI-018** — Post `imageKey` values match `posts/<uuid>.<ext>` and avatar keys match `avatars/<userId>.<ext>`; no two posts share an `imageKey`.
- **DI-019** — Cursor pagination on `(createdAt desc, id desc)` is total-ordered: paging a 30-post feed to exhaustion returns each id exactly once, with no gaps against a direct DB ordering of the same set.
- **DI-020** — Indexes declared in the schema exist in the applied migration: `Post(authorId, createdAt)`, `Post(createdAt)`, `Comment(postId, createdAt)`, `Follow(followerId)`, `Report(status, createdAt)`.
- **DI-021** — `prisma migrate deploy` on an empty database applies cleanly and is re-runnable with no pending-migration drift.
- **DI-022** — A rejected upload (oversize / wrong magic bytes) creates zero `Post` rows **and** zero S3 objects: bucket object count is identical before and after.

---

## Deploy / smoke tests

- **DEP-001** — Both Docker targets build from a clean checkout (`frontend` nginx image and `backend` image per `colossus.yaml`).
- **DEP-002** — `docker compose up` brings up Postgres, MinIO, backend, and frontend; the entrypoint runs migrate → seed → serve in that order and the process stays up.
- **DEP-003** — `curl /api/health/deep` against the running stack returns `200` confirming **both** Postgres and the bucket.
- **DEP-004** — `curl /` returns the SPA HTML containing `SnapGram`, and `/api/media/<seeded key>` returns image bytes through the same origin — proving `/api` is not swallowed by the SPA fallback (the top deploy-time risk).
- **DEP-005** — The dev proxy (`frontend/proxy.conf.json`) and the deployed nginx config both forward `/api` to the backend on port 3001, so the SPA and API share an origin in both environments.

---

## Out of scope

- **LLM behaviour.** `llm` is provisioned and surfaced read-only in `/admin/settings`; the spec describes no LLM feature, so no functional LLM tests exist.
- **The `NO_OTHER_THIRD_PARTY_APIS_PER_SPEC_API_KEY` integration.** A spec sentence mis-parsed as a service; no client module exists, so nothing is tested.
- **Single-container topology (`ServeStaticModule` on port 3000, `/app/static`, `entrypoint.sh`).** The spec assumes it; `colossus.yaml` and the task decomposition specify two Docker targets with backend on 3001. Tests target the two-target contract. **If the deploy chain is re-scoped to the single container, DEP-001/002/004 must be rewritten.**
- **Presigned S3 URLs.** The spec documents presigning only as an escape hatch; the implemented path proxies through `/api/media/:key`, so presigned-URL semantics are untested.
- **Rate limiting, CSRF, account lockout, email verification, password reset.** The spec is silent on all of them.
- **Image transformation** (resizing, thumbnails, EXIF stripping, orientation). The spec stores and serves the original bytes.
- **Real-time updates** (websockets, polling for new posts/comments). The spec has no push surface.
- **Notifications, search, hashtags, DMs, blocking, post editing of the image itself.** Not in the spec.
- **JWT refresh/rotation and server-side logout.** The spec specifies a 7-day HS256 token in `localStorage` with no refresh flow, so only expiry rejection (API-033) is tested.
- **Accessibility, responsive breakpoints, and visual regression.** No UI library and no design spec; only the semantic `data-testid` contract is asserted.
- **Load, latency, and concurrency benchmarks.** Media-proxy latency is a documented accepted risk at demo scale; only the immutable `Cache-Control` header is asserted (API-200).
- **Per-component file-budget enforcement** (`maxLines: 400` / `hardLimit: 500` from `surface.json`) is a lint concern, not a behavioural test.
