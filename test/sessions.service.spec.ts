import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { SessionsService } from '../src/sessions/sessions.service';

describe('SessionsService', () => {
  let service: SessionsService;

  beforeEach(() => {
    service = new SessionsService();
  });

  it('creates a session with the creator as owner', () => {
    const result = service.createSession('Maxime', ['1', '2', '3']);

    expect(result.session.code).toHaveLength(6);
    expect(result.session.participants).toHaveLength(1);
    expect(result.session.participants[0].name).toBe('Maxime');
    expect(result.session.participants[0].isOwner).toBe(true);
  });

  it('trims names and removes duplicate cards from the deck', () => {
    const result = service.createSession('  Maxime  ', ['1', '2', '2', ' 3 ', '']);

    expect(result.session.participants[0].name).toBe('Maxime');
    expect(result.session.deck).toEqual(['1', '2', '3']);
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

  it('only allows the owner to reveal', () => {
    const created = service.createSession('Alice', ['1', '2', '3']);
    const joined = service.joinSession(created.session.code, 'Bob');

    expect(() => service.reveal(created.session.code, joined.participantId)).toThrow(
      ForbiddenException
    );
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
