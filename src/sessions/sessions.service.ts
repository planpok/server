import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Injectable,
  Logger,
  OnModuleDestroy,
  NotFoundException
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { Session, Participant, SessionGroup } from './entities/session.entity';
import {
  SessionParticipantResponseDto,
  SessionViewDto,
  ParticipantViewDto,
  LeaveSessionResponseDto,
  GroupResultViewDto
} from './dto/session-view.dto';

@Injectable()
export class SessionsService implements OnModuleDestroy {
  private readonly logger = new Logger(SessionsService.name);
  private readonly db: DatabaseSync;
  private dbClosed = false;
  private readonly sessions = new Map<string, Session>();

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

  createSession(name: string, deck: string[], groups: string[] = []): SessionParticipantResponseDto {
    const normalizedName = this.normalizeName(name);
    const normalizedDeck = this.normalizeDeck(deck);
    const normalizedGroups = this.normalizeGroups(groups);
    const participantId = this.generateId('participant');
    const code = this.generateSessionCode();
    const createdAt = new Date().toISOString();
    const moderatorToken = this.generateId('mod');

    const owner: Participant = {
      id: participantId,
      name: normalizedName,
      vote: null,
      joinedAt: createdAt,
      groupId: null
    };

    const sessionGroups: SessionGroup[] = normalizedGroups.map((groupName) => ({
      id: this.generateId('group'),
      name: groupName,
      createdAt
    }));

    const session: Session = {
      code,
      ownerParticipantId: participantId,
      moderatorTokenHash: this.hashModeratorToken(moderatorToken),
      deck: normalizedDeck,
      revealed: false,
      createdAt,
      groups: sessionGroups,
      participants: [owner]
    };

    this.sessions.set(code, session);
    this.persistSession(session);

    return {
      participantId,
      moderatorToken,
      session: this.toSessionView(session, false)
    };
  }

  joinSession(code: string, name: string, groupId?: string): SessionParticipantResponseDto {
    const session = this.getSessionOrThrow(code);
    const normalizedName = this.normalizeName(name);
    const normalizedGroupId = groupId?.trim();

    if (normalizedGroupId) {
      this.getGroupOrThrow(session, normalizedGroupId);
    }

    const participantId = this.generateId('participant');
    const participant: Participant = {
      id: participantId,
      name: this.resolveParticipantName(normalizedName, session.participants),
      vote: null,
      joinedAt: new Date().toISOString(),
      groupId: normalizedGroupId ?? null
    };

    session.participants.push(participant);
    this.persistSession(session);

    return {
      participantId,
      session: this.toSessionView(session, false)
    };
  }

  joinGroup(code: string, participantId: string, groupId: string): SessionViewDto {
    const session = this.getSessionOrThrow(code);
    const participant = this.getParticipantOrThrow(session, participantId);
    const group = this.getGroupOrThrow(session, groupId.trim());
    participant.groupId = group.id;
    this.persistSession(session);
    return this.toSessionView(session, false);
  }

  getSession(code: string): SessionViewDto {
    const session = this.getSessionOrThrow(code);
    return this.toSessionView(session, false);
  }

  vote(code: string, participantId: string, card: string): SessionViewDto {
    const session = this.getSessionOrThrow(code);
    const participant = this.getParticipantOrThrow(session, participantId);
    const normalizedCard = card.trim();

    if (!session.deck.includes(normalizedCard)) {
      throw new BadRequestException('Card is not allowed in this session deck.');
    }

    participant.vote = normalizedCard;
    this.persistSession(session);
    return this.toSessionView(session, false);
  }

  reveal(code: string, participantId?: string, moderatorToken?: string): SessionViewDto {
    const session = this.getSessionOrThrow(code);

    if (this.isModeratorTokenValid(session, moderatorToken)) {
      session.revealed = true;
      this.persistSession(session);
      return this.toSessionView(session, true);
    }

    if (!participantId) {
      throw new ForbiddenException(
        'Reveal requires the session owner participantId or a valid moderatorToken.'
      );
    }

    this.assertOwner(session, participantId);
    session.revealed = true;
    this.persistSession(session);
    return this.toSessionView(session, true);
  }

