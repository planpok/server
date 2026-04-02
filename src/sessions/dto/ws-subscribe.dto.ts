import { IsString, Length } from 'class-validator';

export class WsSubscribeDto {
  @IsString()
  @Length(4, 12)
  sessionCode!: string;
}
