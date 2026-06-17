import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags
} from '@nestjs/swagger';

import { AddRouletteValueDto } from './dto/add-roulette-value.dto';
import { CreateRouletteSessionDto } from './dto/create-roulette-session.dto';
import { RouletteOwnerActionDto } from './dto/roulette-owner-action.dto';
import {
  RouletteSessionOwnerResponseDto,
  RouletteSessionViewDto
} from './dto/roulette-session-view.dto';
import { RouletteSessionsService } from './roulette-sessions.service';

@ApiTags('roulette-sessions')
@Controller('roulette-sessions')
export class RouletteSessionsController {
  constructor(private readonly rouletteSessionsService: RouletteSessionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a roulette session' })
  @ApiCreatedResponse({ type: RouletteSessionOwnerResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid roulette values.' })
  create(@Body() dto: CreateRouletteSessionDto): RouletteSessionOwnerResponseDto {
    return this.rouletteSessionsService.createSession(dto.values ?? []);
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get the current roulette session state' })
  @ApiParam({ name: 'code', example: 'ABC123' })
  @ApiOkResponse({ type: RouletteSessionViewDto })
  @ApiNotFoundResponse({ description: 'Roulette session not found.' })
  getOne(@Param('code') code: string): RouletteSessionViewDto {
    return this.rouletteSessionsService.getSession(code);
  }

  @Post(':code/values')
  @ApiOperation({ summary: 'Add a value to a roulette session' })
  @ApiParam({ name: 'code', example: 'ABC123' })
  @ApiOkResponse({ type: RouletteSessionViewDto })
  @ApiForbiddenResponse({ description: 'Only the owner can update the roulette session.' })
  addValue(@Param('code') code: string, @Body() dto: AddRouletteValueDto): RouletteSessionViewDto {
    return this.rouletteSessionsService.addValue(code, dto.ownerToken, dto.value);
  }

  @Delete(':code/values/:value')
  @ApiOperation({ summary: 'Remove a value from a roulette session' })
  @ApiParam({ name: 'code', example: 'ABC123' })
  @ApiOkResponse({ type: RouletteSessionViewDto })
  @ApiForbiddenResponse({ description: 'Only the owner can update the roulette session.' })
  removeValue(
    @Param('code') code: string,
    @Param('value') value: string,
    @Body() dto: RouletteOwnerActionDto
  ): RouletteSessionViewDto {
    return this.rouletteSessionsService.removeValue(code, dto.ownerToken, value);
  }

  @Post(':code/draw')
  @ApiOperation({ summary: 'Draw a random value from a roulette session' })
  @ApiParam({ name: 'code', example: 'ABC123' })
  @ApiOkResponse({ type: RouletteSessionViewDto })
  @ApiBadRequestResponse({ description: 'The roulette session has no values.' })
  @ApiForbiddenResponse({ description: 'Only the owner can draw.' })
  draw(@Param('code') code: string, @Body() dto: RouletteOwnerActionDto): RouletteSessionViewDto {
    return this.rouletteSessionsService.draw(code, dto.ownerToken);
  }

  @Post(':code/draw/remove')
  @ApiOperation({ summary: 'Remove the latest drawn value from a roulette session' })
  @ApiParam({ name: 'code', example: 'ABC123' })
  @ApiOkResponse({ type: RouletteSessionViewDto })
  @ApiForbiddenResponse({ description: 'Only the owner can remove the latest draw.' })
  removeLastDraw(
    @Param('code') code: string,
    @Body() dto: RouletteOwnerActionDto
  ): RouletteSessionViewDto {
    return this.rouletteSessionsService.removeLastDraw(code, dto.ownerToken);
  }

  @Post(':code/draw/keep')
  @ApiOperation({ summary: 'Keep the latest drawn value in a roulette session' })
  @ApiParam({ name: 'code', example: 'ABC123' })
  @ApiOkResponse({ type: RouletteSessionViewDto })
  @ApiForbiddenResponse({ description: 'Only the owner can keep the latest draw.' })
  keepLastDraw(
    @Param('code') code: string,
    @Body() dto: RouletteOwnerActionDto
  ): RouletteSessionViewDto {
    return this.rouletteSessionsService.keepLastDraw(code, dto.ownerToken);
  }
}
