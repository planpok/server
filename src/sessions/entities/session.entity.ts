export interface Participant {
  id: string;
  name: string;
  vote: string | null;
  joinedAt: string;
}

export interface Session {
  code: string;
  ownerParticipantId: string;
  deck: string[];
  revealed: boolean;
  createdAt: string;
  participants: Participant[];
}
