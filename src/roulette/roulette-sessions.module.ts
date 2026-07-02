import { Module } from '@nestjs/common';

import { RouletteMcpController } from './roulette-mcp.controller';
import { RouletteMcpService } from './roulette-mcp.service';
import { RouletteSessionsController } from './roulette-sessions.controller';
import { RouletteSessionsService } from './roulette-sessions.service';

@Module({
  controllers: [RouletteSessionsController, RouletteMcpController],
  providers: [RouletteSessionsService, RouletteMcpService]
})
export class RouletteSessionsModule {}
