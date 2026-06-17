export interface RouletteLastDraw {
  value: string;
  drawnAt: string;
  removable: boolean;
}

export interface RouletteSession {
  code: string;
  ownerTokenHash: string;
  values: string[];
  lastDraw: RouletteLastDraw | null;
  createdAt: string;
  updatedAt: string;
}
