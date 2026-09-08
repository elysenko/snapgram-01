import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigResolver, PLACEHOLDER } from '../lib/config';
import { StorageService } from '../storage/storage.service';

export interface AdminSetting {
  key: string;
  group: string;
  groupLabel: string;
  label: string;
  value: string;
  configured: boolean;
  hint: string;
}

interface SettingDefinition {
  key: string;
  group: string;
  groupLabel: string;
  label: string;
  hint: string;
  /** Secrets are never echoed back in full, only as a masked preview. */
  secret: boolean;
}

/**
 * The credential surface shown in Admin → Settings: one entry per provisioned
 * service plus the S3 integration keys the upload feature needs.
 */
const DEFINITIONS: SettingDefinition[] = [
  {
    key: 'DATABASE_URL',
    group: 'postgresql',
    groupLabel: 'PostgreSQL',
    label: 'Connection string',
    hint: 'Primary application database.',
    secret: true,
  },
  {
    key: 'S3_ENDPOINT',
    group: 'minio',
    groupLabel: 'MinIO object storage',
    label: 'Endpoint',
    hint: 'S3-compatible endpoint used for post images and avatars.',
    secret: false,
  },
  {
    key: 'S3_BUCKET',
    group: 'minio',
    groupLabel: 'MinIO object storage',
    label: 'Bucket',
    hint: 'Bucket that stores posts/<uuid> and avatars/<userId>.',
    secret: false,
  },
  {
    key: 'S3_REGION',
    group: 'minio',
    groupLabel: 'MinIO object storage',
    label: 'Region',
    hint: 'Region string sent with every request.',
    secret: false,
  },
  {
    key: 'S3_ACCESS_KEY_ID',
    group: 'integration',
    groupLabel: 'S3-compatible object storage (AWS SDK v3)',
    label: 'Access key ID',
    hint: 'Needed before uploads and /api/media/:key can serve images.',
    secret: true,
  },
  {
    key: 'S3_SECRET_ACCESS_KEY',
    group: 'integration',
    groupLabel: 'S3-compatible object storage (AWS SDK v3)',
    label: 'Secret access key',
    hint: 'Stored encrypted; shown masked once saved.',
    secret: true,
  },
  {
    key: 'LLM_API_KEY',
    group: 'llm',
    groupLabel: 'LLM service',
    label: 'API key',
    hint: 'Provisioned but unused — no LLM feature is enabled in SnapGram.',
    secret: false,
  },
];

const WRITABLE_KEYS = new Set(DEFINITIONS.map((definition) => definition.key));

/**
 * Replace a secret with a short, non-reversible preview.
 * Never returns enough of the value to be usable as a credential.
 */
function mask(value: string): string {
  if (value.length <= 4) {
    return '••••';
  }
  return `${value.slice(0, 2)}••••••${value.slice(-2)}`;
}

@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigResolver,
    private readonly storage: StorageService,
  ) {}

  /** Effective value per key, with secrets masked before they leave the process. */
  async list(): Promise<AdminSetting[]> {
    return Promise.all(
      DEFINITIONS.map(async (definition) => {
        const resolved = await this.config.resolve(definition.key);
        const configured = resolved !== null && resolved !== PLACEHOLDER && resolved !== '';
        const value = !configured ? '' : definition.secret ? mask(resolved) : resolved;

        return {
          key: definition.key,
          group: definition.group,
          groupLabel: definition.groupLabel,
          label: definition.label,
          value,
          configured,
          hint: definition.hint,
        };
      }),
    );
  }

  /**
   * Upsert overrides into SystemSetting.
   *
   * Only keys this module declares are writable — an unknown key is a 400 so a
   * typo cannot quietly create a row nothing will ever read.
   */
  async update(body: unknown): Promise<{ updated: string[] }> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Body must be an object of setting key/value pairs');
    }

    const entries = Object.entries(body as Record<string, unknown>);
    if (entries.length === 0) {
      throw new BadRequestException('No settings supplied');
    }

    for (const [key, value] of entries) {
      if (!WRITABLE_KEYS.has(key)) {
        throw new BadRequestException(`Unknown setting "${key}"`);
      }
      if (typeof value !== 'string') {
        throw new BadRequestException(`Setting "${key}" must be a string`);
      }
    }

    await this.prisma.$transaction(
      entries.map(([key, value]) =>
        this.prisma.systemSetting.upsert({
          where: { key },
          update: { value: value as string },
          create: { key, value: value as string },
        }),
      ),
    );

    // The S3 client memoises endpoint, bucket and credentials on first use, so
    // new values would otherwise sit in the table unused until the next restart.
    this.storage.reconfigure();

    return { updated: entries.map(([key]) => key) };
  }
}