  reset(code: string, participantId: string): SessionViewDto {
    const session = this.getSessionOrThrow(code);
    this.assertOwner(session, participantId);
    session.revealed = false;

    for (const participant of session.participants) {
      participant.vote = null;
    }

    this.persistSession(session);
    return this.toSessionView(session, false);
  }

  leave(code: string, participantId: string): LeaveSessionResponseDto {
    const session = this.getSessionOrThrow(code);
    this.getParticipantOrThrow(session, participantId);

    if (session.ownerParticipantId === participantId) {
      this.sessions.delete(session.code);
      this.deletePersistedSession(session.code);
      return { deleted: true };
    }

    session.participants = session.participants.filter(
      (participant) => participant.id !== participantId
    );
    this.persistSession(session);

    return { deleted: false };
  }

  hasSession(code: string): boolean {
    return this.sessions.has(code.toUpperCase());
  }

  toPublicSessionView(code: string): SessionViewDto {
    const session = this.getSessionOrThrow(code);
    return this.toSessionView(session, session.revealed);
  }

  private getSessionOrThrow(code: string): Session {
    const session = this.sessions.get(code.toUpperCase());

    if (!session) {
      throw new NotFoundException('Session not found.');
    }

    return session;
  }

  private getParticipantOrThrow(session: Session, participantId: string): Participant {
    const participant = session.participants.find((entry) => entry.id === participantId);

    if (!participant) {
      throw new NotFoundException('Participant not found in this session.');
    }

    return participant;
  }

  private getGroupOrThrow(session: Session, groupId: string): SessionGroup {
    const group = session.groups.find((entry) => entry.id === groupId);

    if (!group) {
      throw new NotFoundException('Group not found in this session.');
    }

    return group;
  }

  private assertOwner(session: Session, participantId: string): void {
    this.getParticipantOrThrow(session, participantId);

    if (session.ownerParticipantId !== participantId) {
      throw new ForbiddenException('Only the session owner can perform this action.');
    }
  }

  private normalizeName(name: string): string {
    const normalized = name.trim();

    if (!normalized) {
      throw new BadRequestException('Name must not be empty.');
    }

    return normalized;
  }

  private normalizeDeck(deck: string[]): string[] {
    const normalized = deck.map((card) => card.trim()).filter((card) => card.length > 0);
    const unique = Array.from(new Set(normalized));

    if (unique.length === 0) {
      throw new BadRequestException('Deck must contain at least one unique card.');
    }

    return unique;
  }

  private normalizeGroups(groups: string[]): string[] {
    const normalized = groups.map((group) => group.trim()).filter((group) => group.length > 0);
    return Array.from(new Set(normalized));
  }

  private isModeratorTokenValid(session: Session, token?: string): boolean {
    if (!token) {
      return false;
    }

    return this.hashModeratorToken(token.trim()) === session.moderatorTokenHash;
  }

  private resolveParticipantName(baseName: string, participants: Participant[]): string {
    const existingNames = new Set(participants.map((participant) => participant.name));

    if (!existingNames.has(baseName)) {
      return baseName;
    }

    let suffix = 2;
    while (existingNames.has(`${baseName} (${suffix})`)) {
      suffix += 1;
    }

    return `${baseName} (${suffix})`;
  }

  private toSessionView(session: Session, revealVotes: boolean): SessionViewDto {
    const groupNameById = new Map(session.groups.map((group) => [group.id, group.name]));

    return {
      code: session.code,
      revealed: session.revealed,
      deck: [...session.deck],
      createdAt: session.createdAt,
      groups: session.groups.map((group) => ({
        id: group.id,
        name: group.name
      })),
      participants: session.participants.map((participant): ParticipantViewDto => ({
        id: participant.id,
        name: participant.name,
        isOwner: participant.id === session.ownerParticipantId,
        hasVoted: participant.vote !== null,
        vote: revealVotes ? participant.vote : null,
        groupId: participant.groupId,
        groupName: participant.groupId ? (groupNameById.get(participant.groupId) ?? null) : null
      })),
      groupResults: this.buildGroupResults(session, revealVotes)
    };
  }

