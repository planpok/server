import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VoteDto {
  @ApiProperty({ example: 'participant_abc123' })
  @IsString()
  @Length(1, 100)
  participantId!: string;

  @ApiProperty({ example: '5' })
  @IsString()
  @Length(1, 20)
  card!: string;
}
