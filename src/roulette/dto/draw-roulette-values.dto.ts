import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

import { RouletteOwnerActionDto } from './roulette-owner-action.dto';

export class DrawRouletteValuesDto extends RouletteOwnerActionDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  count?: number;
}
