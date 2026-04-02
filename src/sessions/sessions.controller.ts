import {
  Body,
  Controller,
  Get,
  Param,
  Post
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags
} from '@nestjs/swagger';

import { CreateSessionDto } from './dto/create-session.dto';
import { JoinSessionDto } from './dto/join-session.dto';
import { LeaveSessionDto } from './dto/leave-session.dto';
import { OwnerActionDto } from './dto/owner-action.dto';
import {
  LeaveSessionResponseDto,
  SessionParticipantResponseDto,
  SessionViewDto
} from './dto/session-view.dto';
import { VoteDto } from './dto/vote.dto';
import { SessionsGateway } from './sessions.gateway';
import { SessionsService } from './sessions.service';

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly sessionsGateway: SessionsGateway
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a poker planning session' })
  @ApiCreatedResponse({ type: SessionParticipantResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid participant name or deck.' })
  create(@Body() dto: CreateSessionDto): SessionParticipantResponseDto {
    const result = this.sessionsService.createSession(dto.name, dto.deck);
    this.sessionsGateway.emitSessionUpdated(result.session.code, result.session);
    return result;
  }

  @Post(':code/join')
  @ApiOperation({ summary: 'Join an existing session' })
  @ApiParam({ name: 'code', example: 'ABC123' })
  @ApiCreatedResponse({ type: SessionParticipantResponseDto })
  @ApiNotFoundResponse({ description: 'Session not found.' })
  join(
    @Param('code') code: string,
    @Body() dto: JoinSessionDto
  ): SessionParticipantResponseDto {
    const result = this.sessionsService.joinSession(code, dto.name);
    this.sessionsGateway.emitSessionUpdated(result.session.code, result.session);
    return result;
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get the current session state' })
  @ApiParam({ name: 'code', example: 'ABC123' })
  @ApiOkResponse({ type: SessionViewDto })
  @ApiNotFoundResponse({ description: 'Session not found.' })
  getOne(@Param('code') code: string): SessionViewDto {
    return this.sessionsService.getSession(code);
  }

  @Post(':code/vote')
  @ApiOperation({ summary: 'Submit or update a vote' })
  @ApiParam({ name: 'code', example: 'ABC123' })
  @ApiOkResponse({ type: SessionViewDto })
  vote(@Param('code') code: string, @Body() dto: VoteDto): SessionViewDto {
    const session = this.sessionsService.vote(code, dto.participantId, dto.card);
    this.sessionsGateway.emitSessionUpdated(session.code, session);
    return session;
  }

  @Post(':code/reveal')
  @ApiOperation({ summary: 'Reveal votes for the current round' })
  @ApiParam({ name: 'code', example: 'ABC123' })
  @ApiOkResponse({ type: SessionViewDto })
  reveal(@Param('code') code: string, @Body() dto: OwnerActionDto): SessionViewDto {
    const session = this.sessionsService.reveal(code, dto.participantId);
    this.sessionsGateway.emitSessionUpdated(session.code, session);
    return session;
  }

  @Post(':code/reset')
  @ApiOperation({ summary: 'Reset votes for a new round' })
  @ApiParam({ name: 'code', example: 'ABC123' })
  @ApiOkResponse({ type: SessionViewDto })
  reset(@Param('code') code: string, @Body() dto: OwnerActionDto): SessionViewDto {
    const session = this.sessionsService.reset(code, dto.participantId);
    this.sessionsGateway.emitSessionUpdated(session.code, session);
    return session;
  }

  @Post(':code/leave')
  @ApiOperation({ summary: 'Leave a session' })
  @ApiParam({ name: 'code', example: 'ABC123' })
  @ApiOkResponse({ type: LeaveSessionResponseDto })
  leave(@Param('code') code: string, @Body() dto: LeaveSessionDto): LeaveSessionResponseDto {
    const result = this.sessionsService.leave(code, dto.participantId);

    if (result.deleted) {
      this.sessionsGateway.emitSessionDeleted(code.toUpperCase());
    } else {
      const session = this.sessionsService.getSession(code);
      this.sessionsGateway.emitSessionUpdated(session.code, session);
    }

    return result;
  }
}
