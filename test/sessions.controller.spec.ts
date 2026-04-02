import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { SessionsController } from '../src/sessions/sessions.controller';
import { SessionsGateway } from '../src/sessions/sessions.gateway';
import { SessionsService } from '../src/sessions/sessions.service';

describe('SessionsController', () => {
  let controller: SessionsController;
  let gateway: SessionsGateway;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [SessionsService, SessionsGateway]
    }).compile();

    controller = moduleRef.get(SessionsController);
    gateway = moduleRef.get(SessionsGateway);
  });

  it('creates a session then joins it', () => {
    const emitUpdatedSpy = jest.spyOn(gateway, 'emitSessionUpdated').mockImplementation();

    const created = controller.create({
      name: 'Alice',
      deck: ['1', '2', '3']
    });
    const joined = controller.join(created.session.code, {
      name: 'Bob'
    });

    expect(created.session.participants).toHaveLength(1);
    expect(joined.session.participants).toHaveLength(2);
    expect(joined.session.participants[1].name).toBe('Bob');
    expect(emitUpdatedSpy).toHaveBeenCalledTimes(2);
  });

  it('reads session state with masked votes', () => {
    jest.spyOn(gateway, 'emitSessionUpdated').mockImplementation();

    const created = controller.create({
      name: 'Alice',
      deck: ['1', '2', '3']
    });

    controller.vote(created.session.code, {
      participantId: created.participantId,
      card: '2'
    });

    const session = controller.getOne(created.session.code);

    expect(session.participants[0].hasVoted).toBe(true);
    expect(session.participants[0].vote).toBeNull();
  });

  it('throws expected domain errors', () => {
    jest.spyOn(gateway, 'emitSessionUpdated').mockImplementation();

    expect(() => controller.getOne('UNKNOWN')).toThrow(NotFoundException);

    const created = controller.create({
      name: 'Alice',
      deck: ['1', '2', '3']
    });
    const joined = controller.join(created.session.code, {
      name: 'Bob'
    });

    expect(() =>
      controller.reveal(created.session.code, {
        participantId: joined.participantId
      })
    ).toThrow(ForbiddenException);

    expect(() =>
      controller.vote(created.session.code, {
        participantId: created.participantId,
        card: '8'
      })
    ).toThrow('Card is not allowed in this session deck.');
  });
});
