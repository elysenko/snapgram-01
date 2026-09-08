import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Sentinel written by the deploy pipeline for a key it knows about but has no
 * value for. Treated exactly like "unset" everywhere.
 */
export const PLACEHOLDER = 'PLACEHOLDER_CONFIGURE_IN_SETTINGS';

/**
 * Thrown when a third-party integration is used before its credentials exist.
 * Mapped to HTTP 503 by ServiceUnconfiguredFilter — a missing integration key
 * degrades that one feature, it never crash-loops the pod.
 */
export class ServiceUnconfiguredError extends Error {
  constructor(
    readonly service: string,
    readonly missingKeys: string[],
  ) {
    super(
      `${service} is not configured — missing ${missingKeys.join(', ')}. ` +
        `Set the values in Admin → Settings or provide them as environment variables.`,
    );
    this.name = 'ServiceUnconfiguredError';
  }
}

/**
 * Alternate environment variable names accepted for a canonical key.
 *
 * The platform provisions MinIO with MINIO_* names while the app is written
 * against S3_*; resolving through this table means the deployed pod works with
 * the credentials it is actually given, with no manual settings step.
 */
const ENV_ALIASES: Record<string, string[]> = {
  S3_ENDPOINT: ['S3_ENDPOINT', 'MINIO_ENDPOINT', 'AWS_ENDPOINT_URL'],
  S3_BUCKET: ['S3_BUCKET', 'MINIO_BUCKET', 'S3_BUCKET_NAME'],
  S3_REGION: ['S3_REGION', 'MINIO_REGION', 'AWS_REGION'],
  S3_ACCESS_KEY_ID: ['S3_ACCESS_KEY_ID', 'MINIO_ROOT_USER', 'MINIO_ACCESS_KEY', 'AWS_ACCESS_KEY_ID'],
  S3_SECRET_ACCESS_KEY: [
    'S3_SECRET_ACCESS_KEY',
    'MINIO_ROOT_PASSWORD',
    'MINIO_SECRET_KEY',
    'AWS_SECRET_ACCESS_KEY',
  ],
  S3_FORCE_PATH_STYLE: ['S3_FORCE_PATH_STYLE'],
  DATABASE_URL: ['DATABASE_URL'],
  JWT_SECRET: ['JWT_SECRET'],
};

/** Values used when neither the environment nor the settings table supplies one. */
const DEFAULTS: Record<string, string> = {
  S3_BUCKET: 'snapgram',
  S3_REGION: 'us-east-1',
  S3_FORCE_PATH_STYLE: 'true',
};

function usable(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim() !== '' && value !== PLACEHOLDER;
}

/** Read a canonical key straight from the environment, honouring aliases. */
export function readEnv(key: string): string | null {
  for (const candidate of ENV_ALIASES[key] ?? [key]) {
    const value = process.env[candidate];
    if (usable(value)) {
      return value;
    }
  }
  return null;
}

/**
 * Resolves configuration with a fixed priority:
 *   1. environment variable (including known aliases)
 *   2. SystemSetting row written through Admin → Settings
 *   3. a built-in default, if the key has one
 *   4. null — the caller decides whether that is fatal
 */
@Injectable()
export class ConfigResolver {
  private readonly logger = new Logger(ConfigResolver.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolve(key: string): Promise<string | null> {
    const fromEnv = readEnv(key);
    if (fromEnv !== null) {
      return fromEnv;
    }

    try {
      const row = await this.prisma.systemSetting.findUnique({ where: { key } });
      if (usable(row?.value)) {
        return row.value;
      }
    } catch (error) {
      // The settings table may not exist yet (first boot, pre-migration). A
      // config lookup must never take the process down.
      this.logger.warn(
        `SystemSetting lookup for "${key}" failed: ${(error as Error).message}`,
      );
    }

    return DEFAULTS[key] ?? null;
  }

  /** Resolve several keys at once; missing ones come back as null. */
  async resolveAll(keys: string[]): Promise<Record<string, string | null>> {
    const entries = await Promise.all(
      keys.map(async (key) => [key, await this.resolve(key)] as const),
    );
    return Object.fromEntries(entries);
  }

  /** Resolve keys and throw ServiceUnconfiguredError if any are still missing. */
  async require(service: string, keys: string[]): Promise<Record<string, string>> {
    const resolved = await this.resolveAll(keys);
    const missing = keys.filter((key) => resolved[key] === null);
    if (missing.length > 0) {
      throw new ServiceUnconfiguredError(service, missing);
    }
    return resolved as Record<string, string>;
  }
}
