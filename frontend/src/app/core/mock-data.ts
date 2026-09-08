import { AdminSetting, PostComment, PostSummary, Report, UserProfile, UserSummary } from './models';

/* ------------------------------------------------------------------ *
 * Placeholder imagery
 *
 * The preview is a static bundle with no API and no network, so post images
 * are generated as inline SVG data URIs — deterministic per seed, so the same
 * post always renders the same picture across screens and reloads.
 * ------------------------------------------------------------------ */

const PALETTES: ReadonlyArray<readonly [string, string, string]> = [
  ['#7c3aed', '#ec4899', '#fbbf24'],
  ['#0ea5e9', '#6366f1', '#a855f7'],
  ['#f97316', '#ef4444', '#7c2d12'],
  ['#10b981', '#0ea5e9', '#134e4a'],
  ['#f43f5e', '#8b5cf6', '#1e1b4b'],
  ['#facc15', '#f97316', '#7c2d12'],
  ['#22d3ee', '#3b82f6', '#1e3a8a'],
  ['#a3e635', '#16a34a', '#14532d'],
  ['#e879f9', '#6366f1', '#312e81'],
  ['#fb7185', '#fdba74', '#9a3412'],
  ['#38bdf8', '#818cf8', '#0f172a'],
  ['#fcd34d', '#34d399', '#065f46'],
];

