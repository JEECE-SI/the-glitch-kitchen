"use client";

import { useState, useEffect } from "react";
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
    const [globalTimer, setGlobalTimer] = useState(0);
    const [phaseTimers, setPhaseTimers] = useState<{ [key: string]: number }>({});
    const [cycleContests, setCycleContests] = useState<Record<string, any[]>>({});
    const [contestAssignments, setContestAssignments] = useState<Record<string, Record<string, string>>>({});

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

                // Restore Timers from active_contest if exists
                if (gameData.active_contest) {
                    try {
                        const tc = JSON.parse(gameData.active_contest);
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
                    } catch (e) { }
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

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (timerActive) {
            interval = setInterval(() => {
                setTimeLeft(prev => Math.max(0, prev - 1));
                setGlobalTimer(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [timerActive]);

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

    useEffect(() => {
        if (timeLeft === 0 && timerActive) {
            setTimerActive(false);
            const updatedPhaseTimers = { ...phaseTimers };
            if (currentPhase !== 'setup' && currentPhase !== 'finished') {
                updatedPhaseTimers[currentPhase] = 0;
            }
            setPhaseTimers(updatedPhaseTimers);
            const syncData = JSON.stringify({ timeLeft: 0, globalTime: globalTimer, timerActive: false, updatedAt: Date.now(), phaseTimers: updatedPhaseTimers });
            setGame((prev: any) => ({ ...prev, active_contest: syncData }));
            supabase.from('games').update({ active_contest: syncData }).eq('id', gameId);
        }
    }, [timeLeft, timerActive, globalTimer, gameId, phaseTimers, currentPhase]);

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
        for (const [pos, brigadeId] of Object.entries(assignments)) {
            if (!brigadeId || brigadeId === 'null') continue;

            const frag = cycleContests[contestName]?.find(f => f.position === pos);
            if (!frag) continue;

            const { data: inv } = await supabase.from('inventory').select('*').eq('brigade_id', brigadeId);
            if (inv && inv.length > 0) {
                const alreadyHas = inv.some((slot: any) => slot.fragment_data === frag.fragment_id);
                if (!alreadyHas) {
                    const emptySlot = inv.find((slot: any) => !slot.fragment_data);
                    if (emptySlot) {
                        await supabase.from('inventory').update({ fragment_data: frag.fragment_id }).eq('id', emptySlot.id);
                        const brigade = brigades.find(b => b.id === brigadeId);
                        await supabase.from('game_logs').insert({
                            game_id: gameId,
                            brigade_id: brigadeId,
                            event_type: 'contest_won',
                            message: `🏆 CONTEST ${contestName} : La ${brigade?.name || 'Brigade'} s'empare de la position ${pos}! Fragment [${frag.fragment_id}] débloqué.`
                        });
                        anyAssigned = true;
                    }
                }
            }
        }

        if (anyAssigned) {
            alert(`Succès! Les victoires ont été validées pour le Contest ${contestName}. Les fragments correspondants font dorénavant partie de l'inventaire des brigades.`);
        } else {
            alert(`Aucun fragment n'a été distribué. Soit aucune brigade n'est sélectionnée, soit elles ont déjà ce fragment, soit leur inventaire est plein.`);
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
        'annonce': { title: "ANNONCE & DISPATCH", time: (game?.settings?.annonce || 4) * M_TO_S, desc: "Annonce des 4 Contests. Les brigades répartissent leurs cibles." },
        'contests': { title: "CONTESTS", time: (game?.settings?.contests || 7) * M_TO_S, desc: "Mini-jeux simultanés. Résolution des épreuves." },
        'temps_libre': { title: "TEMPS LIBRE", time: (game?.settings?.temps_libre || 9) * M_TO_S, desc: "Déchiffrement, Office, Comptoir, Espionnage et Débrief." }
    };

    const startPhase = async (phase: 'annonce' | 'contests' | 'temps_libre') => {
        const updatedPhaseTimers = { ...phaseTimers };
        if (currentPhase !== 'setup' && currentPhase !== 'finished') {
            updatedPhaseTimers[currentPhase] = timeLeft;
        }

        const t = updatedPhaseTimers[phase] !== undefined ? updatedPhaseTimers[phase] : PHASE_CONFIG[phase].time;

        setCurrentPhase(phase);
        setTimeLeft(t);
        setPhaseTimers(updatedPhaseTimers);
        setTimerActive(true);

        const syncData = JSON.stringify({ timeLeft: t, globalTime: globalTimer, timerActive: true, updatedAt: Date.now(), phaseTimers: updatedPhaseTimers });
        // Broadcast phase and timer state to the database
        setGame((prev: any) => ({ ...prev, status: `${phase}_c${currentCycle}`, active_contest: syncData }));
        await supabase.from('games').update({ status: `${phase}_c${currentCycle}`, active_contest: syncData }).eq('id', gameId);
    };

    const startGame = async () => {
        setGame((prev: any) => ({ ...prev, status: 'active' }));
        await supabase.from('games').update({ status: 'active' }).eq('id', gameId);
    };

    const toggleTimer = async () => {
        const newState = !timerActive;
        setTimerActive(newState);

        const updatedPhaseTimers = { ...phaseTimers };
        if (currentPhase !== 'setup' && currentPhase !== 'finished') {
            updatedPhaseTimers[currentPhase] = timeLeft;
            setPhaseTimers(updatedPhaseTimers);
        }

        const syncData = JSON.stringify({ timeLeft: timeLeft, globalTime: globalTimer, timerActive: newState, updatedAt: Date.now(), phaseTimers: updatedPhaseTimers });
        setGame((prev: any) => ({ ...prev, active_contest: syncData }));
        await supabase.from('games').update({ active_contest: syncData }).eq('id', gameId);
    };

    const adjustTime = async (seconds: number) => {
        const newTime = Math.max(0, timeLeft + seconds);
        setTimeLeft(newTime);

        const updatedPhaseTimers = { ...phaseTimers };
        if (currentPhase !== 'setup' && currentPhase !== 'finished') {
            updatedPhaseTimers[currentPhase] = newTime;
            setPhaseTimers(updatedPhaseTimers);
        }

        const syncData = JSON.stringify({ timeLeft: newTime, globalTime: globalTimer, timerActive, updatedAt: Date.now(), phaseTimers: updatedPhaseTimers });
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

        const syncData = JSON.stringify({ timeLeft: t, globalTime: newGlobalTimer, timerActive: false, updatedAt: Date.now(), phaseTimers: updatedPhaseTimers });
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
        } else {
            setCurrentPhase('finished');
            setGame((prev: any) => ({ ...prev, status: 'finished' }));
            await supabase.from('games').update({ status: 'finished' }).eq('id', gameId);
        }
    };

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    if (!game) return <div className="p-8 text-white font-mono flex items-center gap-4"><Activity className="animate-spin" /> ACCÈS STAFF EN COURS...</div>;

    const cycleMins = (game?.settings?.annonce || 4) + (game?.settings?.contests || 7) + (game?.settings?.temps_libre || 9);
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

                                {/* PHASE INFO & ACTIONS */}
                                <div className="space-y-6">
                                    {currentPhase === 'contests' && Object.keys(cycleContests).length > 0 && (
                                        <Card className="glass-panel border-white/10 bg-background/50">
                                            <CardHeader className="border-b border-white/5 pb-4">
                                                <CardTitle className="font-mono text-xl flex items-center gap-2 text-purple-400">
                                                    <Trophy className="w-5 h-5" />
                                                    DÉCISION DES CONTESTS
                                                </CardTitle>
                                                <CardDescription className="font-mono text-xs">Attribuez les brigades gagnantes pour chaque Contest du cycle actuel. Cela débloquera directement leurs fragments associés.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                                {Object.entries(cycleContests)
                                                    .sort(([a], [b]) => a.localeCompare(b))
                                                    .slice(0, 4)
                                                    .map(([contestName, fragments]) => (
                                                        <div key={contestName} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between hover:bg-white/10 transition-colors">
                                                            <div>
                                                                <h3 className="font-mono font-bold text-white mb-4 flex items-center justify-between">
                                                                    <span className="bg-purple-500/20 shadow-[0_0_15px_-3px_rgba(147,51,234,0.4)] text-purple-400 px-3 py-1 rounded text-sm tracking-wider w-full text-center">CONTEST {contestName}</span>
                                                                </h3>
                                                                <div className="space-y-3 mb-4">
                                                                    {['1er', '2e', '3e'].map(pos => {
                                                                        const frag = fragments.find(f => f.position === pos);
                                                                        if (!frag) return null;
                                                                        return (
                                                                            <div key={pos} className="flex flex-col gap-1">
                                                                                <span className="font-mono text-[10px] text-muted-foreground uppercase">{pos} <span className="text-white/30 text-[8px]">({frag.fragment_id})</span></span>
                                                                                <select
                                                                                    className="h-9 w-full bg-black/40 border border-white/10 rounded px-2 font-mono text-xs text-white uppercase focus:border-purple-500 outline-none transition-colors"
                                                                                    value={contestAssignments[contestName]?.[pos] || 'null'}
                                                                                    onChange={(e) => setContestAssignments(prev => ({
                                                                                        ...prev,
                                                                                        [contestName]: {
                                                                                            ...(prev[contestName] || {}),
                                                                                            [pos]: e.target.value
                                                                                        }
                                                                                    }))}
                                                                                >
                                                                                    <option value="null">-- BRIGADE --</option>
                                                                                    {brigades.map(b => (
                                                                                        <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                            <Button
                                                                className="w-full font-mono text-xs bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_-3px_rgba(147,51,234,0.4)] transition-all active:scale-95"
                                                                onClick={() => handleValidateContest(contestName)}
                                                            >
                                                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                                                VALIDER VICTOIRE
                                                            </Button>
                                                        </div>
                                                    ))}
                                            </CardContent>
                                        </Card>
                                    )}

                                    <Card className="glass-panel border-white/10 bg-background/50 h-full">
                                        <CardHeader>
                                            <CardTitle className="font-mono text-sm text-muted-foreground">PHASE_DIRECTIVES</CardTitle>
                                        </CardHeader>
                                        <CardContent className="font-mono text-sm space-y-4">
                                            {currentPhase === 'setup' && (
                                                <div className="text-white/60 text-center py-8">
                                                    Select a phase to begin Cycle {currentCycle}.
                                                </div>
                                            )}
                                            {currentPhase === 'annonce' && (
                                                <div className="space-y-4">
                                                    <p className="text-blue-400 font-bold">1. Affichez les 4 Contests à l'écran principal.</p>
                                                    <p>2. Laissez les brigades lire le Brief.</p>
                                                    <p>3. Les brigades dispatchent leurs représentants physiquement dans les salles.</p>
                                                    <Badge variant="outline" className="text-blue-400 border-blue-400/50 w-full justify-center mt-4">PRÉPARATION</Badge>
                                                </div>
                                            )}
                                            {currentPhase === 'contests' && (
                                                <div className="space-y-4">
                                                    <p className="text-purple-400 font-bold">1. Les Staffs locaux lancent les Contests.</p>
                                                    <p>2. Veillez au respect du temps.</p>
                                                    <p>3. Notez les brigades gagnantes dans le système (bientôt dispo).</p>
                                                    <Badge variant="outline" className="text-purple-400 border-purple-400/50 w-full justify-center mt-4">ACTION EN COURS</Badge>
                                                </div>
                                            )}
                                            {currentPhase === 'temps_libre' && (
                                                <div className="space-y-4">
                                                    <p className="text-green-400 font-bold">1. Les joueurs retournent au QG.</p>
                                                    <p>2. Ils déchiffrent au Labo, négocient à l'Office.</p>
                                                    <p>3. Débrief inter-brigades : "Quelle est la strat pour le prochain ?"</p>
                                                    <div className="bg-red-500/10 border border-red-500/30 p-3 rounded mt-4">
                                                        <p className="text-xs text-red-400 flex items-center gap-2 font-bold mb-1"><AlertTriangle className="w-3 h-3" /> GLITCH ALERT</p>
                                                        <p className="text-[10px] text-white/80">Des évènements imprévus peuvent se déclencher maintenant.</p>
                                                    </div>
                                                </div>
                                            )}
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
