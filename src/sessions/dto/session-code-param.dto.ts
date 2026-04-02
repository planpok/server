import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class SessionCodeParamDto {
  @ApiProperty({ example: 'ABC123' })
  @IsString()
  @Length(4, 12)
  code!: string;
}
