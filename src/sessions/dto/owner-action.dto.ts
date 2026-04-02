import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class OwnerActionDto {
  @ApiProperty({ example: 'participant_abc123' })
  @IsString()
  @Length(1, 100)
  participantId!: string;
}
