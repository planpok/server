import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { SessionsGateway } from '../src/sessions/sessions.gateway';

async function dispatchJson(
  app: INestApplication,
  method: 'GET' | 'POST',
  path: string,
  body?: object
): Promise<request.Response> {
  const client = request(app.getHttpServer());
  const response = method === 'GET' ? client.get(path) : client.post(path);

  return body === undefined ? response : response.send(body);
}

describe('Sessions API (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(SessionsGateway)
      .useValue({
        emitSessionUpdated: jest.fn(),
        emitSessionDeleted: jest.fn()
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true
      })
    );

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('walks through the full session lifecycle over HTTP', async () => {
    const createdResponse = await dispatchJson(app, 'POST', '/api/sessions', {
      name: 'Alice',
      deck: ['1', '2', '3'],
      groups: ['Backend']
    });

    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.body as {
      participantId: string;
      session: { code: string; groups: Array<{ id: string; name: string }> };
    };

    const backendGroupId = created.session.groups[0].id;

    const joinedResponse = await dispatchJson(app, 'POST', `/api/sessions/${created.session.code}/join`, {
      name: 'Bob'
    });

    expect(joinedResponse.statusCode).toBe(201);
    const joined = joinedResponse.body as {
      participantId: string;
    };

    const voteResponse = await dispatchJson(app, 'POST', `/api/sessions/${created.session.code}/vote`, {
      participantId: created.participantId,
      card: ' 2 '
    });

    expect(voteResponse.statusCode).toBe(201);

    const joinGroupResponse = await dispatchJson(
      app,
      'POST',
      `/api/sessions/${created.session.code}/groups/join`,
      {
        participantId: joined.participantId,
        groupId: backendGroupId
      }
    );

    expect(joinGroupResponse.statusCode).toBe(201);

    const maskedView = await dispatchJson(app, 'GET', `/api/sessions/${created.session.code}`);

    expect(maskedView.statusCode).toBe(200);
    expect((maskedView.body as { revealed: boolean }).revealed).toBe(false);
    expect(
      (maskedView.body as { participants: Array<{ id: string; hasVoted: boolean; vote: string | null }> })
        .participants
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.participantId,
          hasVoted: true,
          vote: null
        })
      ])
    );

    const revealedResponse = await dispatchJson(app, 'POST', `/api/sessions/${created.session.code}/reveal`, {
      participantId: created.participantId
    });

    expect(revealedResponse.statusCode).toBe(201);
    expect((revealedResponse.body as { revealed: boolean }).revealed).toBe(true);
    expect(
      (revealedResponse.body as { participants: Array<{ id: string; hasVoted: boolean; vote: string | null }> })
        .participants
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.participantId,
          hasVoted: true,
          vote: '2'
        })
      ])
    );
    expect(
      (
        revealedResponse.body as {
          groupResults: Array<{
            groupName: string;
            participantCount: number;
            votedCount: number;
            trendingCard: string | null;
            voteCounts: Record<string, number>;
          }>;
        }
      ).groupResults
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupName: 'Backend',
          participantCount: 1,
          votedCount: 0,
          voteCounts: {},
          trendingCard: null
        }),
        expect.objectContaining({
          groupName: 'Ungrouped',
          participantCount: 1,
          votedCount: 1,
          voteCounts: { '2': 1 },
          trendingCard: '2'
        })
      ])
    );

    const resetResponse = await dispatchJson(app, 'POST', `/api/sessions/${created.session.code}/reset`, {
      participantId: created.participantId
    });

    expect(resetResponse.statusCode).toBe(201);
    expect((resetResponse.body as { revealed: boolean }).revealed).toBe(false);
    expect(
      (resetResponse.body as { participants: Array<{ id: string; hasVoted: boolean; vote: string | null }> })
        .participants
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.participantId,
          hasVoted: false,
          vote: null
        })
      ])
    );

    const leaveResponse = await dispatchJson(app, 'POST', `/api/sessions/${created.session.code}/leave`, {
      participantId: joined.participantId
    });

    expect(leaveResponse.statusCode).toBe(201);
    expect(leaveResponse.body).toEqual({ deleted: false });

    const ownerLeaveResponse = await dispatchJson(app, 'POST', `/api/sessions/${created.session.code}/leave`, {
      participantId: created.participantId
    });

    expect(ownerLeaveResponse.statusCode).toBe(201);
    expect(ownerLeaveResponse.body).toEqual({ deleted: true });

    const missingSession = await dispatchJson(app, 'GET', `/api/sessions/${created.session.code}`);

    expect(missingSession.statusCode).toBe(404);
  });

  it('returns validation errors for invalid payloads', async () => {
    const response = await dispatchJson(app, 'POST', '/api/sessions', {
      name: '',
      deck: []
    });

    expect(response.statusCode).toBe(400);
    expect((response.body as { message: string[] }).message).toEqual(
      expect.arrayContaining([
        'name must be longer than or equal to 1 characters',
        'deck must contain at least 1 elements'
      ])
    );
  });

  it('accepts ownerGroupName when creating a grouped session', async () => {
    const response = await dispatchJson(app, 'POST', '/api/sessions', {
      name: 'Maxime',
      deck: ['1', '2', '3', '5', '8', '13', '21', '?'],
      groups: ['iOS', 'Android'],
      ownerGroupName: 'iOS'
    });

    expect(response.statusCode).toBe(201);
    expect(
      (
        response.body as {
          participantId: string;
          session: {
            participants: Array<{ id: string; groupName: string | null }>;
            groupResults: Array<{ groupName: string; participantCount: number }>;
          };
        }
      ).session.participants
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupName: 'iOS'
        })
      ])
    );
    expect(
      (
        response.body as {
          session: { groupResults: Array<{ groupName: string; participantCount: number }> };
        }
      ).session.groupResults
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupName: 'iOS',
          participantCount: 1
        }),
        expect.objectContaining({
          groupName: 'Android',
          participantCount: 0
        })
      ])
    );
  });
});
