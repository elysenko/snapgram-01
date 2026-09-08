import { Global, Module } from '@nestjs/common';
import { ConfigResolver } from './config';

/** Global so any feature module can inject ConfigResolver without re-importing. */
@Global()
@Module({
  providers: [ConfigResolver],
  exports: [ConfigResolver],
})
export class AppConfigModule {}
