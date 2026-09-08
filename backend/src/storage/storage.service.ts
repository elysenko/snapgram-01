import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfigResolver } from '../lib/config';
import {
  ObjectNotFoundError,
  S3Object,
  S3ObjectStorage,
} from '../lib/integrations/s3-object-storage';

export { ObjectNotFoundError };

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly storage: S3ObjectStorage;

  constructor(config: ConfigResolver) {
    this.storage = new S3ObjectStorage(config);
  }

  /**
   * Probe the bucket once at startup, creating it when possible.
   *
   * Deliberately swallows every failure: object storage being unreachable must
   * degrade uploads and /api/media only. The SPA, the feed and every other read
   * path have to keep serving, so this can never reject and abort boot.
   */
  async onModuleInit(): Promise<void> {
    try {
      const ready = await this.storage.ensureBucket();
      if (ready) {
        this.logger.log('Object storage bucket is reachable');
      }
    } catch (error) {
      this.logger.warn(`Object storage probe failed: ${(error as Error).message}`);
    }
  }

  /** Deterministic key so re-uploading an avatar overwrites the previous one. */
  avatarKey(userId: string, ext: string): string {
    return `avatars/${userId}.${ext}`;
  }

  /** Random key so two uploads of identical bytes stay distinct posts. */
  postKey(ext: string): string {
    return `posts/${randomUUID()}.${ext}`;
  }

  /** The public proxy path stored on the row and returned to clients. */
  publicUrl(key: string): string {
    return `/api/media/${key}`;
  }

  putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    return this.storage.putObject(key, body, contentType);
  }

  getObject(key: string): Promise<S3Object> {
    return this.storage.getObject(key);
  }

  deleteObject(key: string): Promise<void> {
    return this.storage.deleteObject(key);
  }

  /**
   * Best-effort delete used when a row is being removed. A storage failure must
   * not roll back the database delete the user asked for.
   */
  async deleteObjectQuietly(key: string): Promise<void> {
    try {
      await this.storage.deleteObject(key);
    } catch (error) {
      this.logger.warn(`Could not delete object "${key}": ${(error as Error).message}`);
    }
  }

  /**
   * Drop the memoised S3 client so the next call re-reads configuration.
   * Called after Admin -> Settings writes new credentials, which otherwise would
   * not take effect until the process restarted.
   */
  reconfigure(): void {
    this.storage.reset();
  }

  async healthy(): Promise<boolean> {
    try {
      await this.storage.headBucket();
      return true;
    } catch {
      return false;
    }
  }
}
