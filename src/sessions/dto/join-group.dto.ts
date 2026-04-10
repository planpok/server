import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class JoinGroupDto {
  @ApiProperty({ example: 'participant_abc123' })
  @IsString()
  participantId!: string;

  @ApiProperty({ example: 'group_abc123' })
  @IsString()
  groupId!: string;
}
