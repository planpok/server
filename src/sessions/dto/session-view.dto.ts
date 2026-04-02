import { ApiProperty } from '@nestjs/swagger';

export class ParticipantViewDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  isOwner!: boolean;

  @ApiProperty()
  hasVoted!: boolean;

  @ApiProperty({ nullable: true, required: false })
  vote!: string | null;
}

export class SessionViewDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  revealed!: boolean;

  @ApiProperty({ type: [String] })
  deck!: string[];

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ type: [ParticipantViewDto] })
  participants!: ParticipantViewDto[];
}

export class SessionParticipantResponseDto {
  @ApiProperty()
  participantId!: string;

  @ApiProperty({ type: SessionViewDto })
  session!: SessionViewDto;
}

export class LeaveSessionResponseDto {
  @ApiProperty()
  deleted!: boolean;
}
