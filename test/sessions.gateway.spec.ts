import { SessionsGateway } from '../src/sessions/sessions.gateway';

describe('SessionsGateway', () => {
  let gateway: SessionsGateway;
  let emit: jest.Mock;
  let to: jest.Mock;

  beforeEach(() => {
    emit = jest.fn();
    to = jest.fn().mockReturnValue({ emit });

    gateway = new SessionsGateway();
    gateway.server = { to } as never;
  });

  it('broadcasts session updates', () => {
    gateway.emitSessionUpdated('ABC123', {
      code: 'ABC123',
      revealed: false,
      deck: ['1', '2', '3'],
      createdAt: new Date().toISOString(),
      participants: []
    });

    expect(to).toHaveBeenCalledWith('ABC123');
    expect(emit).toHaveBeenCalledWith('session.updated', expect.objectContaining({ code: 'ABC123' }));
  });

  it('broadcasts session deletion', () => {
    gateway.emitSessionDeleted('ABC123');

    expect(to).toHaveBeenCalledWith('ABC123');
    expect(emit).toHaveBeenCalledWith('session.deleted', { code: 'ABC123' });
  });
});
