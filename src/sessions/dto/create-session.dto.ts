import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({ example: 'Maxime' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @ApiProperty({
    example: ['1', '2', '3', '5', '8', '13', '?'],
    type: [String]
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  deck!: string[];

  @ApiProperty({
    example: ['Frontend', 'Backend'],
    type: [String],
    required: false
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groups?: string[];
}
