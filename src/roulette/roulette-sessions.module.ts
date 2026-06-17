import { Module } from '@nestjs/common';

import { RouletteSessionsController } from './roulette-sessions.controller';
import { RouletteSessionsService } from './roulette-sessions.service';

@Module({
  controllers: [RouletteSessionsController],
  providers: [RouletteSessionsService]
})
export class RouletteSessionsModule {}
