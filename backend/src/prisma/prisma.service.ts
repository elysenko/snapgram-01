import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /**
   * Nest calls this on shutdown, which is the supported way to close the pool.
   * (Prisma 6's library engine does not emit `beforeExit`, so the old
   * `$on('beforeExit')` hook this replaces could never have fired.)
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
