import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Length, ValidateIf } from 'class-validator';

export class RevealActionDto {
  @ApiPropertyOptional({ example: 'participant_abc123' })
  @ValidateIf((dto: RevealActionDto) => !dto.moderatorToken)
  @IsString()
  @Length(1, 100)
  participantId?: string;

  @ApiPropertyOptional({ example: 'mod_8f95d3a64f2d4f8c' })
  @ValidateIf((dto: RevealActionDto) => !dto.participantId)
  @IsString()
  @Length(1, 200)
  moderatorToken?: string;
}
