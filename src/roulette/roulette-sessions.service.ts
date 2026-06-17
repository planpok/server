import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleDestroy
} from '@nestjs/common';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { RouletteSession } from './entities/roulette-session.entity';
import {
  RouletteSessionOwnerResponseDto,
  RouletteSessionViewDto
} from './dto/roulette-session-view.dto';

@Injectable()
export class RouletteSessionsService implements OnModuleDestroy {
  private readonly logger = new Logger(RouletteSessionsService.name);
  private readonly db: DatabaseSync;
  private dbClosed = false;
  private readonly sessions = new Map<string, RouletteSession>();

  constructor() {
    this.db = this.openDatabase();
    this.initializeStore();
    this.loadPersistedSessions();
  }

  onModuleDestroy(): void {
    if (this.dbClosed) {
      return;
    }

    this.db.close();
    this.dbClosed = true;
  }

  createSession(values: string[] = []): RouletteSessionOwnerResponseDto {
    const now = new Date().toISOString();
    const ownerToken = this.generateId('roulette_owner');
    const session: RouletteSession = {
      code: this.generateSessionCode(),
      ownerTokenHash: this.hashOwnerToken(ownerToken),
      values: this.normalizeValues(values),
      lastDraw: null,
      createdAt: now,
      updatedAt: now
    };

    this.sessions.set(session.code, session);
    this.persistSession(session);

    return {
      ownerToken,
      session: this.toSessionView(session)
    };
  }

  getSession(code: string): RouletteSessionViewDto {
    return this.toSessionView(this.getSessionOrThrow(code));
  }

  addValue(code: string, ownerToken: string, value: string): RouletteSessionViewDto {
    const session = this.getSessionOrThrow(code);
    this.assertOwner(session, ownerToken);
    const normalizedValue = this.normalizeValue(value);

    if (session.values.includes(normalizedValue)) {
      throw new BadRequestException('Value already exists in this roulette session.');
    }

    session.values.push(normalizedValue);
    session.updatedAt = new Date().toISOString();
    this.persistSession(session);
    return this.toSessionView(session);
  }

  removeValue(code: string, ownerToken: string, value: string): RouletteSessionViewDto {
    const session = this.getSessionOrThrow(code);
    this.assertOwner(session, ownerToken);
    const normalizedValue = this.normalizeValue(value);

    if (!session.values.includes(normalizedValue)) {
      throw new NotFoundException('Value not found in this roulette session.');
    }

    session.values = session.values.filter((entry) => entry !== normalizedValue);

    if (session.lastDraw?.value === normalizedValue) {
      session.lastDraw = {
        ...session.lastDraw,
        removable: false
      };
    }

    session.updatedAt = new Date().toISOString();
    this.persistSession(session);
    return this.toSessionView(session);
  }

  draw(code: string, ownerToken: string): RouletteSessionViewDto {
    const session = this.getSessionOrThrow(code);
    this.assertOwner(session, ownerToken);

    if (session.values.length === 0) {
      throw new BadRequestException('Cannot draw from an empty roulette session.');
    }

    session.lastDraw = {
      value: session.values[randomInt(session.values.length)],
      drawnAt: new Date().toISOString(),
      removable: true
    };
    session.updatedAt = new Date().toISOString();
    this.persistSession(session);
    return this.toSessionView(session);
  }

  removeLastDraw(code: string, ownerToken: string): RouletteSessionViewDto {
    const session = this.getSessionOrThrow(code);
    this.assertOwner(session, ownerToken);

    if (!session.lastDraw) {
      throw new BadRequestException('No roulette draw is available to remove.');
    }

    if (!session.lastDraw.removable || !session.values.includes(session.lastDraw.value)) {
      throw new BadRequestException('Last roulette draw can no longer be removed.');
    }

    session.values = session.values.filter((entry) => entry !== session.lastDraw?.value);
    session.lastDraw = {
      ...session.lastDraw,
      removable: false
    };
    session.updatedAt = new Date().toISOString();
    this.persistSession(session);
    return this.toSessionView(session);
  }

