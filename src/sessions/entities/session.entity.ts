export interface Participant {
  id: string;
  name: string;
  vote: string | null;
  joinedAt: string;
  groupId: string | null;
}

export interface SessionGroup {
  id: string;
  name: string;
  createdAt: string;
}

export interface Session {
  code: string;
  ownerParticipantId: string;
  moderatorTokenHash: string;
  deck: string[];
  revealed: boolean;
  createdAt: string;
  groups: SessionGroup[];
  participants: Participant[];
}
