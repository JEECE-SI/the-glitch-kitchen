"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Database, Plus, Settings, Users, Server, Trash2, Settings2, PlaySquare, Square } from "lucide-react";

export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("games");

    const [games, setGames] = useState<any[]>([]);
    const [brigades, setBrigades] = useState<any[]>([]);
    const [players, setPlayers] = useState<any[]>([]);

    const [isGameDialogOpen, setIsGameDialogOpen] = useState(false);
    const [newGameName, setNewGameName] = useState("");
    const [newBrigadeCount, setNewBrigadeCount] = useState(10);
    const [isDeploying, setIsDeploying] = useState(false);

    const [isBrigadeDialogOpen, setIsBrigadeDialogOpen] = useState(false);
    const [newBrigadeName, setNewBrigadeName] = useState("");
    const [selectedGameId, setSelectedGameId] = useState("");
    const [isCreatingBrigade, setIsCreatingBrigade] = useState(false);

    useEffect(() => {
        fetchGames();
        fetchBrigades();
        fetchPlayers();

        // Optional realtime updates
        const gamesSubscription = supabase
            .channel('public:games')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, fetchGames)
            .subscribe();

        return () => {
            supabase.removeChannel(gamesSubscription);
        };
    }, []);

    const fetchGames = async () => {
        const { data } = await supabase.from('games').select('*').order('created_at', { ascending: false });
        if (data) setGames(data);
    };

    const fetchBrigades = async () => {
        const { data } = await supabase.from('brigades').select('*').order('created_at', { ascending: false });
        if (data) setBrigades(data);
    };

    const fetchPlayers = async () => {
        const { data } = await supabase.from('players').select('*').order('created_at', { ascending: false });
        if (data) setPlayers(data);
    };

    const generateRandomCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    const deployInstance = async () => {
        if (!newGameName || newBrigadeCount <= 0) return;
        setIsDeploying(true);
        try {
            // 1. Create Game
            const { data: game, error: gameError } = await supabase
                .from('games')
                .insert({ name: newGameName, status: 'setup' })
                .select()
                .single();

            if (gameError) throw gameError;

            // 2. Generate Brigades
            const brigadesToInsert = [];
            const usedCodes = new Set();

            for (let i = 0; i < newBrigadeCount; i++) {
                let code;
                do {
                    code = generateRandomCode();
                } while (usedCodes.has(code));
                usedCodes.add(code);

                brigadesToInsert.push({
                    game_id: game.id,
                    code: code,
                    name: `Brigade ${i + 1}`
                });
            }

            const { error: brigadeError } = await supabase.from('brigades').insert(brigadesToInsert);
            if (brigadeError) throw brigadeError;

            setNewGameName("");
            setIsGameDialogOpen(false);
            fetchGames();
            fetchBrigades();
        } catch (error: any) {
            console.error(error);
            alert("Erreur lors de la création : " + error.message);
        } finally {
            setIsDeploying(false);
        }
    };

    const createSingleBrigade = async () => {
        if (!newBrigadeName || !selectedGameId) return;
        setIsCreatingBrigade(true);
        try {
            let code;
            let isCodeUnique = false;

            // Just a safety loop to ensure uniqueness
            while (!isCodeUnique) {
                code = generateRandomCode();
                const { data } = await supabase.from('brigades').select('id').eq('code', code);
                if (!data || data.length === 0) isCodeUnique = true;
            }

            const { error } = await supabase.from('brigades').insert({
                game_id: selectedGameId,
                name: newBrigadeName,
                code: code
            });

            if (error) throw error;

            setNewBrigadeName("");
            setIsBrigadeDialogOpen(false);
            fetchBrigades();
        } catch (error: any) {
            console.error(error);
            alert("Erreur lors de la création : " + error.message);
        } finally {
            setIsCreatingBrigade(false);
        }
    };

    const ROLES = [
        "Le Chef de Brigade (Président)",
        "L'Économe (Trésorier)",
        "Le Garde-Manger (Secrétaire Général)",
        "Le Sourcier (Responsable Commercial)",
        "Le Sous-Chef (Chef de Projet)",
        "L'Auditeur (Responsable Qualité)",
        "Le Dressage (Responsable Communication)",
        "L'Éco-Sourcier (Responsable RSE)",
        "Le Maître d'Hôtel (Développeur Commercial)",
        "Le Hacker Chef (DSI)"
    ];

    const [isPlayerImportOpen, setIsPlayerImportOpen] = useState(false);
    const [playersListText, setPlayersListText] = useState("");
    const [importGameId, setImportGameId] = useState("");
    const [isImporting, setIsImporting] = useState(false);

    const importAndDistributePlayers = async () => {
        if (!playersListText || !importGameId) return;
        setIsImporting(true);
        try {
            // Parse players names
            const names = playersListText.split('\n').map(n => n.trim()).filter(n => n.length > 0);
            if (names.length === 0) throw new Error("No players found in text.");

            // Get game brigades
            const gameBrigades = brigades.filter(b => b.game_id === importGameId);
            if (gameBrigades.length === 0) throw new Error("This game has no brigades.");

            const playersToInsert: any[] = [];

            // Randomize names array
            const shuffledNames = [...names].sort(() => 0.5 - Math.random());

            // Distribute and assign roles
            shuffledNames.forEach((name, i) => {
                const brigadeIndex = i % gameBrigades.length;
                const roleIndex = Math.floor(i / gameBrigades.length);
                const role = roleIndex < ROLES.length ? ROLES[roleIndex] : null;

                playersToInsert.push({
                    brigade_id: gameBrigades[brigadeIndex].id,
                    name: name,
                    role: role
                });
            });

            const { error } = await supabase.from('players').insert(playersToInsert);
            if (error) throw error;

            setPlayersListText("");
            setIsPlayerImportOpen(false);
            fetchPlayers();
            alert(`Succès! ${playersToInsert.length} joueurs répartis dans ${gameBrigades.length} brigades.`);
        } catch (error: any) {
            console.error(error);
            alert("Erreur d'import : " + error.message);
        } finally {
            setIsImporting(false);
        }
    };

    const deleteGame = async (gameId: string) => {
        if (!confirm("Attention, cela supprimera la partie et toutes ses brigades en cascade. Continuer ?")) return;
        try {
            await supabase.from('games').delete().eq('id', gameId);
            fetchGames();
            fetchBrigades();
        } catch (error) {
            console.error(error);
        }
    };

    const changeGameStatus = async (gameId: string, status: string) => {
        try {
            await supabase.from('games').update({ status }).eq('id', gameId);
            fetchGames();
        } catch (error) {
            console.error(error);
        }
    };

    const goToGameMaster = (gameId: string) => {
        router.push(`/gm/${gameId}`);
    };

    return (
        <div className="min-h-screen flex flex-col p-4 md:p-8 bg-background">
            <header className="flex items-center justify-between pb-8 border-b border-white/10 mb-8">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-white flex items-center gap-3 font-mono">
                        <Server className="w-8 h-8 text-primary" />
                        SYSADMIN_PANEL
                    </h1>
                    <p className="text-muted-foreground font-mono text-sm mt-1">Global Configuration & Provisioning</p>
                </div>
                <Button variant="outline" className="font-mono text-xs" onClick={() => router.push("/")}>
                    EXIT_ADMIN
                </Button>
            </header>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col md:flex-row gap-8">
                <div className="w-full md:w-64 shrink-0">
                    <TabsList className="flex flex-col h-auto bg-transparent items-stretch space-y-2">
                        <TabsTrigger value="games" className="justify-start data-[state=active]:bg-primary/20 data-[state=active]:border-l-4 border-l-4 border-transparent border-primary font-mono py-3">
                            <Database className="w-4 h-4 mr-3" /> GAMES_INSTANCES
                        </TabsTrigger>
                        <TabsTrigger value="brigades" className="justify-start data-[state=active]:bg-primary/20 data-[state=active]:border-l-4 border-l-4 border-transparent border-primary font-mono py-3">
                            <Users className="w-4 h-4 mr-3" /> BRIGADES_MGMT
                        </TabsTrigger>
                        <TabsTrigger value="players" className="justify-start data-[state=active]:bg-primary/20 data-[state=active]:border-l-4 border-l-4 border-transparent border-primary font-mono py-3">
                            <Users className="w-4 h-4 mr-3" /> PLAYERS_MGMT
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="justify-start data-[state=active]:bg-primary/20 data-[state=active]:border-l-4 border-l-4 border-transparent border-primary font-mono py-3">
                            <Settings className="w-4 h-4 mr-3" /> GLOBAL_CONFIG
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1">
                    {/* GAMES TAB */}
                    <TabsContent value="games" className="mt-0 space-y-6">
                        <div className="flex justify-between items-center bg-background z-10 sticky top-0 py-2">
                            <div>
                                <h2 className="text-2xl font-bold font-mono text-white">Instance Management</h2>
                                <p className="text-muted-foreground text-sm">Create and manage game sessions.</p>
                            </div>
                            <Dialog open={isGameDialogOpen} onOpenChange={setIsGameDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="font-mono bg-primary hover:bg-primary/80 text-primary-foreground">
                                        <Plus className="w-4 h-4 mr-2" /> NEW_GAME
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="glass-panel border-white/10 bg-background/95 sm:max-w-[425px]">
                                    <DialogHeader>
                                        <DialogTitle className="font-mono text-xl">Initialize New Instance</DialogTitle>
                                        <DialogDescription>Setup a new Game environment and automatically generate its Brigades.</DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2">
                                            <Label className="font-mono text-muted-foreground">GAME_NAME</Label>
                                            <Input
                                                placeholder="e.g. Corporate Event 2026"
                                                value={newGameName}
                                                onChange={(e) => setNewGameName(e.target.value)}
                                                className="bg-white/5 border-white/10 font-mono"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className="font-mono text-muted-foreground">BRIGADE_COUNT</Label>
                                            <Input
                                                type="number"
                                                value={newBrigadeCount}
                                                onChange={(e) => setNewBrigadeCount(parseInt(e.target.value))}
                                                className="bg-white/5 border-white/10 font-mono"
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            onClick={deployInstance}
                                            disabled={isDeploying || !newGameName}
                                            className="font-mono bg-secondary hover:bg-secondary/80 text-secondary-foreground w-full"
                                        >
                                            {isDeploying ? "DEPLOYING..." : "DEPLOY_INSTANCE"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>

                        <Card className="glass-panel border-white/10 bg-background/50">
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-white/5">
                                        <TableRow className="border-white/10 hover:bg-transparent">
                                            <TableHead className="font-mono text-primary">NAME</TableHead>
                                            <TableHead className="font-mono text-primary">STATUS</TableHead>
                                            <TableHead className="font-mono text-primary">CREATED</TableHead>
                                            <TableHead className="text-right font-mono text-primary">ACTIONS</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {games.map((g) => (
                                            <TableRow key={g.id} className="border-white/10 hover:bg-white/5">
                                                <TableCell className="font-bold">{g.name}</TableCell>
                                                <TableCell>
                                                    <span className={`px-2 py-1 rounded text-xs font-mono uppercase ${g.status === 'setup' ? 'bg-secondary/20 text-secondary' : g.status === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                                                        {g.status}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm font-mono">
                                                    {new Date(g.created_at).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    {g.status === 'setup' && (
                                                        <Button variant="ghost" size="icon" title="Lancer" onClick={() => changeGameStatus(g.id, 'active')} className="h-8 w-8 hover:text-green-500"><PlaySquare className="w-4 h-4" /></Button>
                                                    )}
                                                    {g.status === 'active' && (
                                                        <Button variant="ghost" size="icon" title="Arrêter" onClick={() => changeGameStatus(g.id, 'finished')} className="h-8 w-8 hover:text-orange-500"><Square className="w-4 h-4" /></Button>
                                                    )}
                                                    <Button variant="ghost" size="icon" title="Ouvrir Game Master" onClick={() => goToGameMaster(g.id)} className="h-8 w-8 hover:text-secondary"><Settings2 className="w-4 h-4" /></Button>
                                                    <Button variant="ghost" size="icon" title="Supprimer" onClick={() => deleteGame(g.id)} className="h-8 w-8 hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {games.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground font-mono">NO ACTIVE INSTANCES</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                        {/* The table replaces the static form area */}
                    </TabsContent>

                    {/* BRIGADES TAB */}
                    <TabsContent value="brigades" className="mt-0 space-y-6">
                        <div className="flex justify-between items-center bg-background z-10 sticky top-0 py-2">
                            <div>
                                <h2 className="text-2xl font-bold font-mono text-white">Global Brigade Roster</h2>
                                <p className="text-muted-foreground text-sm">All generated connection codes across instances.</p>
                            </div>
                            <Dialog open={isBrigadeDialogOpen} onOpenChange={setIsBrigadeDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="font-mono bg-primary hover:bg-primary/80 text-primary-foreground">
                                        <Plus className="w-4 h-4 mr-2" /> ADD_BRIGADE
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="glass-panel border-white/10 bg-background/95 sm:max-w-[425px]">
                                    <DialogHeader>
                                        <DialogTitle className="font-mono text-xl">Create Isolated Brigade</DialogTitle>
                                        <DialogDescription>Manually add a new brigade to an existing game instance.</DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2">
                                            <Label className="font-mono text-muted-foreground">GAME_INSTANCE</Label>
                                            <select
                                                className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
                                                value={selectedGameId}
                                                onChange={(e) => setSelectedGameId(e.target.value)}
                                            >
                                                <option value="" disabled className="bg-background text-muted-foreground">Select a game...</option>
                                                {games.map(g => (
                                                    <option key={g.id} value={g.id} className="bg-background text-white">{g.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className="font-mono text-muted-foreground">BRIGADE_NAME</Label>
                                            <Input
                                                placeholder="e.g. Late Arrivals"
                                                value={newBrigadeName}
                                                onChange={(e) => setNewBrigadeName(e.target.value)}
                                                className="bg-white/5 border-white/10 font-mono"
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            onClick={createSingleBrigade}
                                            disabled={isCreatingBrigade || !newBrigadeName || !selectedGameId}
                                            className="font-mono bg-secondary hover:bg-secondary/80 text-secondary-foreground w-full"
                                        >
                                            {isCreatingBrigade ? "CREATING..." : "CREATE_BRIGADE"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>

                        <Card className="glass-panel border-white/10 bg-background/50">
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-white/5">
                                        <TableRow className="border-white/10 hover:bg-transparent">
                                            <TableHead className="font-mono text-primary">GAME</TableHead>
                                            <TableHead className="font-mono text-primary">NAME</TableHead>
                                            <TableHead className="font-mono text-primary">CODE</TableHead>
                                            <TableHead className="font-mono text-primary">PRESTIGE</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {brigades.map((b) => {
                                            const gameName = games.find(g => g.id === b.game_id)?.name || "Unknown Game";
                                            return (
                                                <TableRow key={b.id} className="border-white/10 hover:bg-white/5">
                                                    <TableCell className="font-mono text-xs text-muted-foreground">{gameName}</TableCell>
                                                    <TableCell className="font-bold">{b.name}</TableCell>
                                                    <TableCell className="font-mono text-secondary">{b.code}</TableCell>
                                                    <TableCell className="font-mono">{b.prestige_points}</TableCell>
                                                </TableRow>
                                            )
                                        })}
                                        {brigades.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground font-mono">NO BRIGADES FOUND</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* PLAYERS TAB */}
                    <TabsContent value="players" className="mt-0 space-y-6">
                        <div className="flex justify-between items-center bg-background z-10 sticky top-0 py-2">
                            <div>
                                <h2 className="text-2xl font-bold font-mono text-white">Player Distribution</h2>
                                <p className="text-muted-foreground text-sm">Import and distribute players into brigades with roles.</p>
                            </div>
                            <Dialog open={isPlayerImportOpen} onOpenChange={setIsPlayerImportOpen}>
                                <DialogTrigger asChild>
                                    <Button className="font-mono bg-secondary hover:bg-secondary/80 text-secondary-foreground">
                                        <Plus className="w-4 h-4 mr-2" /> IMPORT_PLAYERS
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="glass-panel border-white/10 bg-background/95 sm:max-w-[425px]">
                                    <DialogHeader>
                                        <DialogTitle className="font-mono text-xl">Import & Distribute</DialogTitle>
                                        <DialogDescription>Paste a list of names. They will be evenly distributed into the brigades of the selected game, and assigned unique rules within their brigade.</DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2">
                                            <Label className="font-mono text-muted-foreground">TARGET_GAME</Label>
                                            <select
                                                className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
                                                value={importGameId}
                                                onChange={(e) => setImportGameId(e.target.value)}
                                            >
                                                <option value="" disabled className="bg-background text-muted-foreground">Select a game...</option>
                                                {games.map(g => (
                                                    <option key={g.id} value={g.id} className="bg-background text-white">{g.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className="font-mono text-muted-foreground">NAMES_LIST (1 per line)</Label>
                                            <textarea
                                                className="flex min-h-[150px] w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
                                                placeholder="John Doe&#10;Jane Smith&#10;Alice..."
                                                value={playersListText}
                                                onChange={(e) => setPlayersListText(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            onClick={importAndDistributePlayers}
                                            disabled={isImporting || !playersListText || !importGameId}
                                            className="font-mono bg-secondary hover:bg-secondary/80 text-secondary-foreground w-full"
                                        >
                                            {isImporting ? "PROCESSING..." : "DISTRIBUTE_ROLES"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>

                        <Card className="glass-panel border-white/10 bg-background/50">
                            <CardContent className="p-0 max-h-[600px] overflow-auto">
                                <Table>
                                    <TableHeader className="bg-white/5 sticky top-0 z-10">
                                        <TableRow className="border-white/10 hover:bg-transparent">
                                            <TableHead className="font-mono text-primary">PLAYER_NAME</TableHead>
                                            <TableHead className="font-mono text-primary">BRIGADE CODE</TableHead>
                                            <TableHead className="font-mono text-primary">ROLE</TableHead>
                                            <TableHead className="font-mono text-primary">GAME</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {players.map((p) => {
                                            const brigade = brigades.find(b => b.id === p.brigade_id);
                                            const brigadeCode = brigade?.code || "Unknown";
                                            const gameName = games.find(g => g.id === brigade?.game_id)?.name || "Unknown Game";

                                            return (
                                                <TableRow key={p.id} className="border-white/10 hover:bg-white/5">
                                                    <TableCell className="font-bold">{p.name}</TableCell>
                                                    <TableCell className="font-mono text-secondary">{brigadeCode}</TableCell>
                                                    <TableCell className="font-mono text-xs text-muted-foreground">{p.role || "No Role"}</TableCell>
                                                    <TableCell className="font-mono text-xs text-muted-foreground">{gameName}</TableCell>
                                                </TableRow>
                                            )
                                        })}
                                        {players.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground font-mono">NO PLAYERS FOUND</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* SETTINGS TAB */}
                    <TabsContent value="settings" className="mt-0 space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold font-mono text-white">System Configuration</h2>
                                <p className="text-muted-foreground text-sm">Supabase connection status.</p>
                            </div>
                        </div>

                        <Card className="glass-panel border-white/10 bg-background/50">
                            <CardHeader>
                                <CardTitle className="font-mono text-lg text-primary">Database connection</CardTitle>
                                <CardDescription>Supabase project credentials.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="font-mono text-muted-foreground">NEXT_PUBLIC_SUPABASE_URL</Label>
                                    <Input readOnly type="text" value={process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not configured in .env'} className="bg-white/5 border-white/10 font-mono text-muted-foreground" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-mono text-muted-foreground">NEXT_PUBLIC_SUPABASE_ANON_KEY</Label>
                                    <Input readOnly type="password" value={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '••••••••••••••••' : 'Not configured in .env'} className="bg-white/5 border-white/10 font-mono text-muted-foreground" />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