  private buildGroupResults(session: Session, revealVotes: boolean): GroupResultViewDto[] {
    const groupedParticipants = new Map<string, Participant[]>();

    for (const group of session.groups) {
      groupedParticipants.set(group.id, []);
    }

    for (const participant of session.participants) {
      const key = participant.groupId ?? '__ungrouped__';
      const existing = groupedParticipants.get(key) ?? [];
      existing.push(participant);
      groupedParticipants.set(key, existing);
    }

    const declaredGroups = session.groups.map((group) =>
      this.toGroupResult(group.id, group.name, groupedParticipants.get(group.id) ?? [], revealVotes)
    );

    const ungroupedParticipants = groupedParticipants.get('__ungrouped__') ?? [];
    if (ungroupedParticipants.length > 0) {
      declaredGroups.push(
        this.toGroupResult(null, 'Ungrouped', ungroupedParticipants, revealVotes)
      );
    }

    return declaredGroups;
  }

  private toGroupResult(
    groupId: string | null,
    groupName: string,
    participants: Participant[],
    revealVotes: boolean
  ): GroupResultViewDto {
    const voteCounts: Record<string, number> = {};
    let votedCount = 0;

    for (const participant of participants) {
      if (participant.vote === null) {
        continue;
      }

      votedCount += 1;

      if (revealVotes) {
        voteCounts[participant.vote] = (voteCounts[participant.vote] ?? 0) + 1;
      }
    }

    return {
      groupId,
      groupName,
      participantCount: participants.length,
      votedCount,
      voteCounts,
      trendingCard: revealVotes ? this.resolveTrendingCard(voteCounts) : null
    };
  }

  private resolveTrendingCard(voteCounts: Record<string, number>): string | null {
    const sorted = Object.entries(voteCounts).sort((a, b) => {
      if (a[1] === b[1]) {
        return a[0].localeCompare(b[0]);
      }

      return b[1] - a[1];
    });

    return sorted.length > 0 ? sorted[0][0] : null;
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

  private hashModeratorToken(token: string): string {
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
      CREATE TABLE IF NOT EXISTS sessions (
        code TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  private loadPersistedSessions(): void {
    const rows = this.db
      .prepare('SELECT code, payload FROM sessions')
      .all() as Array<{ code: string; payload: string }>;

    for (const row of rows) {
      try {
        const session = JSON.parse(row.payload) as Session;
        const normalized = this.normalizePersistedSession(session, row.code);
        this.sessions.set(row.code.toUpperCase(), normalized);
      } catch (error) {
        this.logger.error(`Failed to load session ${row.code} from persistent store.`, error);
      }
    }
  }

  private normalizePersistedSession(session: Session, fallbackCode: string): Session {
    return {
      ...session,
      code: (session.code ?? fallbackCode).toUpperCase(),
      moderatorTokenHash: session.moderatorTokenHash ?? '',
      groups: session.groups ?? [],
      participants: (session.participants ?? []).map((participant) => ({
        ...participant,
        groupId: participant.groupId ?? null
      }))
    };
  }

  private persistSession(session: Session): void {
    try {
      const statement = this.db.prepare(`
        INSERT INTO sessions (code, payload, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `);

      statement.run(session.code, JSON.stringify(session), new Date().toISOString());
    } catch (error) {
      this.logger.error(`Failed to persist session ${session.code}.`, error);
      throw new InternalServerErrorException('Failed to persist session data.');
    }
  }

  private deletePersistedSession(code: string): void {
    try {
      this.db.prepare('DELETE FROM sessions WHERE code = ?').run(code.toUpperCase());
    } catch (error) {
      this.logger.error(`Failed to delete session ${code} from persistent store.`, error);
      throw new InternalServerErrorException('Failed to persist session deletion.');
    }
  }
}
