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

  @ApiProperty({ nullable: true, required: false })
  groupId!: string | null;

  @ApiProperty({ nullable: true, required: false })
  groupName!: string | null;
}

export class GroupViewDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class GroupResultViewDto {
  @ApiProperty({ nullable: true, required: false })
  groupId!: string | null;

  @ApiProperty()
  groupName!: string;

  @ApiProperty()
  participantCount!: number;

  @ApiProperty()
  votedCount!: number;

  @ApiProperty({ nullable: true, required: false })
  trendingCard!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'number'
    }
  })
  voteCounts!: Record<string, number>;
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

  @ApiProperty({ type: [GroupViewDto] })
  groups!: GroupViewDto[];

  @ApiProperty({ type: [ParticipantViewDto] })
  participants!: ParticipantViewDto[];

  @ApiProperty({ type: [GroupResultViewDto] })
  groupResults!: GroupResultViewDto[];
}

export class SessionParticipantResponseDto {
  @ApiProperty()
  participantId!: string;

  @ApiProperty({ required: false })
  moderatorToken?: string;

  @ApiProperty({ type: SessionViewDto })
  session!: SessionViewDto;
}

export class LeaveSessionResponseDto {
  @ApiProperty()
  deleted!: boolean;
}
