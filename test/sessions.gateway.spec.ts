import { SessionsGateway } from '../src/sessions/sessions.gateway';

describe('SessionsGateway', () => {
  let gateway: SessionsGateway;
  let emit: jest.Mock;
  let to: jest.Mock;
  let join: jest.Mock;
  let client: { join: jest.Mock };

  beforeEach(() => {
    emit = jest.fn();
    to = jest.fn().mockReturnValue({ emit });
    join = jest.fn();

    gateway = new SessionsGateway();
    gateway.server = { to } as never;
    client = { join };
  });

  it('broadcasts session updates', () => {
    gateway.emitSessionUpdated('ABC123', {
      code: 'ABC123',
      revealed: false,
      deck: ['1', '2', '3'],
      createdAt: new Date().toISOString(),
      groups: [],
      participants: [],
      groupResults: []
    });

    expect(to).toHaveBeenCalledWith('ABC123');
    expect(emit).toHaveBeenCalledWith('session.updated', expect.objectContaining({ code: 'ABC123' }));
  });

  it('broadcasts session deletion', () => {
    gateway.emitSessionDeleted('ABC123');

    expect(to).toHaveBeenCalledWith('ABC123');
    expect(emit).toHaveBeenCalledWith('session.deleted', { code: 'ABC123' });
  });

  it('subscribes clients to uppercased session rooms', () => {
    const result = gateway.handleSubscribe(client as never, {
      sessionCode: 'abc123'
    });

    expect(join).toHaveBeenCalledWith('ABC123');
    expect(result).toEqual({
      event: 'session.subscribed',
      data: {
        sessionCode: 'ABC123'
      }
    });
  });
});
