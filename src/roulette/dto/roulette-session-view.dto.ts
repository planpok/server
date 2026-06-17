import { ApiProperty } from '@nestjs/swagger';

export class RouletteLastDrawViewDto {
  @ApiProperty()
  value!: string;

  @ApiProperty()
  drawnAt!: string;

  @ApiProperty()
  removable!: boolean;
}

export class RouletteSessionViewDto {
  @ApiProperty()
  code!: string;

  @ApiProperty({ type: [String] })
  values!: string[];

  @ApiProperty({ nullable: true, required: false, type: RouletteLastDrawViewDto })
  lastDraw!: RouletteLastDrawViewDto | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class RouletteSessionOwnerResponseDto {
  @ApiProperty()
  ownerToken!: string;

  @ApiProperty({ type: RouletteSessionViewDto })
  session!: RouletteSessionViewDto;
}
