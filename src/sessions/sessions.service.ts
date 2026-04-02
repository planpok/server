import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import { Session, Participant } from './entities/session.entity';
import {
  SessionParticipantResponseDto,
  SessionViewDto,
  ParticipantViewDto,
  LeaveSessionResponseDto
} from './dto/session-view.dto';

@Injectable()
export class SessionsService {
  private readonly sessions = new Map<string, Session>();

  createSession(name: string, deck: string[]): SessionParticipantResponseDto {
    const normalizedName = this.normalizeName(name);
    const normalizedDeck = this.normalizeDeck(deck);
    const participantId = this.generateId('participant');
    const code = this.generateSessionCode();
    const createdAt = new Date().toISOString();

    const owner: Participant = {
      id: participantId,
      name: normalizedName,
      vote: null,
      joinedAt: createdAt
    };

    const session: Session = {
      code,
      ownerParticipantId: participantId,
      deck: normalizedDeck,
      revealed: false,
      createdAt,
      participants: [owner]
    };

    this.sessions.set(code, session);

    return {
      participantId,
      session: this.toSessionView(session, false)
    };
  }

  joinSession(code: string, name: string): SessionParticipantResponseDto {
    const session = this.getSessionOrThrow(code);
    const normalizedName = this.normalizeName(name);
    const participantId = this.generateId('participant');
    const participant: Participant = {
      id: participantId,
      name: this.resolveParticipantName(normalizedName, session.participants),
      vote: null,
      joinedAt: new Date().toISOString()
    };

    session.participants.push(participant);

    return {
      participantId,
      session: this.toSessionView(session, false)
    };
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
    return this.toSessionView(session, false);
  }

  reveal(code: string, participantId: string): SessionViewDto {
    const session = this.getSessionOrThrow(code);
    this.assertOwner(session, participantId);
    session.revealed = true;
    return this.toSessionView(session, true);
  }

  reset(code: string, participantId: string): SessionViewDto {
    const session = this.getSessionOrThrow(code);
    this.assertOwner(session, participantId);
    session.revealed = false;

    for (const participant of session.participants) {
      participant.vote = null;
    }

    return this.toSessionView(session, false);
  }

  leave(code: string, participantId: string): LeaveSessionResponseDto {
    const session = this.getSessionOrThrow(code);
    this.getParticipantOrThrow(session, participantId);

    if (session.ownerParticipantId === participantId) {
      this.sessions.delete(session.code);
      return { deleted: true };
    }

    session.participants = session.participants.filter(
      (participant) => participant.id !== participantId
    );

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
    return {
      code: session.code,
      revealed: session.revealed,
      deck: [...session.deck],
      createdAt: session.createdAt,
      participants: session.participants.map((participant): ParticipantViewDto => ({
        id: participant.id,
        name: participant.name,
        isOwner: participant.id === session.ownerParticipantId,
        hasVoted: participant.vote !== null,
        vote: revealVotes ? participant.vote : null
      }))
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
}
