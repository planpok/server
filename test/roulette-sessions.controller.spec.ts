import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { RouletteSessionsController } from '../src/roulette/roulette-sessions.controller';
import { RouletteSessionsService } from '../src/roulette/roulette-sessions.service';

describe('RouletteSessionsController', () => {
  let controller: RouletteSessionsController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RouletteSessionsController],
      providers: [RouletteSessionsService]
    }).compile();

    controller = moduleRef.get(RouletteSessionsController);
  });

  it('creates and reads a roulette session', () => {
    const created = controller.create({
      values: ['Alice', 'Bob']
    });
    const session = controller.getOne(created.session.code);

    expect(created.ownerToken).toMatch(/^roulette_owner_/);
    expect(session.values).toEqual(['Alice', 'Bob']);
  });

  it('adds, draws, keeps and removes values through controller endpoints', () => {
    const created = controller.create({
      values: ['Alice']
    });
    const added = controller.addValue(created.session.code, {
      ownerToken: created.ownerToken,
      value: 'Bob'
    });

    expect(added.values).toEqual(['Alice', 'Bob']);

    const drawn = controller.draw(created.session.code, {
      ownerToken: created.ownerToken
    });

    expect(drawn.lastDraw?.value).toBeDefined();

    const kept = controller.keepLastDraw(created.session.code, {
      ownerToken: created.ownerToken
    });

    expect(kept.lastDraw?.removable).toBe(false);

    const removed = controller.removeValue(created.session.code, drawn.lastDraw!.value, {
      ownerToken: created.ownerToken
    });

    expect(removed.values).not.toContain(drawn.lastDraw!.value);
  });

  it('removes the latest draw through controller endpoint', () => {
    const created = controller.create({
      values: ['Alice']
    });

    controller.draw(created.session.code, {
      ownerToken: created.ownerToken
    });

    const updated = controller.removeLastDraw(created.session.code, {
      ownerToken: created.ownerToken
    });

    expect(updated.values).toEqual([]);
    expect(updated.lastDraw?.removable).toBe(false);
  });

  it('throws expected domain errors', () => {
    expect(() => controller.getOne('UNKNOWN')).toThrow(NotFoundException);

    const created = controller.create({
      values: ['Alice']
    });

    expect(() =>
      controller.draw(created.session.code, {
        ownerToken: 'wrong-token'
      })
    ).toThrow(ForbiddenException);
  });
});
