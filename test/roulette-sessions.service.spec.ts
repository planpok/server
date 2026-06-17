import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

import { RouletteSessionsService } from '../src/roulette/roulette-sessions.service';

describe('RouletteSessionsService', () => {
  let service: RouletteSessionsService;

  beforeEach(() => {
    service = new RouletteSessionsService();
  });

  afterEach(() => {
    service.onModuleDestroy();
    delete process.env.SESSIONS_DB_PATH;
  });

  it('creates an empty roulette session with an owner token', () => {
    const result = service.createSession();

    expect(result.session.code).toHaveLength(6);
    expect(result.session.values).toEqual([]);
    expect(result.session.lastDraw).toBeNull();
    expect(result.ownerToken).toMatch(/^roulette_owner_/);
  });

  it('normalizes and deduplicates initial values', () => {
    const result = service.createSession([' iOS ', 'Android', 'iOS', '', 'Backend  API']);

    expect(result.session.values).toEqual(['iOS', 'Android', 'Backend API']);
  });

  it('persists roulette sessions across service instances when db path is configured', () => {
    const dbPath = join(process.cwd(), 'tmp', `roulette-sessions-${Date.now()}.sqlite`);
    process.env.SESSIONS_DB_PATH = dbPath;
    service.onModuleDestroy();
    service = new RouletteSessionsService();

    const created = service.createSession(['Alice']);
    service.draw(created.session.code, created.ownerToken);
    service.onModuleDestroy();

    const reloaded = new RouletteSessionsService();
    const session = reloaded.getSession(created.session.code);

    expect(session.values).toEqual(['Alice']);
    expect(session.lastDraw?.value).toBe('Alice');

    reloaded.onModuleDestroy();
    rmSync(dbPath, { force: true });
  });

  it('only allows the owner to mutate the session', () => {
    const created = service.createSession(['Alice']);

    expect(() => service.addValue(created.session.code, 'wrong-token', 'Bob')).toThrow(
      ForbiddenException
    );
    expect(() => service.draw(created.session.code, 'wrong-token')).toThrow(ForbiddenException);
    expect(() => service.removeValue(created.session.code, 'wrong-token', 'Alice')).toThrow(
      ForbiddenException
    );
  });

  it('adds and removes unique values', () => {
    const created = service.createSession();
    const updated = service.addValue(created.session.code, created.ownerToken, ' Alice ');

    expect(updated.values).toEqual(['Alice']);
    expect(() => service.addValue(created.session.code, created.ownerToken, 'Alice')).toThrow(
      BadRequestException
    );

    const removed = service.removeValue(created.session.code, created.ownerToken, 'Alice');
    expect(removed.values).toEqual([]);
    expect(() => service.removeValue(created.session.code, created.ownerToken, 'Alice')).toThrow(
      NotFoundException
    );
  });

  it('draws a value without removing it', () => {
    const created = service.createSession(['Alice']);
    const drawn = service.draw(created.session.code, created.ownerToken);

    expect(drawn.lastDraw).toEqual(
      expect.objectContaining({
        value: 'Alice',
        removable: true
      })
    );
    expect(drawn.values).toEqual(['Alice']);
  });

  it('rejects drawing from an empty roulette session', () => {
    const created = service.createSession();

    expect(() => service.draw(created.session.code, created.ownerToken)).toThrow(
      'Cannot draw from an empty roulette session.'
    );
  });

  it('removes the latest draw only once', () => {
    const created = service.createSession(['Alice']);
    service.draw(created.session.code, created.ownerToken);

    const updated = service.removeLastDraw(created.session.code, created.ownerToken);

    expect(updated.values).toEqual([]);
    expect(updated.lastDraw).toEqual(
      expect.objectContaining({
        value: 'Alice',
        removable: false
      })
    );
    expect(() => service.removeLastDraw(created.session.code, created.ownerToken)).toThrow(
      'Last roulette draw can no longer be removed.'
    );
  });

  it('keeps the latest draw and disables removal', () => {
    const created = service.createSession(['Alice']);
    service.draw(created.session.code, created.ownerToken);

    const updated = service.keepLastDraw(created.session.code, created.ownerToken);

    expect(updated.values).toEqual(['Alice']);
    expect(updated.lastDraw?.removable).toBe(false);
    expect(() => service.removeLastDraw(created.session.code, created.ownerToken)).toThrow(
      'Last roulette draw can no longer be removed.'
    );
  });
});
