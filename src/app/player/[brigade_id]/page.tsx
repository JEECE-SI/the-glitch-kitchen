"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Lock, FileText, Database, Shield, Zap, Terminal, Activity, ListOrdered, Users } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";

export default function PlayerDashboard() {
    const params = useParams();
    const brigadeId = params.brigade_id as string;
    const [activeTab, setActiveTab] = useState("intel");
    const [players, setPlayers] = useState<any[]>([]);
    const [gameId, setGameId] = useState<string | null>(null);
    const [brigadeName, setBrigadeName] = useState("");
    const [brigadeDbId, setBrigadeDbId] = useState("");
    const [staffCode, setStaffCode] = useState<string | null>(null);

    const [gameState, setGameState] = useState<any>(null);
    const [cycleTimer, setCycleTimer] = useState(0);
    const [globalTimer, setGlobalTimer] = useState(0);
    const [phaseName, setPhaseName] = useState("EN ATTENTE");
    const [currentCycle, setCurrentCycle] = useState(1);
    const [isTimerRunning, setIsTimerRunning] = useState(false);

    const [gameLogs, setGameLogs] = useState<any[]>([]);
    const [inventory, setInventory] = useState<any[]>([]);
    const [decryptInput, setDecryptInput] = useState("");
    const [isDecrypting, setIsDecrypting] = useState(false);
    const [selectedFragment, setSelectedFragment] = useState<any | null>(null);

    useEffect(() => {
        const fetchInitialData = async () => {
            const { data: brigadeData } = await supabase.from('brigades').select('*').eq('code', brigadeId).single();
            if (brigadeData) {
                setGameId(brigadeData.game_id);
                setBrigadeName(brigadeData.name);
                setBrigadeDbId(brigadeData.id);

                const { data: gData } = await supabase.from('games').select('*').eq('id', brigadeData.game_id).single();
                if (gData) setGameState(gData);

                const { data: playersData } = await supabase.from('players').select('*').eq('brigade_id', brigadeData.id);
                if (playersData) setPlayers(playersData);

                const { data: logsData } = await supabase.from('game_logs').select('*').eq('game_id', brigadeData.game_id).order('created_at', { ascending: false });
                if (logsData) setGameLogs(logsData);

                const { data: staffData } = await supabase.from('staff').select('code').eq('game_id', brigadeData.game_id).single();
                if (staffData) setStaffCode(staffData.code);

                const { data: invData } = await supabase.from('inventory').select('*').eq('brigade_id', brigadeData.id).order('slot_index', { ascending: true });
                if (invData) setInventory(invData);
            }
        };
        fetchInitialData();
    }, [brigadeId]);

    useEffect(() => {
        if (!gameId) return;
        const logsSub = supabase.channel('public:game_logs').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_logs', filter: `game_id=eq.${gameId}` }, (payload) => {
            setGameLogs((prev) => [payload.new, ...prev]);
        }).subscribe();

        const gameSub = supabase.channel('public:games').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
            setGameState(payload.new);
        }).subscribe();

        if (!brigadeDbId) return;
        const invSub = supabase.channel('public:inventory').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inventory', filter: `brigade_id=eq.${brigadeDbId}` }, (payload) => {
            setInventory((prev) => prev.map(item => item.id === payload.new.id ? payload.new : item));
        }).subscribe();

        return () => {
            supabase.removeChannel(logsSub);
            supabase.removeChannel(gameSub);
            supabase.removeChannel(invSub);
        };
    }, [gameId, brigadeDbId]);

    useEffect(() => {
        if (!gameState) return;

        // Parse status to get cycle and phase
        const parts = gameState.status.split('_c');
        if (parts.length > 1) {
            setCurrentCycle(parseInt(parts[1]));
            switch (parts[0]) {
                case 'annonce': setPhaseName('ANNONCE & DISPATCH'); break;
                case 'contests': setPhaseName('CONTESTS'); break;
                case 'temps_libre': setPhaseName('TEMPS LIBRE'); break;
                default: setPhaseName('EN ATTENTE');
            }
        } else {
            setPhaseName(gameState.status.toUpperCase());
        }

        // Parse timer
        if (gameState.active_contest) {
            try {
                const timerData = JSON.parse(gameState.active_contest);
                setIsTimerRunning(timerData.timerActive);
                if (timerData.timerActive && timerData.updatedAt) {
                    const elapsedSinceUpdate = Math.floor((Date.now() - timerData.updatedAt) / 1000);
                    setCycleTimer(Math.max(0, timerData.timeLeft - elapsedSinceUpdate));
                    setGlobalTimer((timerData.globalTime || 0) + elapsedSinceUpdate);
                } else {
                    setCycleTimer(timerData.timeLeft);
                    setGlobalTimer(timerData.globalTime || 0);
                }
            } catch (e) { }
        } else {
            setCycleTimer(0);
            setIsTimerRunning(false);
            setGlobalTimer(0);
        }
    }, [gameState]);

    useEffect(() => {
        if (!isTimerRunning) return;
        const interval = setInterval(() => {
            setCycleTimer(prev => Math.max(0, prev - 1));
            setGlobalTimer(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [isTimerRunning]);

    const formatTime = (secs: number) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
    };

    const handleDecrypt = async () => {
        if (!decryptInput.trim() || !brigadeDbId || !gameId) return;
        setIsDecrypting(true);
        try {
            const fragId = decryptInput.trim().toUpperCase();

            // Check if already in inventory
            if (inventory.some(slot => slot.fragment_data === fragId)) {
                alert("Fragment déjà déchiffré par votre brigade !");
                return;
            }

            // Verify fragment in catalog
            const { data: fragData, error: fragError } = await supabase.from('catalog_fragments').select('*').ilike('fragment_id', fragId).single();
            if (fragError || !fragData) {
                alert("Erreur de décryptage : Code fragment incorrect, ou bien la base de données n'est pas à jour.");
                console.error(fragError);
                return;
            }

            // Find empty slot
            const emptySlot = inventory.find(slot => slot.fragment_data === null || slot.fragment_data === "");
            if (!emptySlot) {
                alert("Inventaire plein ! Impossible d'ajouter de nouveaux fragments.");
                return;
            }

            // Update inventory
            await supabase.from('inventory').update({ fragment_data: fragData.fragment_id }).eq('id', emptySlot.id);

            // Log fragment unlocked
            await supabase.from('game_logs').insert({
                game_id: gameId,
                brigade_id: brigadeDbId,
                event_type: 'fragment_unlocked',
                message: `La ${brigadeName} a réussi à décrypter le fragment [${fragData.fragment_id}] !`
            });

            // If it's a contest win
            if (fragData.contest && fragData.position && fragData.contest !== '-' && fragData.position !== '-') {
                await supabase.from('game_logs').insert({
                    game_id: gameId,
                    brigade_id: brigadeDbId,
                    event_type: 'contest_won',
                    message: `🏆 CONTEST ${fragData.contest} : La ${brigadeName} s'empare de la position ${fragData.position} !`
                });
            }

            setDecryptInput("");
        } catch (error: any) {
            console.error(error);
            alert("Une erreur technique est survenue : " + error.message);
        } finally {
            setIsDecrypting(false);
        }
    };

    const handleFragmentClick = async (fragmentId: string) => {
        if (!fragmentId) return;
        const { data } = await supabase.from('catalog_fragments').select('*').eq('fragment_id', fragmentId).single();
        if (data) {
            setSelectedFragment(data);
        }
    };

    // State for the recipe notebook
    const [recipeSteps, setRecipeSteps] = useState<{ fragments: string; ingredient: string; technique: string; tool: string; notes: string }[]>(
        Array.from({ length: 10 }, () => ({ fragments: "", ingredient: "", technique: "", tool: "", notes: "" }))
    );

    const updateRecipeStep = (index: number, field: keyof typeof recipeSteps[0], value: string) => {
        const newSteps = [...recipeSteps];
        newSteps[index] = { ...newSteps[index], [field]: value };
        setRecipeSteps(newSteps);
    };

    return (
        <div className="min-h-screen flex flex-col p-4 md:p-8 bg-background relative overflow-hidden">
            {/* Background glitch effect */}
            <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-primary/5 rounded-full blur-3xl -z-10" />
            <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-secondary/5 rounded-full blur-3xl -z-10" />

            {/* Header Info */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-4 border-b border-white/5 mb-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-widest font-mono text-transparent bg-clip-text bg-gradient-to-r from-white to-white/50 border-l-4 border-primary pl-4">
                        BRIGADE_{brigadeId}
                    </h1>
                    <p className="text-muted-foreground font-mono text-xs md:text-sm mt-1 pl-5 flex items-center gap-2">
                        <Activity className="w-3 h-3 text-green-500" />
                        SECURE_CONNECTION
                        {staffCode && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded font-bold">
                                STAFF: {staffCode}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex gap-2 w-full md:w-auto mt-4 md:mt-0">
                    <Input
                        placeholder="CODE FRAGMENT..."
                        value={decryptInput}
                        onChange={e => setDecryptInput(e.target.value)}
                        className="bg-white/5 border-secondary/20 font-mono text-secondary uppercase w-48"
                    />
                    <Button
                        onClick={handleDecrypt}
                        disabled={isDecrypting || !decryptInput}
                        className="bg-secondary hover:bg-secondary/80 text-secondary-foreground font-mono"
                    >
                        {isDecrypting ? "..." : "DECRYPT"}
                    </Button>
                </div>

                <div className="flex gap-2 mt-4 md:mt-0 w-full md:w-auto justify-end">
                    <Card className="bg-white/5 border-primary/20">
                        <CardContent className="p-3 flex flex-col items-center justify-center min-w-[100px]">
                            <span className="text-[10px] text-primary font-mono font-bold mb-1">PRESTIGE</span>
                            <span className="text-2xl font-black font-mono">100</span>
                        </CardContent>
                    </Card>
                    <Card className="bg-white/5 border-secondary/20">
                        <CardContent className="p-3 flex flex-col items-center justify-center min-w-[100px]">
                            <span className="text-[10px] text-secondary font-mono font-bold mb-1">FRAGMENTS</span>
                            <span className="text-2xl font-black font-mono">{inventory.filter(s => s.fragment_data).length}<span className="text-muted-foreground text-sm">/15</span></span>
                        </CardContent>
                    </Card>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 max-w-6xl mx-auto w-full">
                <Tabs defaultValue="intel" onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-4 bg-white/5 border border-white/10 p-1 rounded-xl">
                        <TabsTrigger value="intel" className="font-mono text-xs md:text-sm data-[state=active]:bg-primary/20 glass-panel">INTEL_FEED</TabsTrigger>
                        <TabsTrigger value="recipe" className="font-mono text-xs md:text-sm data-[state=active]:bg-green-500/20 glass-panel">RECIPE_ASSEMBLY</TabsTrigger>
                        <TabsTrigger value="contests" className="font-mono text-xs md:text-sm data-[state=active]:bg-primary/20 glass-panel">ACTIVE_CONTESTS</TabsTrigger>
                        <TabsTrigger value="roster" className="font-mono text-xs md:text-sm data-[state=active]:bg-secondary/20 glass-panel">BRIGADE_ROSTER</TabsTrigger>
                    </TabsList>

                    <TabsContent value="intel" className="space-y-6">
                        {/* CURRENT GAME STATUS WIDGET */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col justify-center items-center">
                                <span className="text-[10px] text-muted-foreground font-mono font-bold mb-1">CYCLE EN COURS</span>
                                <span className="text-xl font-black font-mono text-white">CYCLE {currentCycle}/4</span>
                            </div>
                            <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col justify-center items-center">
                                <span className="text-[10px] text-muted-foreground font-mono font-bold mb-1">ÉTAPE</span>
                                <span className="text-sm font-black font-mono text-primary text-center">{phaseName}</span>
                            </div>
                            <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col justify-center items-center">
                                <span className="text-[10px] text-muted-foreground font-mono font-bold mb-1">TIMER CYCLE</span>
                                <span className={`text-2xl font-black font-mono ${cycleTimer <= 60 && isTimerRunning && cycleTimer > 0 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                                    {formatTime(cycleTimer)}
                                </span>
                            </div>
                            <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col justify-center items-center flex-1">
                                <span className="text-[10px] text-muted-foreground font-mono font-bold mb-1">TIMER GLOBAL</span>
                                <span className="text-xl font-black font-mono text-white/70">
                                    {formatTime(globalTimer)}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="glass-panel border-white/10 bg-background/50 h-[400px] flex flex-col lg:col-span-2">
                                <CardHeader className="border-b border-white/5 pb-4">
                                    <CardTitle className="font-mono text-lg flex items-center gap-2">
                                        <Terminal className="w-5 h-5 text-secondary" />
                                        SYSTEM_BROADCAST
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-auto p-4 space-y-4 font-mono text-sm">
                                    {gameLogs.map(log => (
                                        <div key={log.id} className={`border-l-2 pl-3 ${log.event_type === 'contest_won' ? 'border-yellow-500 text-yellow-500 font-bold' : log.event_type === 'fragment_unlocked' ? 'border-secondary text-secondary/90' : 'border-primary'}`}>
                                            <span className="text-xs text-muted-foreground block mb-1">
                                                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                            <span>{log.message}</span>
                                        </div>
                                    ))}
                                    {gameLogs.length === 0 && (
                                        <div className="border-l-2 border-primary pl-3">
                                            <span className="text-xs text-muted-foreground block mb-1">System init</span>
                                            <span className="text-white">Awaiting GM instruction to initiate operations...</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="glass-panel border-white/10 bg-background/50 h-[400px] flex flex-col">
                                <CardHeader className="border-b border-white/5 pb-4">
                                    <CardTitle className="font-mono text-lg flex items-center gap-2 text-primary">
                                        <Shield className="w-5 h-5" />
                                        BRIGADE_STATUS
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-auto p-4">
                                    <div className="flex flex-col gap-4 font-mono text-sm">
                                        <div className="flex items-center justify-between p-3 rounded bg-white/5 border border-white/5">
                                            <span className="text-muted-foreground">NETWORK_LINK</span>
                                            <span className="text-green-400">SECURE</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 rounded bg-white/5 border border-white/5">
                                            <span className="text-muted-foreground">DB_ENCRYPTION</span>
                                            <span className="text-green-400">ACTIVE</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 rounded bg-white/5 border border-white/5">
                                            <span className="text-muted-foreground">SYSTEM_INTEGRITY</span>
                                            <span className="text-primary">99.9%</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 rounded bg-white/5 border border-white/5">
                                            <span className="text-muted-foreground">ROLE_ASSIGNMENT</span>
                                            <Badge variant="outline" className="text-primary border-primary">PENDING...</Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="recipe" className="space-y-4">
                        <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-4">
                            <div>
                                <h2 className="text-xl font-bold font-mono text-white flex items-center gap-2">
                                    <ListOrdered className="w-5 h-5 text-green-500" />
                                    RECIPE_ASSEMBLY_LAB
                                </h2>
                                <p className="text-xs text-muted-foreground font-mono mt-1">Drag and drop fragments to assign them to recipe steps.</p>
                            </div>
                            <Button variant="outline" size="sm" className="font-mono text-xs h-8" disabled>
                                SUBMIT_FINAL_RECIPE
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                            {/* Left Panel: Inventory (1/3) */}
                            <Card className="glass-panel border-white/10 lg:col-span-1 sticky top-4">
                                <CardHeader className="py-4 border-b border-white/5">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="font-mono text-secondary text-base flex items-center gap-2">
                                            <Database className="w-4 h-4" />
                                            FRAGMENTS DECRYPTED
                                        </CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <div className="grid grid-cols-3 gap-3">
                                        {inventory.map((slot, i) => (
                                            <div
                                                key={slot.id}
                                                draggable={!!slot.fragment_data}
                                                onDragStart={(e) => {
                                                    if (slot.fragment_data) {
                                                        e.dataTransfer.setData("text/plain", `${slot.fragment_data}`);
                                                    }
                                                }}
                                                onClick={() => handleFragmentClick(slot.fragment_data)}
                                                className={`aspect-square rounded border flex flex-col items-center justify-center p-2 relative group transition-colors ${slot.fragment_data ? 'border-secondary/50 bg-secondary/10 hover:bg-secondary/30 cursor-pointer active:cursor-grabbing' : 'border-white/5 bg-white/5 opacity-50'}`}
                                                title={slot.fragment_data ? "View details or drag me" : "Empty Slot"}
                                            >
                                                <FileText className={`w-5 h-5 mb-1 transition-colors pointer-events-none ${slot.fragment_data ? 'text-secondary group-hover:text-white' : 'text-white/20'}`} />
                                                <span className={`font-mono text-[10px] font-bold pointer-events-none ${slot.fragment_data ? 'text-secondary/90' : 'text-white/20'}`}>
                                                    {slot.fragment_data || `#${i + 1}`}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-4 font-mono text-center">Drag a fragment to assign it to a step.</p>
                                </CardContent>
                            </Card>

                            {/* Right Panel: Recipe Assembly (2/3) */}
                            <Card className="glass-panel border-white/10 lg:col-span-2">
                                <CardContent className="p-0">
                                    <Accordion type="single" collapsible className="w-full">
                                        {recipeSteps.map((step, index) => (
                                            <AccordionItem value={`step-${index + 1}`} key={index} className="border-b border-white/5 px-2 md:px-4">
                                                <div
                                                    onDragOver={(e) => {
                                                        e.preventDefault();
                                                        e.currentTarget.classList.add('bg-green-500/10');
                                                    }}
                                                    onDragLeave={(e) => {
                                                        e.currentTarget.classList.remove('bg-green-500/10');
                                                    }}
                                                    onDrop={(e) => {
                                                        e.preventDefault();
                                                        e.currentTarget.classList.remove('bg-green-500/10');
                                                        const fragData = e.dataTransfer.getData("text/plain");
                                                        if (fragData) {
                                                            const current = recipeSteps[index].fragments;
                                                            // Avoid simple duplicates
                                                            const newVal = current ? (current.includes(fragData) ? current : `${current}, ${fragData}`) : fragData;
                                                            updateRecipeStep(index, "fragments", newVal);
                                                        }
                                                    }}
                                                    className="transition-colors rounded-lg overflow-hidden my-1"
                                                >
                                                    <AccordionTrigger className="font-mono hover:text-green-400 hover:no-underline py-3 px-2">
                                                        <div className="flex items-center gap-4 text-left w-full pr-4">
                                                            <span className="whitespace-nowrap text-green-500">STEP_{String(index + 1).padStart(2, '0')}</span>
                                                            <div className="flex flex-1 gap-2 text-[10px] md:text-xs text-muted-foreground font-sans font-normal truncate overflow-hidden">
                                                                {step.ingredient && <span className="bg-primary/20 text-primary px-2 py-0.5 rounded truncate">{step.ingredient}</span>}
                                                                {step.technique && <span className="bg-white/10 text-white/80 px-2 py-0.5 rounded truncate">{step.technique}</span>}
                                                                {step.fragments && <span className="bg-secondary/20 text-secondary px-2 py-0.5 rounded shrink-0">[{step.fragments}]</span>}
                                                            </div>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="space-y-4 pt-2 pb-6 px-2">
                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                            <div className="space-y-2 lg:col-span-1 border-r border-white/5 md:pr-4">
                                                                <Label className="text-white font-mono text-[10px] uppercase text-secondary">Frags Assignés</Label>
                                                                <div className="relative">
                                                                    <Input
                                                                        placeholder="Drop ici ou #3..."
                                                                        className="bg-background/50 border-white/10 font-mono text-xs uppercase text-white h-8 w-full"
                                                                        value={step.fragments}
                                                                        onChange={(e) => updateRecipeStep(index, "fragments", e.target.value)}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2 md:col-span-3">
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                    <div className="space-y-2">
                                                                        <Label className="text-white font-mono text-[10px] uppercase">Ingrédient(s)</Label>
                                                                        <Input
                                                                            placeholder="ex: Farine + beurre..."
                                                                            className="bg-background/50 border-white/10 font-sans text-xs text-white h-8"
                                                                            value={step.ingredient}
                                                                            onChange={(e) => updateRecipeStep(index, "ingredient", e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-white font-mono text-[10px] uppercase">Technique</Label>
                                                                        <Input
                                                                            placeholder="ex: Sabler délicatement..."
                                                                            className="bg-background/50 border-white/10 font-sans text-xs text-white h-8"
                                                                            value={step.technique}
                                                                            onChange={(e) => updateRecipeStep(index, "technique", e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-white font-mono text-[10px] uppercase">Outil(s)</Label>
                                                                        <Input
                                                                            placeholder="ex: Corne..."
                                                                            className="bg-background/50 border-white/10 font-sans text-xs text-white h-8"
                                                                            value={step.tool}
                                                                            onChange={(e) => updateRecipeStep(index, "tool", e.target.value)}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-2 pt-2">
                                                                    <Label className="text-white font-mono text-[10px] uppercase text-muted-foreground">Notes de déduction</Label>
                                                                    <textarea
                                                                        className="flex min-h-[60px] w-full rounded-md border border-white/10 bg-background/50 px-3 py-2 text-xs text-white placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 font-sans"
                                                                        placeholder="Observations, doutes..."
                                                                        value={step.notes}
                                                                        onChange={(e) => updateRecipeStep(index, "notes", e.target.value)}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </AccordionContent>
                                                </div>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="contests">
                        <div className="flex flex-col items-center justify-center h-64 border border-white/10 rounded-lg glass-panel">
                            <Zap className="w-12 h-12 text-primary mb-4 opacity-50" />
                            <p className="font-mono text-muted-foreground text-center">
                                NO_ACTIVE_CONTESTS_DETECTED<br />
                                <span className="text-xs">Awaiting broadcast from GM_TERMINAL</span>
                            </p>
                        </div>
                    </TabsContent>

                    <TabsContent value="roster" className="space-y-6">
                        <Card className="glass-panel border-secondary/30">
                            <CardHeader>
                                <CardTitle className="font-mono text-secondary flex items-center gap-2">
                                    <Users className="w-5 h-5" />
                                    BRIGADE_ROSTER
                                </CardTitle>
                                <CardDescription>
                                    List of detected personnel and assigned capability matrix.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {players.map((p, i) => (
                                        <div key={i} className="bg-white/5 border border-white/10 p-4 rounded flex flex-col items-center justify-center relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 w-16 h-16 bg-secondary/10 rounded-bl-full -z-10 group-hover:bg-secondary/20 transition-colors" />
                                            <Shield className="w-8 h-8 text-secondary/50 mb-3" />
                                            <span className="font-bold text-white mb-1 text-center">{p.name}</span>
                                            <span className="font-mono text-xs text-primary/80 text-center">{p.role || "UNASSIGNED"}</span>
                                            {p.role_used && <Badge variant="destructive" className="mt-2 text-[10px] font-mono">CAPABILITY_EXHAUSTED</Badge>}
                                        </div>
                                    ))}
                                    {players.length === 0 && (
                                        <div className="col-span-full flex flex-col items-center justify-center p-8 border border-dashed border-white/10 rounded">
                                            <span className="font-mono md:text-lg text-muted-foreground">NO_PERSONNEL_DETECTED</span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Fragment Details Popup */}
            {selectedFragment && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <Card className="glass-panel border-secondary/50 w-full max-w-md bg-background/95">
                        <CardHeader className="border-b border-secondary/20 bg-secondary/10">
                            <CardTitle className="font-mono flex items-center gap-2 text-secondary">
                                <FileText className="w-5 h-5" />
                                FRAGMENT_{selectedFragment.fragment_id}
                            </CardTitle>
                            <CardDescription className="text-white/70">
                                {selectedFragment.is_coded ? "DECODED DATA" : "CLEAR DATA"} | Niveau {selectedFragment.level}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div>
                                <h4 className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Raw Intel</h4>
                                <div className="bg-white/5 p-3 rounded border border-white/10 font-mono text-sm text-white/80 italic">
                                    "{selectedFragment.content}"
                                </div>
                            </div>
                            {selectedFragment.contest !== '-' && (
                                <div className="flex gap-2">
                                    <Badge className="bg-yellow-500/20 text-yellow-500 border border-yellow-500/50">CONTEST {selectedFragment.contest}</Badge>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="bg-white/5 border-t border-white/10 p-4 flex justify-end">
                            <Button variant="outline" onClick={() => setSelectedFragment(null)} className="font-mono bg-transparent">
                                CLOSE_INSPECTOR
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )}
        </div>
    );
}
