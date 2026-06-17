import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RouletteOwnerActionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  ownerToken!: string;
}
