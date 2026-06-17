import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

import { RouletteOwnerActionDto } from './roulette-owner-action.dto';

export class AddRouletteValueDto extends RouletteOwnerActionDto {
  @ApiProperty({ example: 'Backend' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  value!: string;
}
