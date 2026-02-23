import { create } from 'zustand';
import { Game, GamePhase, GameStatus, Brigade, Player, Contest, Fragment, BrigadeFragment } from '@/types/game';

interface GameState {
    game: Game | null;
    brigades: Brigade[];
    players: Player[];
    contests: Contest[];
    fragments: Fragment[];
    brigadeFragments: BrigadeFragment[];

    // Player specific state
    currentPlayer: Player | null;
    currentBrigade: Brigade | null;

    // Actions
    setGame: (game: Game) => void;
    setBrigades: (brigades: Brigade[]) => void;
    setCurrentPlayer: (player: Player) => void;
    setCurrentBrigade: (brigade: Brigade) => void;
    updateGameState: (updates: Partial<Game>) => void;
}

export const useGameStore = create<GameState>((set) => ({
    game: null,
    brigades: [],
    players: [],
    contests: [],
    fragments: [],
    brigadeFragments: [],

    currentPlayer: null,
    currentBrigade: null,

    setGame: (game) => set({ game }),
    setBrigades: (brigades) => set({ brigades }),
    setCurrentPlayer: (player) => set({ currentPlayer: player }),
    setCurrentBrigade: (brigade) => set({ currentBrigade: brigade }),
    updateGameState: (updates) => set((state) => ({
        game: state.game ? { ...state.game, ...updates } : null
    })),
}));
