export type GameStatus = 'setup' | 'lobby' | 'active' | 'paused' | 'finished';
export type GamePhase = 'phase_0' | 'cycle_1' | 'cycle_2' | 'cycle_3' | 'cycle_4' | 'office_1' | 'office_2' | 'office_3' | 'office_4' | 'final';

export interface Game {
  id: string;
  name: string;
  status: GameStatus;
  current_phase: GamePhase;
  current_contest_id: string | null;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Brigade {
  id: string;
  game_id: string;
  name: string;
  number: number;
  prestige_points: number;
  victim_tokens: number;
  color: string | null;
  created_at: string;
}

export type PlayerRole = 'chef_brigade' | 'sous_chef' | 'garde_manger' | 'saucier' | 'patissier' | 'rotisseur' | 'poissonnier' | 'hacker_chef' | 'econome' | 'maitre_hotel';

export interface Player {
  id: string;
  game_id: string;
  brigade_id: string | null;
  user_id: string | null;
  display_name: string;
  role: PlayerRole | null;
  power_used: boolean;
  joined_at: string;
}

export interface Fragment {
  id: string;
  game_id: string;
  position: number;
  content_encrypted: string;
  content_clear: string;
  content_type: 'text' | 'image_url' | 'code';
  metadata: Record<string, any>;
}

export interface BrigadeFragment {
  id: string;
  brigade_id: string;
  fragment_id: string;
  acquired_at: string;
  acquired_via: 'contest' | 'trade' | 'auction' | 'dilemma' | 'bonus';
  contest_id: string | null;
  is_position_revealed: boolean;
  is_decoded: boolean;
}

export interface Contest {
  id: string;
  game_id: string;
  cycle: number;
  order_in_cycle: number;
  type: 'relay' | 'hack' | 'auction' | 'dilemma' | 'coordination';
  variant: 'A' | 'B' | 'C' | 'D';
  status: 'pending' | 'briefing' | 'active' | 'judging' | 'completed';
  config: Record<string, any>;
  fragments_at_stake: string[];
  time_limit_seconds: number | null;
  started_at: string | null;
  ended_at: string | null;
  results: Record<string, any>;
  created_at: string;
}
