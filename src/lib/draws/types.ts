export type DrawFormat = 'single_elimination' | 'round_robin';

export type GeneratedMatch = {
  player1_id: string | null;
  player2_id: string | null;
  draw: string;
  round: string;
  match_number: number;
  sort_order: number;
  notes: string | null;
  status: 'scheduled' | 'walkover';
  winner_id: string | null;
};

export type ProgressionRule = {
  matchNumber: number;
  feedsInto: number;
  slot: 'player1' | 'player2';
};

export type DrawResult = {
  matches: GeneratedMatch[];
  progressionRules: ProgressionRule[];
};

export type PlayerInput = {
  id: string;
  name: string;
  seed: number | null;
  draw: string | null;
};

export type ScheduleConfig = {
  courts: { id: string; name: string }[];
  startTime: Date;
  matchDurationMinutes: number;
  restPeriodMinutes: number;
};

export type ScheduleAssignment = {
  matchNumber: number;
  courtId: string;
  scheduledTime: Date;
};
