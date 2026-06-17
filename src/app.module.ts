import { Module } from '@nestjs/common';

import { RouletteSessionsModule } from './roulette/roulette-sessions.module';
import { SessionsModule } from './sessions/sessions.module';

@Module({
  imports: [SessionsModule, RouletteSessionsModule]
})
export class AppModule {}