  keepLastDraw(code: string, ownerToken: string): RouletteSessionViewDto {
    const session = this.getSessionOrThrow(code);
    this.assertOwner(session, ownerToken);

    if (!session.lastDraw) {
      throw new BadRequestException('No roulette draw is available to keep.');
    }

    session.lastDraw = {
      ...session.lastDraw,
      removable: false
    };
    session.updatedAt = new Date().toISOString();
    this.persistSession(session);
    return this.toSessionView(session);
  }

  private getSessionOrThrow(code: string): RouletteSession {
    const session = this.sessions.get(code.toUpperCase());

    if (!session) {
      throw new NotFoundException('Roulette session not found.');
    }

    return session;
  }

  private assertOwner(session: RouletteSession, ownerToken: string): void {
    if (this.hashOwnerToken(ownerToken.trim()) !== session.ownerTokenHash) {
      throw new ForbiddenException('Only the roulette owner can perform this action.');
    }
  }

  private normalizeValues(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => this.normalizeOptionalValue(value)).filter(Boolean)));
  }

  private normalizeOptionalValue(value: string): string {
    const normalized = value.trim().replace(/\s+/g, ' ');

    if (normalized.length > 100) {
      throw new BadRequestException('Roulette values must be 100 characters or fewer.');
    }

    return normalized;
  }

  private normalizeValue(value: string): string {
    const normalized = this.normalizeOptionalValue(value);

    if (!normalized) {
      throw new BadRequestException('Roulette value must not be empty.');
    }

    return normalized;
  }

  private toSessionView(session: RouletteSession): RouletteSessionViewDto {
    return {
      code: session.code,
      values: [...session.values],
      lastDraw: session.lastDraw ? { ...session.lastDraw } : null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    };
  }

  private generateSessionCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    while (true) {
      let candidate = '';
      const bytes = randomBytes(6);

      for (const byte of bytes) {
        candidate += alphabet[byte % alphabet.length];
      }

      if (!this.sessions.has(candidate)) {
        return candidate;
      }
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_${randomBytes(8).toString('hex')}`;
  }

  private hashOwnerToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private openDatabase(): DatabaseSync {
    if (process.env.SESSIONS_DB_PATH) {
      const absolute = resolve(process.env.SESSIONS_DB_PATH);
      mkdirSync(dirname(absolute), { recursive: true });
      return new DatabaseSync(absolute);
    }

    if (process.env.NODE_ENV === 'test') {
      return new DatabaseSync(':memory:');
    }

    const defaultPath = resolve(process.cwd(), 'data', 'sessions.sqlite');
    mkdirSync(dirname(defaultPath), { recursive: true });
    return new DatabaseSync(defaultPath);
  }

  private initializeStore(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS roulette_sessions (
        code TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  private loadPersistedSessions(): void {
    const rows = this.db
      .prepare('SELECT code, payload FROM roulette_sessions')
      .all() as Array<{ code: string; payload: string }>;

    for (const row of rows) {
      try {
        const session = JSON.parse(row.payload) as RouletteSession;
        const normalized = this.normalizePersistedSession(session, row.code);
        this.sessions.set(row.code.toUpperCase(), normalized);
      } catch (error) {
        this.logger.error(
          `Failed to load roulette session ${row.code} from persistent store.`,
          error
        );
      }
    }
  }

  private normalizePersistedSession(
    session: RouletteSession,
    fallbackCode: string
  ): RouletteSession {
    const now = new Date().toISOString();

    return {
      code: (session.code ?? fallbackCode).toUpperCase(),
      ownerTokenHash: session.ownerTokenHash ?? '',
      values: this.normalizeValues(session.values ?? []),
      lastDraw: session.lastDraw ?? null,
      createdAt: session.createdAt ?? now,
      updatedAt: session.updatedAt ?? session.createdAt ?? now
    };
  }

  private persistSession(session: RouletteSession): void {
    try {
      const statement = this.db.prepare(`
        INSERT INTO roulette_sessions (code, payload, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `);

      statement.run(session.code, JSON.stringify(session), new Date().toISOString());
    } catch (error) {
      this.logger.error(`Failed to persist roulette session ${session.code}.`, error);
      throw new InternalServerErrorException('Failed to persist roulette session data.');
    }
  }
}
