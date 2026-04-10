import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

import { SessionsService } from '../src/sessions/sessions.service';

describe('SessionsService', () => {
  let service: SessionsService;

  beforeEach(() => {
    service = new SessionsService();
  });

  afterEach(() => {
    service.onModuleDestroy();
    delete process.env.SESSIONS_DB_PATH;
  });

  it('creates a session with the creator as owner', () => {
    const result = service.createSession('Maxime', ['1', '2', '3']);

    expect(result.session.code).toHaveLength(6);
    expect(result.session.participants).toHaveLength(1);
    expect(result.session.participants[0].name).toBe('Maxime');
    expect(result.session.participants[0].isOwner).toBe(true);
    expect(result.moderatorToken).toMatch(/^mod_/);
  });

  it('trims names and removes duplicate cards from the deck', () => {
    const result = service.createSession('  Maxime  ', ['1', '2', '2', ' 3 ', '']);

    expect(result.session.participants[0].name).toBe('Maxime');
    expect(result.session.deck).toEqual(['1', '2', '3']);
  });

  it('creates unique groups and exposes grouped results', () => {
    const result = service.createSession('Alice', ['1', '2', '3'], ['Backend', '  Frontend ', 'Backend']);

    expect(result.session.groups).toHaveLength(2);
    expect(result.session.groups.map((group) => group.name)).toEqual(['Backend', 'Frontend']);
    expect(result.session.groupResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupName: 'Backend',
          participantCount: 0
        }),
        expect.objectContaining({
          groupName: 'Frontend',
          participantCount: 0
        }),
        expect.objectContaining({
          groupName: 'Ungrouped',
          participantCount: 1
        })
      ])
    );
  });

  it('auto-renames duplicate participant names', () => {
    const created = service.createSession('Alice', ['1', '2', '3']);
    const joined = service.joinSession(created.session.code, 'Alice');
    const secondJoin = service.joinSession(created.session.code, 'Alice');

    expect(joined.session.participants.map((participant) => participant.name)).toEqual([
      'Alice',
      'Alice (2)'
    ]);
    expect(secondJoin.session.participants.map((participant) => participant.name)).toEqual([
      'Alice',
      'Alice (2)',
      'Alice (3)'
    ]);
  });

  it('supports joining and switching groups', () => {
    const created = service.createSession('Alice', ['1', '2', '3'], ['Backend', 'Frontend']);
    const backendGroupId = created.session.groups.find((group) => group.name === 'Backend')?.id;
    const frontendGroupId = created.session.groups.find((group) => group.name === 'Frontend')?.id;

    expect(backendGroupId).toBeDefined();
    expect(frontendGroupId).toBeDefined();

    const joined = service.joinSession(created.session.code, 'Bob', backendGroupId);
    let bob = joined.session.participants.find((participant) => participant.id === joined.participantId);

    expect(bob?.groupName).toBe('Backend');

    const updatedSession = service.joinGroup(created.session.code, joined.participantId, frontendGroupId!);
    bob = updatedSession.participants.find((participant) => participant.id === joined.participantId);

    expect(bob?.groupName).toBe('Frontend');
  });

  it('trims submitted votes before storing them', () => {
    const created = service.createSession('Alice', ['1', '2', '3']);

    service.vote(created.session.code, created.participantId, ' 2 ');
    const revealed = service.reveal(created.session.code, created.participantId);

    expect(revealed.participants[0].hasVoted).toBe(true);
    expect(revealed.participants[0].vote).toBe('2');
    expect(service.toPublicSessionView(created.session.code).participants[0].vote).toBe('2');
  });

  it('rejects a vote outside the deck', () => {
    const created = service.createSession('Alice', ['1', '2', '3']);

    expect(() => service.vote(created.session.code, created.participantId, '8')).toThrow(
      'Card is not allowed in this session deck.'
    );
  });

  it('reveals votes in the public view after the round is opened', () => {
    const created = service.createSession('Alice', ['1', '2', '3']);

    service.vote(created.session.code, created.participantId, '2');
    service.reveal(created.session.code, created.participantId);

    expect(service.toPublicSessionView(created.session.code).participants[0].vote).toBe('2');
  });

  it('computes vote trends by group when round is revealed', () => {
    const created = service.createSession('Alice', ['1', '2', '3'], ['Backend']);
    const backendGroupId = created.session.groups[0].id;
    const joined = service.joinSession(created.session.code, 'Bob', backendGroupId);

    service.vote(created.session.code, created.participantId, '2');
    service.vote(created.session.code, joined.participantId, '2');

    const revealed = service.reveal(created.session.code, created.participantId);
    const backendGroup = revealed.groupResults.find((group) => group.groupId === backendGroupId);

    expect(backendGroup).toEqual(
      expect.objectContaining({
        participantCount: 1,
        votedCount: 1,
        voteCounts: { '2': 1 },
        trendingCard: '2'
      })
    );
  });

  it('only allows the owner to reveal', () => {
    const created = service.createSession('Alice', ['1', '2', '3']);
    const joined = service.joinSession(created.session.code, 'Bob');

    expect(() => service.reveal(created.session.code, joined.participantId)).toThrow(
      ForbiddenException
    );
  });

  it('allows reveal with a moderator token when caller is not owner', () => {
    const created = service.createSession('Alice', ['1', '2', '3']);
    service.joinSession(created.session.code, 'Bob');
    service.vote(created.session.code, created.participantId, '2');

    const revealed = service.reveal(created.session.code, undefined, created.moderatorToken);

    expect(revealed.revealed).toBe(true);
    expect(service.toPublicSessionView(created.session.code).participants[0].vote).toBe('2');
  });

  it('persists sessions across service instances when db path is configured', () => {
    const dbPath = join(process.cwd(), 'tmp', `sessions-${Date.now()}.sqlite`);
    process.env.SESSIONS_DB_PATH = dbPath;
    service.onModuleDestroy();
    service = new SessionsService();

    const created = service.createSession('Alice', ['1', '2', '3']);
    service.vote(created.session.code, created.participantId, '2');
    service.reveal(created.session.code, created.participantId);
    service.onModuleDestroy();

    const reloaded = new SessionsService();
    const session = reloaded.toPublicSessionView(created.session.code);

    expect(session.revealed).toBe(true);
    expect(session.participants[0].vote).toBe('2');

    reloaded.onModuleDestroy();
    rmSync(dbPath, { force: true });
  });

  it('only allows the owner to reset', () => {
    const created = service.createSession('Alice', ['1', '2', '3']);
    const joined = service.joinSession(created.session.code, 'Bob');

    expect(() => service.reset(created.session.code, joined.participantId)).toThrow(
      ForbiddenException
    );
  });

  it('removes non-owner participants without deleting the session', () => {
    const created = service.createSession('Alice', ['1', '2', '3']);
    const joined = service.joinSession(created.session.code, 'Bob');

    expect(service.leave(created.session.code, joined.participantId)).toEqual({
      deleted: false
    });
    expect(service.getSession(created.session.code).participants).toHaveLength(1);
  });

  it('deletes the session when the owner leaves', () => {
    const created = service.createSession('Alice', ['1', '2', '3']);
    const result = service.leave(created.session.code, created.participantId);

    expect(result).toEqual({ deleted: true });
    expect(() => service.getSession(created.session.code)).toThrow(NotFoundException);
  });
});
