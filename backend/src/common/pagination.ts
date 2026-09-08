import { BadRequestException } from '@nestjs/common';

/**
 * Keyset cursor over the composite ordering (createdAt desc, id desc).
 *
 * Encoding the sort key itself — rather than an offset — is what makes paging
 * duplicate-free and gap-free while rows are being inserted underneath.
 */
export interface Cursor {
  createdAt: Date;
  id: string;
}

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): Cursor {
  let decoded: string;
  try {
    decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    throw new BadRequestException('Malformed cursor');
  }
  const separator = decoded.indexOf('|');
  if (separator === -1) {
    throw new BadRequestException('Malformed cursor');
  }
  const createdAt = new Date(decoded.slice(0, separator));
  const id = decoded.slice(separator + 1);
  if (Number.isNaN(createdAt.getTime()) || id === '') {
    throw new BadRequestException('Malformed cursor');
  }
  return { createdAt, id };
}

/**
 * Prisma `where` fragment selecting rows strictly after the cursor under
 * (createdAt desc, id desc). `id` breaks ties so identical timestamps — which
 * seeded and bulk-created rows routinely share — can never repeat or skip.
 */
export function cursorWhere(cursor?: string) {
  if (!cursor) {
    return {};
  }
  const { createdAt, id } = decodeCursor(cursor);
  return {
    OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }],
  };
}

/** Ascending variant, used by comment listing (oldest first). */
export function cursorWhereAsc(cursor?: string) {
  if (!cursor) {
    return {};
  }
  const { createdAt, id } = decodeCursor(cursor);
  return {
    OR: [{ createdAt: { gt: createdAt } }, { createdAt, id: { gt: id } }],
  };
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * Split an over-fetched result (limit + 1 rows) into a page plus the cursor for
 * the following one. Fetching one extra row is how we know whether a next page
 * exists without a second COUNT query.
 */
export function toPage<T extends { id: string; createdAt: Date }, R>(
  rows: T[],
  limit: number,
  map: (row: T) => R,
): Page<R> {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return {
    items: page.map(map),
    nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
  };
}