export function photo(seed: number): string {
  const [a, b, c] = PALETTES[Math.abs(seed) % PALETTES.length];
  const rot = (seed * 37) % 360;
  const cx = 20 + ((seed * 53) % 60);
  const cy = 25 + ((seed * 29) % 50);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">` +
    `<defs>` +
    `<linearGradient id="g" gradientTransform="rotate(${rot} 0.5 0.5)">` +
    `<stop offset="0%" stop-color="${a}"/><stop offset="55%" stop-color="${b}"/><stop offset="100%" stop-color="${c}"/>` +
    `</linearGradient>` +
    `<radialGradient id="h"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>` +
    `<stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></radialGradient>` +
    `</defs>` +
    `<rect width="600" height="600" fill="url(#g)"/>` +
    `<circle cx="${cx * 6}" cy="${cy * 6}" r="190" fill="url(#h)"/>` +
    `<circle cx="${600 - cx * 5}" cy="${600 - cy * 4}" r="120" fill="#ffffff" opacity="0.10"/>` +
    `<path d="M0 ${380 + (seed % 7) * 14} Q 150 ${300 - (seed % 5) * 20} 300 ${370 + (seed % 4) * 16} T 600 ${340}` +
    ` L600 600 L0 600 Z" fill="#0b0d12" opacity="0.22"/>` +
    `<path d="M0 ${470 + (seed % 5) * 10} Q 200 ${420} 380 ${480} T 600 ${450} L600 600 L0 600 Z" fill="#0b0d12" opacity="0.18"/>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* ------------------------------------------------------------------ *
 * People
 * ------------------------------------------------------------------ */

export const ALICE: UserSummary = { id: 'usr_alice', handle: 'alice', displayName: 'Alice Nakamura', avatarUrl: null, role: 'USER' };
export const BOB: UserSummary = { id: 'usr_bob', handle: 'bob', displayName: 'Bob Okonkwo', avatarUrl: null, role: 'USER' };
export const CAROL: UserSummary = { id: 'usr_carol', handle: 'carol', displayName: 'Carol Lindqvist', avatarUrl: null, role: 'USER' };
export const DAVE: UserSummary = { id: 'usr_dave', handle: 'dave', displayName: 'Dave Moreau', avatarUrl: null, role: 'USER' };
export const MOD: UserSummary = { id: 'usr_mod', handle: 'mod', displayName: 'Priya Raman', avatarUrl: null, role: 'ADMIN' };

export const MOCK_PEOPLE: UserSummary[] = [ALICE, BOB, CAROL, DAVE, MOD];

const BIOS: Record<string, string> = {
  alice: 'Golden hour chaser. Film + digital. Tokyo → Lisbon.',
  bob: 'Architecture, concrete, and long shadows. Lagos based.',
  carol: 'Cold water swimmer. I photograph the sea most mornings.',
  dave: 'Street food, neon, and the 35mm lens that never leaves my bag.',
  mod: 'Community moderator at SnapGram. Keeping the feed kind.',
};

export const MOCK_PROFILES: UserProfile[] = [
  { ...ALICE, email: 'alice@snapgram.app', bio: BIOS['alice'], createdAt: '2025-11-04', postCount: 10, followerCount: 1284, followingCount: 212, viewerFollows: false },
  { ...BOB, email: 'bob@snapgram.app', bio: BIOS['bob'], createdAt: '2025-12-12', postCount: 10, followerCount: 842, followingCount: 190, viewerFollows: true },
  { ...CAROL, email: 'carol@snapgram.app', bio: BIOS['carol'], createdAt: '2026-01-08', postCount: 10, followerCount: 2310, followingCount: 88, viewerFollows: true },
  { ...DAVE, email: 'dave@snapgram.app', bio: BIOS['dave'], createdAt: '2026-02-19', postCount: 9, followerCount: 431, followingCount: 305, viewerFollows: false },
  { ...MOD, email: 'mod@snapgram.app', bio: BIOS['mod'], createdAt: '2025-10-01', postCount: 9, followerCount: 96, followingCount: 41, viewerFollows: false },
];

/* ------------------------------------------------------------------ *
 * Posts
 * ------------------------------------------------------------------ */

const CAPTIONS: string[] = [
  'Six flights of stairs for thirty seconds of light. Worth every step.',
  'The tide came in faster than the plan did.',
  'Rooftop, 5:42am. Nobody else awake but the gulls.',
  'Concrete + fog. My two favourite textures in one frame.',
  'Found this door on a street I have walked a hundred times.',
  'Swim number 84 of the year. Still cold. Still worth it.',
  'Neon season. Shot wide open and hoped for the best.',
  'The espresso was terrible and the view was perfect.',
  'Last frame on the roll, and of course it was the one.',
  'Walked 14km for this bend in the river.',
  'Sunday market colours, no filter needed.',
  'Storm rolling in over the headland — stayed too long.',
  'Blue hour on the old harbour wall.',
  'She waited for the train, I waited for the light.',
  'Three coats of paint and forty years of sun.',
  'A very good dog in a very good doorway.',
  'Steam, salt, and a queue around the corner.',
  'Long exposure, short patience.',
  'Nothing here but scale and silence.',
  'The whole street smelled like grilled corn.',
  'Reflections are cheating and I do not care.',
  'Backlit dust is the free upgrade nobody talks about.',
  'Ninety minutes of walking, one frame kept.',
  'End of the pier, end of the day.',
];

const AUTHOR_CYCLE: UserSummary[] = [ALICE, BOB, CAROL, DAVE, MOD];
const AGO = ['12m', '48m', '2h', '3h', '5h', '8h', '11h', '1d', '1d', '2d', '2d', '3d', '3d', '4d', '5d', '6d', '1w', '1w', '2w', '2w', '3w', '3w', '1mo', '1mo'];

function buildPost(index: number): PostSummary {
  const author = AUTHOR_CYCLE[index % AUTHOR_CYCLE.length];
  return {
    id: `post_${String(index + 1).padStart(2, '0')}`,
    author,
    imageUrl: photo(index + 3),
    caption: CAPTIONS[index % CAPTIONS.length],
    likeCount: 34 + ((index * 47) % 820),
    commentCount: index % 4 === 0 ? 0 : 1 + ((index * 7) % 24),
    viewerHasLiked: index % 5 === 1,
    removedAt: null,
    createdAt: AGO[index % AGO.length],
  };
}

/** Every post in the demo library, newest first. */
export const MOCK_ALL_POSTS: PostSummary[] = Array.from({ length: 48 }, (_, i) => buildPost(i));

/** 24 newest-first posts from every member — the public explore grid. */
export const MOCK_EXPLORE_POSTS: PostSummary[] = MOCK_ALL_POSTS.slice(0, 24);

/** Posts from the accounts the signed-in member follows (bob + carol). */
export const MOCK_FEED_POSTS: PostSummary[] = MOCK_ALL_POSTS.filter(
  (post) => post.author.handle === 'bob' || post.author.handle === 'carol',
);

/** Posts authored by a given member, newest first. */
export function postsByHandle(handle: string): PostSummary[] {
  return MOCK_ALL_POSTS.filter((post) => post.author.handle === handle);
}

export const MOCK_COMMENTS: PostComment[] = [
  { id: 'cmt_1', postId: 'post_01', author: BOB, text: 'That light is unreal. What time was this?', createdAt: '2h' },
  { id: 'cmt_2', postId: 'post_01', author: CAROL, text: 'The stairs paid off. Saving this one.', createdAt: '1h' },
  { id: 'cmt_3', postId: 'post_01', author: DAVE, text: 'Colour grade is doing a lot of heavy lifting here 👏', createdAt: '44m' },
  { id: 'cmt_4', postId: 'post_02', author: ALICE, text: 'I have walked past that wall so many times.', createdAt: '5h' },
  { id: 'cmt_5', postId: 'post_02', author: MOD, text: 'Featured this on the community picks board.', createdAt: '3h' },
  { id: 'cmt_6', postId: 'post_03', author: DAVE, text: 'Gulls: the only reliable models.', createdAt: '20m' },
];

/* ------------------------------------------------------------------ *
 * Moderation
 * ------------------------------------------------------------------ */

export const MOCK_REPORTS: Report[] = [
  { id: 'rep_1041', postId: 'post_07', post: MOCK_EXPLORE_POSTS[6], reporter: CAROL, reason: 'Caption contains a phone number and an off-platform sales link.', status: 'open', createdAt: '18m' },
  { id: 'rep_1040', postId: 'post_12', post: MOCK_EXPLORE_POSTS[11], reporter: DAVE, reason: 'Reposted from another photographer without credit — I recognise this frame.', status: 'open', createdAt: '2h' },
  { id: 'rep_1039', postId: 'post_04', post: MOCK_EXPLORE_POSTS[3], reporter: BOB, reason: 'Repeated spam comments from this account under the same image.', status: 'open', createdAt: '6h' },
  { id: 'rep_1038', postId: 'post_19', post: MOCK_EXPLORE_POSTS[18], reporter: ALICE, reason: 'Image appears to show a private address plate in full.', status: 'open', createdAt: '1d' },
  { id: 'rep_1035', postId: 'post_22', post: MOCK_EXPLORE_POSTS[21], reporter: CAROL, reason: 'Misleading location claim in the caption.', status: 'closed', createdAt: '3d' },
  { id: 'rep_1031', postId: 'post_16', post: MOCK_EXPLORE_POSTS[15], reporter: DAVE, reason: 'Duplicate upload spamming the explore grid.', status: 'closed', createdAt: '5d' },
];

export const REPORT_REASONS: string[] = [
  'Spam or misleading',
  'Nudity or sexual content',
  'Harassment or hate speech',
  'Copyright — this is my photo',
  'Violence or dangerous acts',
  'Something else',
];

/* ------------------------------------------------------------------ *
 * Admin settings
 * ------------------------------------------------------------------ */

export const MOCK_ADMIN_SETTINGS: AdminSetting[] = [
  { key: 'DATABASE_URL', group: 'postgresql', groupLabel: 'PostgreSQL', label: 'Connection string', value: 'postgresql://••••••@app-db:5432/snapgram', configured: true, hint: 'Primary application database.' },
  { key: 'S3_ENDPOINT', group: 'minio', groupLabel: 'MinIO object storage', label: 'Endpoint', value: 'http://minio:9000', configured: true, hint: 'S3-compatible endpoint used for post images and avatars.' },
  { key: 'S3_BUCKET', group: 'minio', groupLabel: 'MinIO object storage', label: 'Bucket', value: 'snapgram-media', configured: true, hint: 'Bucket that stores posts/<uuid> and avatars/<userId>.' },
  { key: 'S3_REGION', group: 'minio', groupLabel: 'MinIO object storage', label: 'Region', value: 'us-east-1', configured: true, hint: 'Region string sent with every request.' },
  { key: 'S3_ACCESS_KEY_ID', group: 'integration', groupLabel: 'S3-compatible object storage (AWS SDK v3)', label: 'Access key ID', value: '', configured: false, hint: 'Needed before uploads and /api/media/:key can serve images.' },
  { key: 'S3_SECRET_ACCESS_KEY', group: 'integration', groupLabel: 'S3-compatible object storage (AWS SDK v3)', label: 'Secret access key', value: '', configured: false, hint: 'Stored encrypted; shown masked once saved.' },
  { key: 'LLM_API_KEY', group: 'llm', groupLabel: 'LLM service', label: 'API key', value: '', configured: false, hint: 'Provisioned but unused — no LLM feature is enabled in SnapGram.' },
];
