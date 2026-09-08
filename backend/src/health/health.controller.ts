import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export interface DeepHealth {
  status: 'ok' | 'degraded';
  checks: {
    database: 'ok' | 'error';
    storage: 'ok' | 'error';
  };
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Liveness. Deliberately dependency-free — it answers while Postgres or the
   * bucket are down, which is exactly what a restart-on-failure probe needs.
   */
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /**
   * Readiness. Reports each dependency separately and still answers 200 when
   * one is failing, so an operator can tell "storage is down" apart from "the
   * API is down" instead of getting an opaque 503 for both.
   */
  @Get('deep')
  async deep(): Promise<DeepHealth> {
    const [database, storage] = await Promise.all([
      this.prisma
        .$queryRaw`SELECT 1`.then(() => 'ok' as const)
        .catch(() => 'error' as const),
      this.storage.healthy().then((ok) => (ok ? ('ok' as const) : ('error' as const))),
    ]);

    return {
      status: database === 'ok' && storage === 'ok' ? 'ok' : 'degraded',
      checks: { database, storage },
    };
  }
}
