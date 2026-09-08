import { Logger } from '@nestjs/common';
import { Readable } from 'node:stream';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ConfigResolver, ServiceUnconfiguredError } from '../config';

export const S3_SERVICE_NAME = 'S3-compatible object storage (AWS SDK v3)';

/** Canonical keys this integration needs before it can serve a single byte. */
export const S3_REQUIRED_KEYS = [
  'S3_ENDPOINT',
  'S3_BUCKET',
  'S3_REGION',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
];

export interface S3Object {
  body: Readable;
  contentType: string;
  contentLength?: number;
}

/** Raised when a key is absent from the bucket; mapped to 404 by callers. */
export class ObjectNotFoundError extends Error {
  constructor(key: string) {
    super(`No object stored at key "${key}"`);
    this.name = 'ObjectNotFoundError';
  }
}

function isNotFound(error: unknown): boolean {
  const candidate = error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  return (
    candidate?.name === 'NoSuchKey' ||
    candidate?.name === 'NotFound' ||
    candidate?.Code === 'NoSuchKey' ||
    candidate?.$metadata?.httpStatusCode === 404
  );
}

/**
 * Thin typed wrapper over @aws-sdk/client-s3 pointed at the provisioned bucket.
 *
 * The client is built lazily on first use so that missing credentials surface as
 * a 503 on the one route that needs them rather than as a boot failure.
 */
export class S3ObjectStorage {
  private readonly logger = new Logger(S3ObjectStorage.name);
  private client: S3Client | null = null;
  private bucket: string | null = null;

  constructor(private readonly config: ConfigResolver) {}

  private async connect(): Promise<{ client: S3Client; bucket: string }> {
    if (this.client && this.bucket) {
      return { client: this.client, bucket: this.bucket };
    }

    const resolved = await this.config.require(S3_SERVICE_NAME, S3_REQUIRED_KEYS);
    const forcePathStyle = (await this.config.resolve('S3_FORCE_PATH_STYLE')) !== 'false';

    this.client = new S3Client({
      endpoint: resolved.S3_ENDPOINT,
      region: resolved.S3_REGION,
      credentials: {
        accessKeyId: resolved.S3_ACCESS_KEY_ID,
        secretAccessKey: resolved.S3_SECRET_ACCESS_KEY,
      },
      // MinIO and most self-hosted S3 gateways cannot do virtual-host addressing.
      forcePathStyle,
    });
    this.bucket = resolved.S3_BUCKET;
    return { client: this.client, bucket: this.bucket };
  }

  /** Drop the memoised client so the next call re-reads configuration. */
  reset(): void {
    this.client = null;
    this.bucket = null;
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    const { client, bucket } = await this.connect();
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async getObject(key: string): Promise<S3Object> {
    const { client, bucket } = await this.connect();
    try {
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!result.Body) {
        throw new ObjectNotFoundError(key);
      }
      return {
        body: result.Body as Readable,
        contentType: result.ContentType ?? 'application/octet-stream',
        contentLength: result.ContentLength,
      };
    } catch (error) {
      if (isNotFound(error)) {
        throw new ObjectNotFoundError(key);
      }
      throw error;
    }
  }

  /** Best-effort delete — a missing object is treated as already deleted. */
  async deleteObject(key: string): Promise<void> {
    const { client, bucket } = await this.connect();
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (error) {
      if (!isNotFound(error)) {
        throw error;
      }
    }
  }

  async headBucket(): Promise<void> {
    const { client, bucket } = await this.connect();
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  }

  /**
   * Make sure the bucket exists, creating it when the credentials allow.
   * Called once at startup; failures are logged, never thrown, so the read-only
   * half of the app (explore, profiles) still serves when storage is down.
   */
  async ensureBucket(): Promise<boolean> {
    try {
      await this.headBucket();
      return true;
    } catch (error) {
      if (error instanceof ServiceUnconfiguredError) {
        this.logger.warn(`Object storage unconfigured: ${error.message}`);
        return false;
      }
      try {
        const { client, bucket } = await this.connect();
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
        this.logger.log(`Created missing object storage bucket "${bucket}"`);
        return true;
      } catch (createError) {
        this.logger.warn(
          `Object storage bucket is unavailable — uploads and /api/media will fail ` +
            `until it is reachable: ${(createError as Error).message}`,
        );
        return false;
      }
    }
  }
}
