import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { once } from 'node:events';
import { PassThrough, Readable, Writable } from 'node:stream';

import { AppModule } from '../src/app.module';
import { SessionsGateway } from '../src/sessions/sessions.gateway';

type MockResult = {
  statusCode: number;
  body: unknown;
  headers: Record<string, unknown>;
};

class MockRequest extends Readable {
  public readonly method: string;
  public readonly url: string;
  public readonly originalUrl: string;
  public readonly headers: Record<string, string>;
  public readonly socket: PassThrough & { remoteAddress?: string };
  public readonly connection: PassThrough & { remoteAddress?: string };
  public readonly httpVersionMajor = 1;

  constructor(method: string, path: string, body?: unknown) {
    super();
    this.method = method;
    this.url = path;
    this.originalUrl = path;
    this.headers = {
      accept: 'application/json'
    };
    this.socket = Object.assign(new PassThrough(), { remoteAddress: '127.0.0.1' });
    this.connection = this.socket;

    if (body === undefined) {
      process.nextTick(() => {
        this.push(null);
      });
      return;
    }

    const serializedBody = Buffer.from(JSON.stringify(body));
    this.headers['content-type'] = 'application/json';
    this.headers['content-length'] = String(serializedBody.length);

    process.nextTick(() => {
      this.push(serializedBody);
      this.push(null);
    });
  }

  override _read(): void {
    return;
  }

  public get(name: string): string | undefined {
    return this.headers[name.toLowerCase()];
  }
}

class MockResponse extends Writable {
  public statusCode = 200;
  public statusMessage = 'OK';
  public headersSent = false;
  public readonly socket: PassThrough;
  private readonly headers: Record<string, unknown> = {};
  private readonly chunks: Buffer[] = [];

  constructor() {
    super();
    this.socket = new PassThrough();
    this.setHeader = this.setHeader.bind(this);
    this.getHeader = this.getHeader.bind(this);
    this.getHeaders = this.getHeaders.bind(this);
    this.removeHeader = this.removeHeader.bind(this);
    this.set = this.set.bind(this);
    this.append = this.append.bind(this);
    this.status = this.status.bind(this);
    this.writeHead = this.writeHead.bind(this);
    this.json = this.json.bind(this);
    this.send = this.send.bind(this);
    this.end = this.end.bind(this);
    this.toResult = this.toResult.bind(this);
  }

  override _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    callback();
  }

  public setHeader(name: string, value: unknown): this {
    this.headers[name.toLowerCase()] = value;
    return this;
  }

  public getHeader(name: string): unknown {
    return this.headers[name.toLowerCase()];
  }

  public getHeaders(): Record<string, unknown> {
    return { ...this.headers };
  }

  public removeHeader(name: string): this {
    delete this.headers[name.toLowerCase()];
    return this;
  }

  public set(name: string, value: unknown): this {
    return this.setHeader(name, value);
  }

  public append(name: string, value: unknown): this {
    const current = this.getHeader(name);
    this.setHeader(name, current === undefined ? value : [current, value]);
    return this;
  }

  public status(code: number): this {
    this.statusCode = code;
    return this;
  }

  public writeHead(
    statusCode: number,
    reasonOrHeaders?: string | Record<string, unknown>,
    headers?: Record<string, unknown>
  ): this {
    this.statusCode = statusCode;
    this.headersSent = true;

    if (typeof reasonOrHeaders === 'string') {
      this.statusMessage = reasonOrHeaders;
    } else if (reasonOrHeaders) {
      Object.entries(reasonOrHeaders).forEach(([name, value]) => {
        this.setHeader(name, value);
      });
    }

    if (headers) {
      Object.entries(headers).forEach(([name, value]) => {
        this.setHeader(name, value);
      });
    }

    return this;
  }

  public json(payload: unknown): this {
    if (!this.getHeader('content-type')) {
      this.setHeader('content-type', 'application/json; charset=utf-8');
    }

    return this.end(payload);
  }

  public send(payload?: unknown): this {
    return this.end(payload);
  }

  public end(chunk?: any, encoding?: any, callback?: any): this {
    if (chunk !== undefined && chunk !== null) {
      if (typeof chunk === 'object' && !Buffer.isBuffer(chunk)) {
        if (!this.getHeader('content-type')) {
          this.setHeader('content-type', 'application/json; charset=utf-8');
        }

        const serialized = Buffer.from(JSON.stringify(chunk));
        this.chunks.push(serialized);
      } else if (typeof chunk === 'string') {
        this.chunks.push(Buffer.from(chunk, encoding));
      } else if (Buffer.isBuffer(chunk)) {
        this.chunks.push(chunk);
      }
    }

    this.headersSent = true;
    super.end(callback);
    return this;
  }

  public toResult(): MockResult {
    const rawBody = Buffer.concat(this.chunks).toString('utf8');
    const contentType = String(this.getHeader('content-type') ?? '');

    return {
      statusCode: this.statusCode,
      headers: this.getHeaders(),
      body:
        contentType.includes('application/json') && rawBody.length > 0
          ? (JSON.parse(rawBody) as unknown)
          : rawBody
    };
  }
}

async function dispatchJson(
  app: { getHttpAdapter: () => { getInstance: () => { handle: (req: MockRequest, res: MockResponse) => void } } },
  method: string,
  path: string,
  body?: unknown
): Promise<MockResult> {
  const req = new MockRequest(method, path, body);
  const res = new MockResponse();

  Object.assign(req, { res });
  Object.assign(res, { req });

  app.getHttpAdapter().getInstance().handle(req, res);
  await once(res, 'finish');

  return res.toResult();
}

describe('Sessions API (e2e)', () => {
  let app: any;

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
      deck: ['1', '2', '3']
    });

    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.body as {
      participantId: string;
      session: { code: string };
    };

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
});
