"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Play, Pause, Timer, Settings2, Users, Activity, ChevronsRight, AlertTriangle, Trophy, CheckCircle2 } from "lucide-react";

type GamePhase = 'setup' | 'annonce' | 'contests' | 'temps_libre' | 'finished';

export default function StaffDashboard() {
    const params = useParams();
    const staffId = params.staff_id as string; // Will act as game code or id
    const router = useRouter();

    const [gameId, setGameId] = useState<string | null>(null);
    const [game, setGame] = useState<any>(null);
    const [players, setPlayers] = useState<any[]>([]);
    const [brigades, setBrigades] = useState<any[]>([]);
    const [catalogRoles, setCatalogRoles] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState("control");

    const [currentCycle, setCurrentCycle] = useState(1);
    const [currentPhase, setCurrentPhase] = useState<GamePhase>('setup');
    const [timeLeft, setTimeLeft] = useState(0); // in seconds
    const [timerActive, setTimerActive] = useState(false);
    const [timerKey, setTimerKey] = useState(0); // incrémenté à chaque démarrage pour forcer le reset de l'intervalle
    const [globalTimer, setGlobalTimer] = useState(0);
    const [phaseTimers, setPhaseTimers] = useState<{ [key: string]: number }>({});
    const [cycleContests, setCycleContests] = useState<Record<string, any[]>>({});
    const [contestAssignments, setContestAssignments] = useState<Record<string, Record<string, string>>>({});
    const [catalogContests, setCatalogContests] = useState<any[]>([]);

    // Refs pour éviter les closures obsolètes dans les effets du timer
    const currentPhaseRef = useRef<GamePhase>('setup');
    const currentCycleRef = useRef(1);
    const timerActiveRef = useRef(false);
    const timeLeftRef = useRef(0);
    const globalTimerRef = useRef(0);
    const phaseTimersRef = useRef<{ [key: string]: number }>({});
    const contestAssignmentsRef = useRef<Record<string, Record<string, string>>>({});
    const gameIdRef = useRef<string | null>(null);
    const gameSettingsRef = useRef<any>(null);
    // Flag pour bloquer la resync externe pendant une transition automatique
    const isTransitioningRef = useRef(false);

    useEffect(() => {
        // Attempt to find game by ID or assume staffId is a code.
        // For now, we query by id (assuming staffId = gameId)
        // If your schema uses a specific staff_code, replace 'id' with 'staff_code'
        const initStaff = async () => {
            let gameData;
            if (staffId.length > 15) {
                // Fallback direct Game ID 
                const { data } = await supabase.from('games').select('*').eq('id', staffId).single();
                gameData = data;
            } else {
                // Fetch from staff table code
                const { data: staffData } = await supabase.from('staff').select('game_id').eq('code', staffId).single();
                if (staffData) {
                    const { data } = await supabase.from('games').select('*').eq('id', staffData.game_id).single();
                    gameData = data;
                }
            }

            if (gameData) {
                setGameId(gameData.id);
                setGame(gameData);
                fetchBrigades(gameData.id);
                fetchPlayers(gameData.id);
                fetchRoles();

                // Load catalog contests
                const { data: contestsData } = await supabase.from('catalog_contests').select('*').order('title', { ascending: true });
                if (contestsData) setCatalogContests(contestsData);

                // Restore Timers from active_contest if exists
                if (gameData.active_contest) {
                    try {
                        const tc = typeof gameData.active_contest === 'string' ? JSON.parse(gameData.active_contest) : gameData.active_contest;
                        const elapsedSinceUpdate = Math.floor((Date.now() - tc.updatedAt) / 1000);
                        if (tc.timerActive && tc.updatedAt) {
                            setTimeLeft(Math.max(0, tc.timeLeft - elapsedSinceUpdate));
                            setGlobalTimer((tc.globalTime || 0) + Math.max(0, tc.timeLeft > 0 ? elapsedSinceUpdate : tc.timeLeft));
                            setTimerActive(true);
                        } else {
                            setTimeLeft(tc.timeLeft);
                            setGlobalTimer(tc.globalTime || 0);
                            setTimerActive(false);
                        }
                        if (tc.phaseTimers) {
                            setPhaseTimers(tc.phaseTimers);
                        }
                        if (tc.contestAssignments) {
                            setContestAssignments(tc.contestAssignments);
                        }
                    } catch (e) { console.error("Error parsing initial active_contest:", e); }
                }

                // Setup realtime sync
                const sub = supabase.channel(`staff-${gameData.id}`)
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameData.id}` }, (p) => setGame(p.new))
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => fetchPlayers(gameData.id))
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'brigades', filter: `game_id=eq.${gameData.id}` }, () => fetchBrigades(gameData.id))
                    .subscribe();

                return () => {
                    supabase.removeChannel(sub);
                };
            }
        };
        initStaff();
    }, [staffId]);

    // Synchroniser les refs avec les états
    useEffect(() => { currentPhaseRef.current = currentPhase; }, [currentPhase]);
    useEffect(() => { currentCycleRef.current = currentCycle; }, [currentCycle]);
    useEffect(() => { timerActiveRef.current = timerActive; }, [timerActive]);
    useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);
    useEffect(() => { globalTimerRef.current = globalTimer; }, [globalTimer]);
    useEffect(() => { phaseTimersRef.current = phaseTimers; }, [phaseTimers]);
    useEffect(() => { contestAssignmentsRef.current = contestAssignments; }, [contestAssignments]);
    useEffect(() => { gameIdRef.current = gameId; }, [gameId]);
    useEffect(() => { gameSettingsRef.current = game?.settings; }, [game?.settings]);

    useEffect(() => {
        if (game?.status) {
            const status = game.status as string;
            if (status === 'finished') {
                setCurrentPhase('finished');
            } else if (status.includes('_c')) {
                const parts = status.split('_c');
                const ph = parts[0] as GamePhase;
                const cyc = parseInt(parts[1], 10);
                if (!isNaN(cyc)) setCurrentCycle(cyc);
                if (['setup', 'annonce', 'contests', 'temps_libre'].includes(ph)) {
                    setCurrentPhase(ph);
                }
            } else if (status === 'setup') {
                setCurrentPhase('setup');
                setCurrentCycle(1);
            }
        }
    }, [game?.status]);

    // Fonction de transition automatique — lit toujours les refs fraîches
    const autoAdvancePhase = useCallback(async () => {
        if (isTransitioningRef.current) return;
        isTransitioningRef.current = true;

        const phase = currentPhaseRef.current;
        const cycle = currentCycleRef.current;
        const currentGlobalTimer = globalTimerRef.current;
        const currentPhaseTimers = phaseTimersRef.current;
        const currentContestAssignments = contestAssignmentsRef.current;
        const currentGameId = gameIdRef.current;
        const settings = gameSettingsRef.current;
        const M_TO_S = 60;

        const updatedPhaseTimers = { ...currentPhaseTimers };
        if (phase !== 'setup' && phase !== 'finished') {
            updatedPhaseTimers[phase] = 0;
        }

        let nextPhase: GamePhase = phase;
        let nextCycle = cycle;
        let logMessage = '';

        if (phase === 'annonce') {
            nextPhase = 'contests';
            logMessage = `[SYSTEM] Temps écoulé (Annonce). Lancement automatique de l'étape : CONTESTS.`;
        } else if (phase === 'contests') {
            nextPhase = 'temps_libre';
            logMessage = `[SYSTEM] Temps écoulé (Contests). Lancement automatique de l'étape : TEMPS LIBRE.`;
        } else if (phase === 'temps_libre') {
            if (cycle < 4) {
                nextCycle = cycle + 1;
                nextPhase = 'annonce';
                logMessage = `[SYSTEM] Fin du cycle ${cycle}. Lancement automatique du CYCLE ${nextCycle} : ANNONCE.`;
            } else {
                nextPhase = 'finished';
                logMessage = `[SYSTEM] Fin de la partie. CLÔTURE DE L'INSTANCE.`;
            }
        }

        if (nextPhase === 'finished') {
            setCurrentPhase('finished');
            setTimerActive(false);
            const syncData = JSON.stringify({ timeLeft: 0, globalTime: currentGlobalTimer, timerActive: false, updatedAt: Date.now(), phaseTimers: updatedPhaseTimers, contestAssignments: currentContestAssignments });
            setGame((prev: any) => ({ ...prev, status: 'finished', active_contest: syncData }));
            await supabase.from('games').update({ status: 'finished', active_contest: syncData }).eq('id', currentGameId);
            await supabase.from('game_logs').insert({ game_id: currentGameId, event_type: 'game_finish', message: logMessage });
            isTransitioningRef.current = false;
            return;
        }

        // Préparer la nouvelle phase
        let newPhaseTimers = { ...updatedPhaseTimers };
        let newContestAssignments = { ...currentContestAssignments };
        const cycleChanged = nextCycle !== cycle;

        if (cycleChanged) {
            newPhaseTimers = {};
            newContestAssignments = {};
            setCurrentCycle(nextCycle);
            setContestAssignments({});
        }

        const defaultTime = nextPhase === 'annonce'
            ? (settings?.annonce || 4)
            : nextPhase === 'contests'
                ? (settings?.contests || 9)
                : (settings?.temps_libre || 7);
        const nextTime = newPhaseTimers[nextPhase] !== undefined ? newPhaseTimers[nextPhase] : (defaultTime * M_TO_S);

        // Mettre à jour la ref synchronement AVANT de démarrer le nouveau timer
        timeLeftRef.current = nextTime;
        currentPhaseRef.current = nextPhase;
        currentCycleRef.current = nextCycle;

        setCurrentPhase(nextPhase);
        setTimeLeft(nextTime);
        setPhaseTimers(newPhaseTimers);
        // Incrémenter timerKey pour forcer le useEffect de l'intervalle à créer un nouvel interval
        setTimerKey(k => k + 1);
        setTimerActive(true);

        const syncData = JSON.stringify({ timeLeft: nextTime, globalTime: currentGlobalTimer, timerActive: true, updatedAt: Date.now(), phaseTimers: newPhaseTimers, contestAssignments: newContestAssignments });
        setGame((prev: any) => ({ ...prev, status: `${nextPhase}_c${nextCycle}`, active_contest: syncData }));
        await supabase.from('games').update({ status: `${nextPhase}_c${nextCycle}`, active_contest: syncData }).eq('id', currentGameId);
        await supabase.from('game_logs').insert({
            game_id: currentGameId,
            event_type: cycleChanged ? 'cycle_change' : 'phase_change',
            message: logMessage
        });

        // Débloquer après un court délai pour laisser les refs se mettre à jour
        setTimeout(() => { isTransitioningRef.current = false; }, 500);
    }, []);

    // Tick du timer — timerKey force la recréation de l'intervalle à chaque nouveau démarrage
    useEffect(() => {
        if (!timerActive) return;

        const interval = setInterval(() => {
            const newTimeLeft = Math.max(0, timeLeftRef.current - 1);
            timeLeftRef.current = newTimeLeft;
            setTimeLeft(newTimeLeft);
            globalTimerRef.current = globalTimerRef.current + 1;
            setGlobalTimer(prev => prev + 1);

            // Détecter la fin du timer directement dans le tick
            if (newTimeLeft === 0) {
                clearInterval(interval);
                timerActiveRef.current = false;
                setTimerActive(false);

                const phase = currentPhaseRef.current;
                if (phase === 'annonce' || phase === 'contests' || phase === 'temps_libre') {
                    autoAdvancePhase();
                }
            }
        }, 1000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timerActive, timerKey, autoAdvancePhase]);

    // Sync depuis la DB quand un autre client met à jour (ne pas rejouer si c'est nous qui venons de le faire)
    useEffect(() => {
        if (game?.active_contest) {
            // Si une transition est en cours côté local, ignorer la resync
            if (isTransitioningRef.current) return;
            try {
                const tc = typeof game.active_contest === 'string' ? JSON.parse(game.active_contest) : game.active_contest;
                if (tc.updatedAt) {
                    const elapsedSinceUpdate = Math.floor((Date.now() - tc.updatedAt) / 1000);
                    if (tc.timerActive) {
                        const newTL = Math.max(0, tc.timeLeft - elapsedSinceUpdate);
                        timeLeftRef.current = newTL;
                        setTimeLeft(newTL);
                        setTimerActive(true);
                    } else {
                        timeLeftRef.current = tc.timeLeft;
                        setTimeLeft(tc.timeLeft);
                        setTimerActive(false);
                    }
                    if (tc.phaseTimers) setPhaseTimers(tc.phaseTimers);
                    if (tc.contestAssignments) setContestAssignments(tc.contestAssignments);
                }
            } catch (e) { }
        }
    }, [game?.active_contest]);

    const fetchPlayers = async (gId: string) => {
        // Players are linked to brigade, so we fetch players of brigades in this game.
        const { data: bData } = await supabase.from('brigades').select('id').eq('game_id', gId);
        if (bData && bData.length > 0) {
            const bIds = bData.map(b => b.id);
            const { data: pData } = await supabase.from('players').select('*').in('brigade_id', bIds).order('name');
            if (pData) setPlayers(pData);
        }
    };

    const fetchBrigades = async (gId: string) => {
        const { data } = await supabase.from('brigades').select('*').eq('game_id', gId).order('name');
        if (data) setBrigades(data);
    };

    const fetchRoles = async () => {
        const { data } = await supabase.from('catalog_roles').select('*');
        if (data) setCatalogRoles(data);
    };

    useEffect(() => {
        const fetchContests = async () => {
            const { data } = await supabase.from('catalog_fragments')
                .select('*')
                .like('contest', `${currentCycle}.%`);
            if (data) {
                const grouped = data.reduce((acc: any, f: any) => {
                    const cName = f.contest;
                    // Ignorer les fragments sans format contest X.Y
                    if (cName === 'Caché' || !cName) return acc;
                    if (!acc[cName]) acc[cName] = [];
                    acc[cName].push(f);
                    return acc;
                }, {});
                setCycleContests(grouped);
            }
        };
        fetchContests();
    }, [currentCycle]);

    const handleValidateContest = async (contestName: string) => {
        const assignments = contestAssignments[contestName];
        if (!assignments) return;

        let anyAssigned = false;
        let winnersLog: string[] = [];

        for (const [pos, brigadeId] of Object.entries(assignments)) {
            if (!brigadeId || brigadeId === 'null') continue;

            const frag = cycleContests[contestName]?.find(f => f.position === pos);
            if (!frag) continue;

            const brigade = brigades.find(b => b.id === brigadeId);
            if (brigade) {
                // On prépare le log global des vainqueurs (même si inventaire plein)
                winnersLog.push(`${pos}: ${brigade.name}`);
            }

            const { data: inv } = await supabase.from('inventory').select('*').eq('brigade_id', brigadeId);
            if (inv && inv.length > 0) {
                const alreadyHas = inv.some((slot: any) => slot.fragment_data === frag.fragment_id);
                if (!alreadyHas) {
                    const emptySlot = inv.find((slot: any) => !slot.fragment_data);
                    if (emptySlot) {
                        await supabase.from('inventory').update({ fragment_data: frag.fragment_id }).eq('id', emptySlot.id);
                        if (brigade) {
                            await supabase.from('game_logs').insert({
                                game_id: gameId,
                                brigade_id: brigadeId,
                                event_type: 'contest_won',
                                message: `🏆 CONTEST ${contestName} : La ${brigade.name} s'empare de la position ${pos}! Fragment débloqué.`
                            });
                        }
                        anyAssigned = true;
                    }
                }
            }
        }

        if (winnersLog.length > 0) {
            // Log global pour tout le monde
            await supabase.from('game_logs').insert({
                game_id: gameId,
                event_type: 'contest_won_global',
                message: `📢 RÉSULTATS DU CONTEST ${contestName} : Les scores sont validés ! (${winnersLog.join(', ')})`
            });
            alert(`Les résultats du Contest ${contestName} ont bien été annoncés dans les logs !${anyAssigned ? " Des fragments ont été distribués aux vainqueurs." : " Aucun fragment distribué (inventaires pleins ou déjà possédés)."}`);
        } else {
            alert(`Aucune brigade sélectionnée pour ce Contest.`);
        }
    };

    const handlePlayerUpdate = async (playerId: string, field: string, value: string) => {
        try {
            await supabase.from('players').update({ [field]: value === 'null' ? null : value }).eq('id', playerId);
            // Data will refresh via realtime
        } catch (e) {
            console.error('Update failed', e);
        }
    };

    // --- GAME CONTROL LOGIC ---
    const M_TO_S = 60;
    const PHASE_CONFIG = {
        'annonce': { title: "ANNONCE & DISPATCH", time: (game?.settings?.annonce || 4) * M_TO_S, desc: "Annonce des 3 Contests. Les brigades répartissent leurs cibles." },
        'contests': { title: "CONTESTS", time: (game?.settings?.contests || 9) * M_TO_S, desc: "Mini-jeux simultanés. Résolution des épreuves." },
        'temps_libre': { title: "TEMPS LIBRE", time: (game?.settings?.temps_libre || 7) * M_TO_S, desc: "Déchiffrement, Office, Comptoir, Espionnage et Débrief." }
    };

    const startPhase = async (phase: 'annonce' | 'contests' | 'temps_libre') => {
        const updatedPhaseTimers = { ...phaseTimers };
        if (currentPhase !== 'setup' && currentPhase !== 'finished') {
            updatedPhaseTimers[currentPhase] = timeLeft;
        }

        const t = updatedPhaseTimers[phase] !== undefined ? updatedPhaseTimers[phase] : PHASE_CONFIG[phase].time;

        // Mettre à jour les refs synchronement AVANT de démarrer le timer
        timeLeftRef.current = t;
        currentPhaseRef.current = phase;

        setCurrentPhase(phase);
        setTimeLeft(t);
        setPhaseTimers(updatedPhaseTimers);
        setTimerKey(k => k + 1); // forcer la recréation de l'intervalle
        setTimerActive(true);

        const syncData = JSON.stringify({ timeLeft: t, globalTime: globalTimer, timerActive: true, updatedAt: Date.now(), phaseTimers: updatedPhaseTimers, contestAssignments });
        // Broadcast phase and timer state to the database
        setGame((prev: any) => ({ ...prev, status: `${phase}_c${currentCycle}`, active_contest: syncData }));
        await supabase.from('games').update({ status: `${phase}_c${currentCycle}`, active_contest: syncData }).eq('id', gameId);

        // Log phase change
        await supabase.from('game_logs').insert({
            game_id: gameId,
            event_type: 'phase_change',
            message: `[SYSTEM] Activation de l'étape : ${PHASE_CONFIG[phase].title}.`
        });
    };

    const startGame = async () => {
        await supabase.from('game_logs').insert({
            game_id: gameId,
            event_type: 'game_start',
            message: `[SYSTEM] INITIALISATION DES SYSTÈMES. DÉBUT DU CYCLE 1.`
        });
        // Automatically jump into "annonce" phase with full layout activation
        await startPhase('annonce');
    };

    const toggleTimer = async () => {
        const newState = !timerActive;
        if (newState) {
            // Reprise : s'assurer que la ref est à jour avant de recréer l'intervalle
            timeLeftRef.current = timeLeft;
            setTimerKey(k => k + 1);
        }
        setTimerActive(newState);

        const updatedPhaseTimers = { ...phaseTimers };
        if (currentPhase !== 'setup' && currentPhase !== 'finished') {
            updatedPhaseTimers[currentPhase] = timeLeft;
            setPhaseTimers(updatedPhaseTimers);
        }

        const syncData = JSON.stringify({ timeLeft: timeLeft, globalTime: globalTimer, timerActive: newState, updatedAt: Date.now(), phaseTimers: updatedPhaseTimers, contestAssignments });
        setGame((prev: any) => ({ ...prev, active_contest: syncData }));
        await supabase.from('games').update({ active_contest: syncData }).eq('id', gameId);

        await supabase.from('game_logs').insert({
            game_id: gameId,
            event_type: newState ? 'timer_resumed' : 'timer_paused',
            message: newState ? `[SYSTEM] Temporisation : REPRISE. Protocoles en cours.` : `[SYSTEM] Temporisation : PAUSE. Suspendu par le GM.`
        });
    };

    const adjustTime = async (seconds: number) => {
        const newTime = Math.max(0, timeLeft + seconds);
        setTimeLeft(newTime);

        const updatedPhaseTimers = { ...phaseTimers };
        if (currentPhase !== 'setup' && currentPhase !== 'finished') {
            updatedPhaseTimers[currentPhase] = newTime;
            setPhaseTimers(updatedPhaseTimers);
        }

        const syncData = JSON.stringify({ timeLeft: newTime, globalTime: globalTimer, timerActive, updatedAt: Date.now(), phaseTimers: updatedPhaseTimers, contestAssignments });
        setGame((prev: any) => ({ ...prev, active_contest: syncData }));
        await supabase.from('games').update({ active_contest: syncData }).eq('id', gameId);
    };

    const resetPhaseTimer = async () => {
        if (currentPhase === 'setup' || currentPhase === 'finished') return;
        const t = PHASE_CONFIG[currentPhase as keyof typeof PHASE_CONFIG].time;

        const diff = t - timeLeft;
        const newGlobalTimer = Math.max(0, globalTimer - diff);

        setTimeLeft(t);
        setGlobalTimer(newGlobalTimer);
        setTimerActive(false);

        const updatedPhaseTimers = { ...phaseTimers };
        updatedPhaseTimers[currentPhase] = t;
        setPhaseTimers(updatedPhaseTimers);

        const syncData = JSON.stringify({ timeLeft: t, globalTime: newGlobalTimer, timerActive: false, updatedAt: Date.now(), phaseTimers: updatedPhaseTimers, contestAssignments });
        setGame((prev: any) => ({ ...prev, active_contest: syncData }));
        await supabase.from('games').update({ active_contest: syncData }).eq('id', gameId);
    };

    const advanceCycle = async () => {
        if (currentCycle < 4) {
            const nextCycle = currentCycle + 1;
            setCurrentCycle(nextCycle);
            setCurrentPhase('setup');
            setTimeLeft(0);
            setTimerActive(false);
            setPhaseTimers({});

            const syncData = JSON.stringify({ timeLeft: 0, globalTime: globalTimer, timerActive: false, updatedAt: Date.now(), phaseTimers: {} });
            setGame((prev: any) => ({ ...prev, status: `setup_c${nextCycle}`, active_contest: syncData }));
            await supabase.from('games').update({ status: `setup_c${nextCycle}`, active_contest: syncData }).eq('id', gameId);

            await supabase.from('game_logs').insert({
                game_id: gameId,
                event_type: 'cycle_change',
                message: `[SYSTEM] FIN DU CYCLE ${currentCycle}. EN ATTENTE D'INITIALISATION DU CYCLE ${nextCycle}.`
            });
        } else {
            setCurrentPhase('finished');
            setGame((prev: any) => ({ ...prev, status: 'finished' }));
            await supabase.from('games').update({ status: 'finished' }).eq('id', gameId);

            await supabase.from('game_logs').insert({
                game_id: gameId,
                event_type: 'game_finish',
                message: `[SYSTEM] FIN DES OPÉRATIONS. CLÔTURE DE L'INSTANCE.`
            });
        }
    };

    const handleResetInstance = async () => {
        if (!window.confirm("⚠️ ATTENTION : Voulez-vous vraiment réinitialiser toutes les données de cette instance (objets, notes, recettes, évènements) ?\nLes joueurs, les équipes et leurs attributions de rôles seront conservés.")) {
            return;
        }

        try {
            const bIds = brigades.map(b => b.id);
            if (bIds.length > 0) {
                // Clear inventory entries (keeps the slots but empties them)
                await supabase.from('inventory').update({ fragment_data: null }).in('brigade_id', bIds);
                // Clear recipe notes for participating brigades
                await supabase.from('recipe_notes').delete().in('brigade_id', bIds);
                // Clear recipe test attempts
                await supabase.from('recipe_tests').delete().in('brigade_id', bIds);
                // Turn power usage tokens off for participating players
                await supabase.from('players').update({ role_used: false }).in('brigade_id', bIds);
            }

            // Delete game logs globally for this game
            await supabase.from('game_logs').delete().eq('game_id', gameId);

            // Reset game state
            const syncData = JSON.stringify({ timeLeft: 0, globalTime: 0, timerActive: false, updatedAt: Date.now(), phaseTimers: {}, contestAssignments: {} });
            setGame((prev: any) => ({ ...prev, status: 'setup', active_contest: syncData }));
            await supabase.from('games').update({
                status: 'setup',
                active_contest: syncData
            }).eq('id', gameId);

            // Local state resets
            setCurrentCycle(1);
            setCurrentPhase('setup');
            setTimeLeft(0);
            setGlobalTimer(0);
            setTimerActive(false);
            setPhaseTimers({});
            setContestAssignments({});

            alert("✅ L'instance a été réinitialisée avec succès !");
        } catch (e) {
            console.error("Erreur lors du reset", e);
            alert("Une erreur s'est produite lors de la connexion à la base de données.");
        }
    };

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    if (!game) return <div className="p-8 text-white font-mono flex items-center gap-4"><Activity className="animate-spin" /> ACCÈS STAFF EN COURS...</div>;

    const cycleMins = (game?.settings?.annonce || 4) + (game?.settings?.contests || 9) + (game?.settings?.temps_libre || 7);
    const totalMins = cycleMins * 4;
    const globalProgressPercent = Math.min(100, (globalTimer / (totalMins * 60)) * 100);

    return (
        <div className="min-h-screen flex flex-col p-4 md:p-8 bg-background relative overflow-hidden">
            {/* Background design */}
            <div className="absolute top-0 right-0 w-1/4 h-1/4 bg-blue-500/5 rounded-full blur-3xl -z-10" />
            <div className="absolute bottom-0 left-0 w-1/4 h-1/4 bg-purple-500/5 rounded-full blur-3xl -z-10" />

            <header className="flex flex-col md:flex-row items-center justify-between pb-6 border-b border-white/10 mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-widest font-mono text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 flex items-center gap-3">
                        <Shield className="w-8 h-8 text-blue-500" />
                        STAFF_CONTROL // {game.name}
                    </h1>
                    <p className="text-muted-foreground font-mono text-sm mt-1">INSTANCE ID: {game.id.split('-')[0]}... | CYCLE: {currentCycle}/4</p>
                </div>
                <div className="mt-4 md:mt-0 flex gap-4">
                    <Button variant="destructive" className="font-mono text-xs shadow-[0_0_15px_-3px_rgba(239,68,68,0.4)]" onClick={handleResetInstance}>
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        RESET INSTANCE
                    </Button>
                    <Button variant="outline" className="font-mono text-xs border-white/20 hover:bg-white/5" onClick={() => router.push("/")}>
                        LOGOUT
                    </Button>
                </div>
            </header>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col w-full max-w-7xl mx-auto">
                <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/10 p-1 mb-6 rounded-xl">
                    <TabsTrigger value="control" className="font-mono text-xs md:text-sm data-[state=active]:bg-blue-500/20 glass-panel">GAME_DIRECTOR</TabsTrigger>
                    <TabsTrigger value="players" className="font-mono text-xs md:text-sm data-[state=active]:bg-purple-500/20 glass-panel">PLAYER_MANAGEMENT</TabsTrigger>
                </TabsList>

                {/* GAME CONTROL TAB */}
                <TabsContent value="control" className="space-y-6 flex-1">
                    {game.status === 'setup' ? (
                        <Card className="glass-panel border-white/10 bg-background/50 h-[500px] flex flex-col items-center justify-center">
                            <Shield className="w-16 h-16 text-blue-500 mb-6 animate-pulse" />
                            <h2 className="text-3xl font-mono font-bold text-white mb-2">PARTIE EN ATTENTE</h2>
                            <p className="font-mono text-muted-foreground mb-8 text-center max-w-md">
                                Les brigades et les joueurs sont prêts ? Lancez la partie pour activer les cycles de jeu et prendre le contrôle central.
                            </p>
                            <Button
                                size="lg"
                                onClick={startGame}
                                className="font-mono bg-blue-600 hover:bg-blue-500 text-white h-16 px-12 text-lg rounded-full shadow-[0_0_40px_-10px_rgba(59,130,246,0.6)]"
                            >
                                <Play className="w-6 h-6 mr-3 stroke-[3px]" /> LANCER LA PARTIE
                            </Button>
                        </Card>
                    ) : (
                        <div className="space-y-6">
                            {/* GLOBAL TIMELINE OVERVIEW */}
                            <Card className="glass-panel border-white/10 bg-background/50">
                                <CardHeader className="border-b border-white/5 pb-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="font-mono flex items-center gap-2 text-xl">
                                            <Activity className="w-5 h-5 text-blue-400" />
                                            GLOBAL_TIMELINE
                                        </CardTitle>
                                        <div className="font-mono text-xl font-bold flex items-baseline gap-2">
                                            <span className="text-white">{formatTime(globalTimer)}</span>
                                            <span className="text-muted-foreground text-sm">/ {totalMins}:00</span>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="relative h-10 rounded-full bg-white/5 border border-white/10 overflow-hidden flex shadow-inner">
                                        {/* Progress fill */}
                                        <div
                                            className="absolute top-0 left-0 h-full pointer-events-none transition-all duration-1000 ease-linear shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                                            style={{ width: `${globalProgressPercent}%` }}
                                        >
                                            <div className="w-full h-full bg-gradient-to-r from-blue-600/60 to-purple-500/80" />
                                        </div>

                                        {/* Cycle dividers & labels */}
                                        {[1, 2, 3, 4].map((c) => (
                                            <div key={c} className={`flex-1 flex items-center justify-center border-r border-white/10 last:border-0 relative z-10 transition-colors ${currentCycle === c ? 'bg-white/10' : ''}`}>
                                                <span className={`font-mono text-sm uppercase tracking-wider drop-shadow-md ${currentCycle === c ? 'font-bold text-white' : 'font-medium text-white/50'}`}>
                                                    CYCLE {c} <span className="text-xs opacity-75">({cycleMins}M)</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* TIMER & MAIN CONTROLS */}
                                <Card className="glass-panel border-white/10 bg-background/50 lg:col-span-2">
                                    <CardHeader className="border-b border-white/5 pb-4">
                                        <CardTitle className="font-mono flex items-center gap-2 text-xl">
                                            <Timer className="w-6 h-6 text-blue-400" />
                                            CYCLE {currentCycle} OF 4
                                        </CardTitle>
                                        <CardDescription className="font-mono text-xs text-muted-foreground uppercase">
                                            {currentPhase !== 'setup' ? PHASE_CONFIG[currentPhase as keyof typeof PHASE_CONFIG]?.title : "EN ATTENTE"}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-8 flex flex-col items-center justify-center">
                                        <div className={`text-7xl md:text-9xl font-black font-mono tracking-tighter transition-colors ${timeLeft <= 60 && timerActive && timeLeft > 0 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                                            {formatTime(timeLeft)}
                                        </div>
                                        <div className="flex gap-4 mt-8">
                                            <Button size="lg" onClick={toggleTimer} className="font-mono bg-white/10 hover:bg-white/20 border border-white/20 h-16 w-16 p-0 rounded-full flex items-center justify-center" disabled={currentPhase === 'setup'}>
                                                {timerActive ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                                            </Button>
                                            <Button size="lg" onClick={() => adjustTime(60)} variant="outline" className="font-mono h-16 px-6 border-white/20">+1 MIN</Button>
                                            <Button size="lg" onClick={() => adjustTime(-60)} variant="outline" className="font-mono h-16 px-6 border-white/20">-1 MIN</Button>
                                            <Button size="lg" onClick={resetPhaseTimer} variant="outline" className="font-mono h-16 px-6 border-white/20 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400" disabled={currentPhase === 'setup'}>RESET</Button>
                                        </div>
                                    </CardContent>
                                    <div className="border-t border-white/5 bg-white/5 grid grid-cols-3 divide-x divide-white/10">
                                        <button onClick={() => startPhase('annonce')} className={`p-4 flex flex-col items-center justify-center gap-2 transition-colors hover:bg-blue-500/10 ${currentPhase === 'annonce' ? 'bg-blue-500/20' : ''}`}>
                                            <span className="font-mono text-xs font-bold text-blue-400">01. ANNONCE</span>
                                            <span className="font-mono text-[10px] text-muted-foreground">
                                                {currentPhase === 'annonce' ? `${formatTime(timeLeft)} LEFT` : phaseTimers['annonce'] !== undefined ? `${formatTime(phaseTimers['annonce'])} LEFT` : `${game?.settings?.annonce || 4} MIN`}
                                            </span>
                                        </button>
                                        <button onClick={() => startPhase('contests')} className={`p-4 flex flex-col items-center justify-center gap-2 transition-colors hover:bg-purple-500/10 ${currentPhase === 'contests' ? 'bg-purple-500/20' : ''}`}>
                                            <span className="font-mono text-xs font-bold text-purple-400">02. CONTESTS</span>
                                            <span className="font-mono text-[10px] text-muted-foreground">
                                                {currentPhase === 'contests' ? `${formatTime(timeLeft)} LEFT` : phaseTimers['contests'] !== undefined ? `${formatTime(phaseTimers['contests'])} LEFT` : `${game?.settings?.contests || 7} MIN`}
                                            </span>
                                        </button>
                                        <button onClick={() => startPhase('temps_libre')} className={`p-4 flex flex-col items-center justify-center gap-2 transition-colors hover:bg-green-500/10 ${currentPhase === 'temps_libre' ? 'bg-green-500/20' : ''}`}>
                                            <span className="font-mono text-xs font-bold text-green-400">03. TEMPS LIBRE</span>
                                            <span className="font-mono text-[10px] text-muted-foreground">
                                                {currentPhase === 'temps_libre' ? `${formatTime(timeLeft)} LEFT` : phaseTimers['temps_libre'] !== undefined ? `${formatTime(phaseTimers['temps_libre'])} LEFT` : `${game?.settings?.temps_libre || 9} MIN`}
                                            </span>
                                        </button>
                                    </div>
                                </Card>

                                {/* CYCLE CONTESTS PANEL */}
                                <div className="space-y-6">
                                    <Card className="glass-panel border-white/10 bg-background/50 h-full">
                                        <CardHeader className="border-b border-white/5 pb-3">
                                            <CardTitle className="font-mono text-sm text-muted-foreground flex items-center gap-2">
                                                <Trophy className="w-4 h-4 text-purple-400" />
                                                CONTESTS — CYCLE {currentCycle}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 space-y-3">
                                            {(() => {
                                                const cycleItems = catalogContests
                                                    .filter(c => c.title.match(new RegExp(`^${currentCycle}\.`)))
                                                    .sort((a, b) => a.title.localeCompare(b.title))
                                                    .slice(0, 3);

                                                const parseDesc = (desc: string) => {
                                                    const parts = desc.split(' | ');
                                                    const rawEffectif = parts[1]?.trim() || '?';
                                                    return {
                                                        type: parts[0]?.trim() || '?',
                                                        effectif: rawEffectif.replace(/Min/g, 'Minimum').replace(/Max/g, 'Maximum'),
                                                        rolesUtiles: parts[parts.length - 1]?.replace('Rôles utiles:', '').trim() || ''
                                                    };
                                                };

                                                const typeColors: Record<string, string> = {
                                                    'Mémoire': 'text-blue-400   border-blue-400/30   bg-blue-400/8',
                                                    'Physique': 'text-orange-400 border-orange-400/30 bg-orange-400/8',
                                                    'Social': 'text-pink-400   border-pink-400/30   bg-pink-400/8',
                                                    'Coordination': 'text-emerald-400 border-emerald-400/30 bg-emerald-400/8',
                                                    'Dilemme': 'text-red-400    border-red-400/30    bg-red-400/8',
                                                    'Logique': 'text-purple-400 border-purple-400/30 bg-purple-400/8',
                                                    'Stratégie': 'text-yellow-400 border-yellow-400/30 bg-yellow-400/8',
                                                };

                                                if (cycleItems.length === 0) {
                                                    return (
                                                        <div className="text-white/30 text-center text-xs font-mono py-8">
                                                            Aucun contest trouvé pour le Cycle {currentCycle}.<br />
                                                            <span className="text-[10px] opacity-60">Vérifiez le catalog_contests.</span>
                                                        </div>
                                                    );
                                                }

                                                return cycleItems.map((contest, i) => {
                                                    const num = contest.title.split('—')[0]?.trim() || contest.title.split('-')[0]?.trim();
                                                    const titlePart = contest.title.includes('—')
                                                        ? contest.title.split('—').slice(1).join('—').trim()
                                                        : contest.title.includes(' - ')
                                                            ? contest.title.split(' - ').slice(1).join(' - ').trim()
                                                            : '';
                                                    const { type, effectif } = parseDesc(contest.description);
                                                    const typeColor = typeColors[type] || 'text-white/50 border-white/10 bg-white/5';

                                                    return (
                                                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/8 hover:bg-white/8 transition-colors">
                                                            {/* Number badge */}
                                                            <div className="shrink-0 w-12 h-12 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                                                                <span className="font-mono text-sm font-black text-purple-300 leading-none">{num?.replace('—', '').trim()}</span>
                                                            </div>
                                                            {/* Info */}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-mono text-xs font-bold text-white leading-tight mb-1.5">{titlePart || '???'}</p>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${typeColor}`}>
                                                                        {type}
                                                                    </span>
                                                                    <span className="font-mono text-[9px] bg-white/8 border border-white/15 px-2 py-0.5 rounded-full text-white/60">
                                                                        {effectif}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </CardContent>
                                        {currentPhase === 'temps_libre' && timeLeft === 0 && (
                                            <CardFooter className="pt-4 border-t border-white/5">
                                                <Button onClick={advanceCycle} className="w-full font-mono bg-white hover:bg-neutral-200 text-black">
                                                    <ChevronsRight className="w-4 h-4 mr-2" />
                                                    PASSER AU CYCLE {currentCycle + 1}
                                                </Button>
                                            </CardFooter>
                                        )}
                                    </Card>
                                </div>
                            </div>

                            {(currentPhase === 'contests' || currentPhase === 'temps_libre') && Object.keys(cycleContests).length > 0 && (
                                <Card className="glass-panel border-white/10 bg-background/50 mt-6 md:mt-8">
                                    <CardHeader className="border-b border-white/5 pb-4">
                                        <CardTitle className="font-mono text-xl flex items-center gap-2 text-purple-400">
                                            <Trophy className="w-5 h-5" />
                                            DÉCISION DES CONTESTS
                                        </CardTitle>
                                        <CardDescription className="font-mono text-xs">Attribuez les brigades gagnantes pour chaque Contest du cycle actuel. Cela débloquera directement leurs fragments associés.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                        {Object.entries(cycleContests)
                                            .sort(([a], [b]) => a.localeCompare(b))
                                            .slice(0, 3)
                                            .map(([contestName, fragments]) => (
                                                <div key={contestName} className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col justify-between hover:bg-white/10 transition-colors shadow-lg">
                                                    <div>
                                                        <h3 className="font-mono font-bold text-white mb-6 flex items-center justify-between">
                                                            <span className="bg-purple-500/20 shadow-[0_0_15px_-3px_rgba(147,51,234,0.4)] text-purple-400 px-4 py-2 rounded text-base md:text-lg tracking-wider w-full text-center">CONTEST {contestName}</span>
                                                        </h3>
                                                        <div className="space-y-4 mb-6">
                                                            {['1er', '2e', '3e'].map(pos => {
                                                                const frag = fragments.find(f => f.position === pos);
                                                                if (!frag) return null;
                                                                return (
                                                                    <div key={pos} className="flex flex-col gap-2">
                                                                        <span className="font-mono text-sm font-bold text-muted-foreground uppercase flex items-center gap-2">
                                                                            {pos}
                                                                        </span>
                                                                        <select
                                                                            className="h-12 w-full bg-black/50 border border-white/20 rounded-md px-4 font-mono text-sm text-white uppercase focus:border-purple-500 outline-none transition-colors shadow-inner"
                                                                            value={contestAssignments[contestName]?.[pos] || 'null'}
                                                                            onChange={(e) => {
                                                                                const newAssignments = {
                                                                                    ...contestAssignments,
                                                                                    [contestName]: {
                                                                                        ...(contestAssignments[contestName] || {}),
                                                                                        [pos]: e.target.value
                                                                                    }
                                                                                };
                                                                                setContestAssignments(newAssignments);
                                                                                const syncData = JSON.stringify({ timeLeft, globalTime: globalTimer, timerActive, updatedAt: Date.now(), phaseTimers, contestAssignments: newAssignments });
                                                                                setGame((prev: any) => ({ ...prev, active_contest: syncData }));
                                                                                supabase.from('games').update({ active_contest: syncData }).eq('id', gameId);
                                                                            }}
                                                                        >
                                                                            <option value="null">-- SÉLECTIONNER UNE BRIGADE --</option>
                                                                            {brigades.map(b => (
                                                                                <option key={b.id} value={b.id}>{b.name}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        className="w-full font-mono text-sm h-12 bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_-3px_rgba(147,51,234,0.6)] transition-all active:scale-95"
                                                        onClick={() => handleValidateContest(contestName)}
                                                    >
                                                        <CheckCircle2 className="w-5 h-5 mr-3" />
                                                        VALIDER LES VICTOIRES
                                                    </Button>
                                                </div>
                                            ))}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}
                </TabsContent>

                {/* PLAYER MANAGEMENT TAB */}
                <TabsContent value="players" className="space-y-6 flex-1">
                    <Card className="glass-panel border-white/10 bg-background/50 h-full min-h-[500px] flex flex-col">
                        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-white/5">
                            <div>
                                <CardTitle className="font-mono text-lg flex items-center gap-2">
                                    <Users className="w-5 h-5 text-purple-400" />
                                    PLAYER_DIRECTORY
                                </CardTitle>
                                <CardDescription className="font-mono text-xs">Assign roles and re-allocate players if necessary.</CardDescription>
                            </div>
                            <div className="p-2 bg-white/5 rounded border border-white/10 flex items-center gap-3 font-mono text-xs">
                                <span className="text-muted-foreground">TOTAL PLAYERS:</span>
                                <span className="font-bold text-white text-base">{players.length}</span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-auto">
                            <Table>
                                <TableHeader className="bg-white/5 sticky top-0 z-10 backdrop-blur-md">
                                    <TableRow className="border-white/10 hover:bg-transparent">
                                        <TableHead className="font-mono text-primary">PLAYER_NAME</TableHead>
                                        <TableHead className="font-mono text-primary w-1/4">BRIGADE_ASSIGNMENT</TableHead>
                                        <TableHead className="font-mono text-primary w-1/4">ROLE_ASSIGNMENT</TableHead>
                                        <TableHead className="font-mono text-primary w-32 text-center">STATUS</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {players.map((p) => {
                                        return (
                                            <TableRow key={p.id} className="border-white/10 hover:bg-white/5 group">
                                                <TableCell className="font-bold cursor-pointer">
                                                    {p.name}
                                                </TableCell>
                                                <TableCell>
                                                    <select
                                                        className="h-8 w-full bg-black/40 border border-white/10 rounded px-2 font-mono text-xs text-white uppercase focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-colors"
                                                        value={p.brigade_id || ''}
                                                        onChange={(e) => handlePlayerUpdate(p.id, 'brigade_id', e.target.value)}
                                                    >
                                                        <option value="null">-- NO BRIGADE --</option>
                                                        {brigades.map(b => (
                                                            <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                                                        ))}
                                                    </select>
                                                </TableCell>
                                                <TableCell>
                                                    <select
                                                        className="h-8 w-full bg-black/40 border border-white/10 rounded px-2 font-mono text-xs text-white uppercase focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-colors"
                                                        value={p.role || 'null'}
                                                        onChange={(e) => handlePlayerUpdate(p.id, 'role', e.target.value)}
                                                    >
                                                        <option value="null">-- UNASSIGNED --</option>
                                                        {catalogRoles.map(r => (
                                                            <option key={r.id} value={r.title}>{r.title}</option>
                                                        ))}
                                                        {/* Fallback string roles if catalog doesn't cover everything yet */}
                                                        {!catalogRoles.some(r => r.title === p.role) && p.role && (
                                                            <option value={p.role}>{p.role} (Legacy)</option>
                                                        )}
                                                    </select>
                                                </TableCell>
                                                <TableCell className="text-center font-mono text-xs">
                                                    {p.role_used ? (
                                                        <Badge variant="destructive" className="bg-red-500/20 text-red-500 border-red-500/50">POWER_USED</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-green-500 border-green-500/50 bg-green-500/10">READY</Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                    {players.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-12 text-muted-foreground font-mono">
                                                NO_PLAYERS_REGISTERED_YET
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
