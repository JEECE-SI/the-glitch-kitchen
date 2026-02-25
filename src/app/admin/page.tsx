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
import * as XLSX from "xlsx";

export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("games");

    const [games, setGames] = useState<any[]>([]);
    const [brigades, setBrigades] = useState<any[]>([]);
    const [players, setPlayers] = useState<any[]>([]);
    const [staffList, setStaffList] = useState<any[]>([]);

    const [catalogRoles, setCatalogRoles] = useState<any[]>([]);
    const [catalogMissions, setCatalogMissions] = useState<any[]>([]);
    const [catalogContests, setCatalogContests] = useState<any[]>([]);

    const [isGameDialogOpen, setIsGameDialogOpen] = useState(false);
    const [newGameName, setNewGameName] = useState("");
    const [newBrigadeCount, setNewBrigadeCount] = useState(10);
    const [cycleSettings, setCycleSettings] = useState({ annonce: 4, contests: 7, temps_libre: 9 });
    const [isDeploying, setIsDeploying] = useState(false);

    const [isBrigadeDialogOpen, setIsBrigadeDialogOpen] = useState(false);
    const [newBrigadeName, setNewBrigadeName] = useState("");
    const [selectedGameId, setSelectedGameId] = useState("");
    const [isCreatingBrigade, setIsCreatingBrigade] = useState(false);

    const [isMassDeployOpen, setIsMassDeployOpen] = useState(false);
    const [massDeployPrefix, setMassDeployPrefix] = useState("Session");
    const [massGameCount, setMassGameCount] = useState(2);
    const [massBrigadeCount, setMassBrigadeCount] = useState(5);
    const [isMassDeploying, setIsMassDeploying] = useState(false);
    // massPlayers holds the list of players to be distributed: { name, poste }
    const [massPlayers, setMassPlayers] = useState<{ name: string; poste: string }[]>([]);
    const [massManualText, setMassManualText] = useState(""); // manual input: "Prenom Nom,Poste" per line
    const [massExcelFileName, setMassExcelFileName] = useState("");

    useEffect(() => {
        fetchGames();
        fetchBrigades();
        fetchPlayers();
        fetchStaff();
        fetchCatalogRoles();
        fetchCatalogMissions();
        fetchCatalogContests();

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

    const fetchStaff = async () => {
        const { data } = await supabase.from('staff').select('*').order('created_at', { ascending: false });
        if (data) setStaffList(data);
    };

    const fetchCatalogRoles = async () => {
        const { data } = await supabase.from('catalog_roles').select('*').order('created_at', { ascending: false });
        if (data) setCatalogRoles(data);
    };
    const fetchCatalogMissions = async () => {
        const { data } = await supabase.from('catalog_missions').select('*').order('created_at', { ascending: false });
        if (data) setCatalogMissions(data);
    };
    const fetchCatalogContests = async () => {
        const { data } = await supabase.from('catalog_contests').select('*').order('created_at', { ascending: false });
        if (data) setCatalogContests(data);
    };

    const deleteCatalogItem = async (table: string, id: string, fetchFn: () => void) => {
        if (!confirm("Delete this item?")) return;
        await supabase.from(table).delete().eq('id', id);
        fetchFn();
    };

    // States for quick add forms
    const [newRole, setNewRole] = useState({ title: "", power_name: "", description: "" });
    const createRole = async () => {
        if (!newRole.title) return;
        await supabase.from('catalog_roles').insert(newRole);
        setNewRole({ title: "", power_name: "", description: "" });
        fetchCatalogRoles();
    };

    const [newMission, setNewMission] = useState({ title: "", description: "" });
    const createMission = async () => {
        if (!newMission.title) return;
        await supabase.from('catalog_missions').insert(newMission);
        setNewMission({ title: "", description: "" });
        fetchCatalogMissions();
    };

    const [newContest, setNewContest] = useState({ title: "", description: "" });
    const createContest = async () => {
        if (!newContest.title) return;
        await supabase.from('catalog_contests').insert(newContest);
        setNewContest({ title: "", description: "" });
        fetchCatalogContests();
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
                .insert({
                    name: newGameName,
                    status: 'setup',
                })
                .select()
                .single();

            if (gameError) throw gameError;

            // Try to save cycleSettings — only works after the migration_recipe_tests.sql migration is applied
            await supabase.from('games').update({ settings: cycleSettings }).eq('id', game.id);

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

            // 3. Create Staff
            let staffCode;
            do {
                staffCode = generateRandomCode();
            } while (usedCodes.has(staffCode));

            const { error: staffError } = await supabase.from('staff').insert({
                game_id: game.id,
                code: staffCode
            });

            if (staffError) throw staffError;

            setNewGameName("");
            setIsGameDialogOpen(false);
            fetchGames();
            fetchBrigades();
            fetchStaff(); // Add staff refresh
        } catch (error: any) {
            console.error(error);
            alert("Erreur lors de la création : " + error.message);
        } finally {
            setIsDeploying(false);
        }
    };

    const handleMassExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setMassExcelFileName(file.name);
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws);
            const parsed: { name: string; poste: string }[] = [];
            data.forEach((row: any) => {
                const nom = row['Nom'] || row['nom'] || row['NOM'] || '';
                const prenom = row['Prénom'] || row['Prenom'] || row['prenom'] || row['PRENOM'] || '';
                const poste = row['Poste'] || row['poste'] || row['POSTE'] || row['JE'] || row['je'] || '';
                const fullName = `${prenom} ${nom}`.trim();
                if (fullName) parsed.push({ name: fullName, poste: String(poste).trim() });
            });
            if (parsed.length > 0) {
                setMassPlayers(prev => {
                    // merge, deduplicate by name
                    const existing = new Set(prev.map(p => p.name));
                    return [...prev, ...parsed.filter(p => !existing.has(p.name))];
                });
            } else {
                alert("Aucun joueur trouvé. Vérifiez les colonnes 'Nom', 'Prénom'.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleMassManualAdd = () => {
        const lines = massManualText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const parsed: { name: string; poste: string }[] = lines.map(line => {
            const parts = line.split(',');
            const name = (parts[0] || '').trim();
            const poste = (parts[1] || '').trim();
            return { name, poste };
        }).filter(p => p.name.length > 0);
        if (parsed.length > 0) {
            setMassPlayers(prev => {
                const existing = new Set(prev.map(p => p.name));
                return [...prev, ...parsed.filter(p => !existing.has(p.name))];
            });
            setMassManualText("");
        }
    };

    /**
     * Smart role distribution:
     * - Each player has a preferred role based on their "poste" (matched to catalog roles by title).
     * - We process groups of players sorted by rarity of their preferred role (rarest first).
     * - For each brigade, we assign each player their preferred role if not already taken in that brigade.
     * - If the preferred role is already used in that brigade, we assign any role not yet used in that brigade.
     * - If all roles are used, we assign null.
     */
    const smartDistribute = (
        playerList: { name: string; poste: string }[],
        brigadeList: any[],
        availableRoles: string[]
    ): { brigade_id: string; name: string; role: string | null }[] => {
        // Map poste -> role (match by title, case-insensitive)
        const getPreferredRole = (poste: string): string | null => {
            if (!poste) return null;
            const match = availableRoles.find(r => r.toLowerCase() === poste.toLowerCase());
            return match || null;
        };

        // Group players by preferred role
        const byRole: Map<string | null, { name: string; poste: string }[]> = new Map();
        playerList.forEach(p => {
            const role = getPreferredRole(p.poste);
            if (!byRole.has(role)) byRole.set(role, []);
            byRole.get(role)!.push(p);
        });

        // Sort roles by count ascending (rarer roles first)
        const sortedRoles = Array.from(byRole.entries()).sort((a, b) => a[1].length - b[1].length);

        // Build ordered player list: rarest role first
        const orderedPlayers: { name: string; poste: string; preferredRole: string | null }[] = [];
        sortedRoles.forEach(([role, players]) => {
            players.forEach(p => orderedPlayers.push({ ...p, preferredRole: role }));
        });

        // Track roles used per brigade
        const brigadeRolesUsed: Map<string, Set<string>> = new Map();
        brigadeList.forEach(b => brigadeRolesUsed.set(b.id, new Set()));

        const result: { brigade_id: string; name: string; role: string | null }[] = [];

        // Assign players round-robin across brigades
        orderedPlayers.forEach((player, i) => {
            const brigade = brigadeList[i % brigadeList.length];
            const usedRoles = brigadeRolesUsed.get(brigade.id)!;

            let assignedRole: string | null = null;

            if (player.preferredRole && !usedRoles.has(player.preferredRole)) {
                // Preferred role is free in this brigade
                assignedRole = player.preferredRole;
            } else {
                // Find any unused role in this brigade
                const freeRole = availableRoles.find(r => !usedRoles.has(r));
                assignedRole = freeRole || null;
            }

            if (assignedRole) usedRoles.add(assignedRole);
            result.push({ brigade_id: brigade.id, name: player.name, role: assignedRole });
        });

        return result;
    };

    const massDeployInstances = async () => {
        if (!massDeployPrefix || massGameCount <= 0 || massBrigadeCount <= 0) return;
        if (massPlayers.length === 0) {
            alert("Ajoutez d'abord des joueurs à la liste.");
            return;
        }
        setIsMassDeploying(true);
        try {
            const allNewBrigades: any[] = [];
            const usedCodes = new Set();
            const generateCodeUnique = () => {
                let code;
                do { code = generateRandomCode(); } while (usedCodes.has(code));
                usedCodes.add(code);
                return code;
            };

            for (let i = 0; i < massGameCount; i++) {
                // 1. Create Game
                const { data: game, error: gameError } = await supabase
                    .from('games')
                    .insert({ name: `${massDeployPrefix} - ${i + 1}`, status: 'setup' })
                    .select().single();
                if (gameError) throw gameError;
                await supabase.from('games').update({ settings: cycleSettings }).eq('id', game.id);

                // 2. Generate Brigades
                const brigadesToInsert = Array.from({ length: massBrigadeCount }, (_, j) => ({
                    game_id: game.id,
                    code: generateCodeUnique(),
                    name: `Brigade ${j + 1}`
                }));
                const { data: createdBrigades, error: brigadeError } = await supabase.from('brigades').insert(brigadesToInsert).select();
                if (brigadeError) throw brigadeError;
                allNewBrigades.push(...createdBrigades);

                // 3. Create Staff
                const { error: staffError } = await supabase.from('staff').insert({ game_id: game.id, code: generateCodeUnique() });
                if (staffError) throw staffError;
            }

            // 4. Smart Distribute Players across ALL new brigades
            const playersToInsert = smartDistribute(massPlayers, allNewBrigades, ROLES);

            const { error: playerError } = await supabase.from('players').insert(playersToInsert);
            if (playerError) throw playerError;

            setMassDeployPrefix("Session");
            setMassPlayers([]);
            setMassExcelFileName("");
            setIsMassDeployOpen(false);
            fetchGames(); fetchBrigades(); fetchStaff(); fetchPlayers();
            alert(`Succès! ${massGameCount} parties créées, ${playersToInsert.length} joueurs répartis dans ${allNewBrigades.length} brigades.`);
        } catch (error: any) {
            console.error(error);
            alert("Erreur : " + error.message);
        } finally {
            setIsMassDeploying(false);
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

    const ROLES = catalogRoles.map(r => r.title);

    const [isPlayerImportOpen, setIsPlayerImportOpen] = useState(false);
    const [playersListText, setPlayersListText] = useState(""); // Keeping this just in case, though unused now in UI
    const [importGameId, setImportGameId] = useState("");
    const [isImporting, setIsImporting] = useState(false);
    const [importedNames, setImportedNames] = useState<string[]>([]);
    const [importFileName, setImportFileName] = useState("");

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportFileName(file.name);

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);

            const names: string[] = [];
            data.forEach((row: any) => {
                // Ensure field names are case-insensitive or close enough, user requested "Nom Prénom JE et Poste"
                // Let's look for combinations of Nom/Prenom
                const nomInfo = row['Nom'] || row['nom'] || row['NOM'];
                const prenomInfo = row['Prénom'] || row['Prenom'] || row['prenom'] || row['PRENOM'];

                if (nomInfo || prenomInfo) {
                    const fullName = `${prenomInfo || ''} ${nomInfo || ''}`.trim();
                    if (fullName) {
                        names.push(fullName);
                    }
                }
            });

            if (names.length > 0) {
                setImportedNames(names);
            } else {
                alert("Aucun nom trouvé dans le fichier. Assurez-vous d'avoir des colonnes 'Nom' et 'Prénom'.");
            }
        };
        reader.readAsBinaryString(file);
    };


    const importAndDistributePlayers = async () => {
        if (importedNames.length === 0 || !importGameId) return;
        setIsImporting(true);
        try {
            const names = importedNames;

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

            setImportedNames([]);
            setImportFileName("");
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

    const deletePlayer = async (playerId: string) => {
        if (!confirm("Voulez-vous vraiment supprimer ce joueur ?")) return;
        try {
            await supabase.from('players').delete().eq('id', playerId);
            fetchPlayers();
        } catch (error) {
            console.error(error);
        }
    };

    const deleteAllPlayers = async () => {
        if (!confirm("Attention, cela supprimera TOUS les joueurs. Continuer ?")) return;
        try {
            await supabase.from('players').delete().neq('name', 'prevent_empty_filter_error_123');
            fetchPlayers();
        } catch (error) {
            console.error(error);
        }
    };

    const deleteGame = async (gameId: string) => {
        if (!confirm("Attention, cela supprimera la partie et toutes ses brigades en cascade. Continuer ?")) return;
        try {
            await supabase.from('games').delete().eq('id', gameId);
            fetchGames();
            fetchBrigades();
            fetchStaff();
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
                        <TabsTrigger value="roles" className="justify-start data-[state=active]:bg-primary/20 data-[state=active]:border-l-4 border-l-4 border-transparent border-primary font-mono py-3">
                            <Database className="w-4 h-4 mr-3" /> CATALOG_ROLES
                        </TabsTrigger>
                        <TabsTrigger value="missions" className="justify-start data-[state=active]:bg-primary/20 data-[state=active]:border-l-4 border-l-4 border-transparent border-primary font-mono py-3">
                            <Database className="w-4 h-4 mr-3" /> CATALOG_MISSIONS
                        </TabsTrigger>
                        <TabsTrigger value="contests" className="justify-start data-[state=active]:bg-primary/20 data-[state=active]:border-l-4 border-l-4 border-transparent border-primary font-mono py-3">
                            <Database className="w-4 h-4 mr-3" /> CATALOG_CONTESTS
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
                            <div className="flex items-center gap-2">
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
                                            <div className="grid grid-cols-3 gap-2 mt-2">
                                                <div className="grid gap-2">
                                                    <Label className="font-mono text-xs text-muted-foreground">ANNONCE (MIN)</Label>
                                                    <Input
                                                        type="number"
                                                        value={cycleSettings.annonce}
                                                        onChange={(e) => setCycleSettings({ ...cycleSettings, annonce: parseInt(e.target.value) || 0 })}
                                                        className="bg-white/5 border-white/10 font-mono text-xs"
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label className="font-mono text-xs text-muted-foreground">CONTESTS (MIN)</Label>
                                                    <Input
                                                        type="number"
                                                        value={cycleSettings.contests}
                                                        onChange={(e) => setCycleSettings({ ...cycleSettings, contests: parseInt(e.target.value) || 0 })}
                                                        className="bg-white/5 border-white/10 font-mono text-xs"
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label className="font-mono text-xs text-muted-foreground">TEMPS LIBRE (MIN)</Label>
                                                    <Input
                                                        type="number"
                                                        value={cycleSettings.temps_libre}
                                                        onChange={(e) => setCycleSettings({ ...cycleSettings, temps_libre: parseInt(e.target.value) || 0 })}
                                                        className="bg-white/5 border-white/10 font-mono text-xs"
                                                    />
                                                </div>
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

                                <Dialog open={isMassDeployOpen} onOpenChange={setIsMassDeployOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="font-mono border-secondary text-secondary hover:bg-secondary/10 ml-2">
                                            <Server className="w-4 h-4 mr-2" /> MASS_DEPLOY
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="glass-panel border-white/10 bg-background/95 sm:max-w-[500px]">
                                        <DialogHeader>
                                            <DialogTitle className="font-mono text-xl">Mass Deploy Instances</DialogTitle>
                                            <DialogDescription>
                                                Créez plusieurs instances de jeu et répartissez intelligemment les joueurs selon leur poste.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                                            {/* Game config */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="grid gap-2">
                                                    <Label className="font-mono text-muted-foreground">NAME_PREFIX</Label>
                                                    <Input
                                                        placeholder="e.g. Session"
                                                        value={massDeployPrefix}
                                                        onChange={(e) => setMassDeployPrefix(e.target.value)}
                                                        className="bg-white/5 border-white/10 font-mono"
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label className="font-mono text-muted-foreground">GAME_COUNT</Label>
                                                    <Input
                                                        type="number"
                                                        value={massGameCount}
                                                        onChange={(e) => setMassGameCount(parseInt(e.target.value))}
                                                        className="bg-white/5 border-white/10 font-mono"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid gap-2">
                                                <Label className="font-mono text-muted-foreground">BRIGADES_PER_GAME</Label>
                                                <Input
                                                    type="number"
                                                    value={massBrigadeCount}
                                                    onChange={(e) => setMassBrigadeCount(parseInt(e.target.value))}
                                                    className="bg-white/5 border-white/10 font-mono"
                                                />
                                            </div>

                                            {/* Players section */}
                                            <div className="border border-white/10 rounded-md p-3 grid gap-3">
                                                <div className="flex items-center justify-between">
                                                    <Label className="font-mono text-muted-foreground text-sm">PLAYERS_TO_DISTRIBUTE ({massPlayers.length})</Label>
                                                    {massPlayers.length > 0 && (
                                                        <Button variant="ghost" size="sm" className="text-xs text-destructive h-6" onClick={() => setMassPlayers([])}>
                                                            Vider la liste
                                                        </Button>
                                                    )}
                                                </div>

                                                {/* Excel import */}
                                                <div className="grid gap-1">
                                                    <Label className="font-mono text-xs text-muted-foreground">IMPORT_EXCEL (.xlsx — colonnes: Nom, Prénom, Poste)</Label>
                                                    <Input
                                                        type="file"
                                                        accept=".xlsx,.xls"
                                                        onChange={handleMassExcelUpload}
                                                        className="bg-white/5 border-white/10 font-mono text-xs cursor-pointer"
                                                    />
                                                    {massExcelFileName && <p className="text-xs text-muted-foreground">{massExcelFileName}</p>}
                                                </div>

                                                {/* Manual input */}
                                                <div className="grid gap-1">
                                                    <Label className="font-mono text-xs text-muted-foreground">SAISIE_MANUELLE (Prénom Nom, Poste — 1 par ligne)</Label>
                                                    <textarea
                                                        className="flex min-h-[80px] w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
                                                        placeholder={"Jean Dupont, Cuisinier\nMarie Martin, Serveur"}
                                                        value={massManualText}
                                                        onChange={(e) => setMassManualText(e.target.value)}
                                                    />
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="font-mono text-xs border-white/10 mt-1"
                                                        onClick={handleMassManualAdd}
                                                        disabled={!massManualText.trim()}
                                                    >
                                                        + Ajouter à la liste
                                                    </Button>
                                                </div>

                                                {/* Player preview */}
                                                {massPlayers.length > 0 && (
                                                    <div className="max-h-[120px] overflow-y-auto rounded border border-white/5 bg-white/5 p-2">
                                                        {massPlayers.map((p, i) => (
                                                            <div key={i} className="flex items-center justify-between text-xs font-mono py-0.5">
                                                                <span>{p.name}</span>
                                                                <span className="text-muted-foreground ml-2">{p.poste || '—'}</span>
                                                                <button className="ml-2 text-destructive hover:opacity-80" onClick={() => setMassPlayers(prev => prev.filter((_, j) => j !== i))}>✕</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Cycle settings */}
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="grid gap-2">
                                                    <Label className="font-mono text-xs text-muted-foreground">ANNONCE (MIN)</Label>
                                                    <Input type="number" value={cycleSettings.annonce} onChange={(e) => setCycleSettings({ ...cycleSettings, annonce: parseInt(e.target.value) || 0 })} className="bg-white/5 border-white/10 font-mono text-xs" />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label className="font-mono text-xs text-muted-foreground">CONTESTS (MIN)</Label>
                                                    <Input type="number" value={cycleSettings.contests} onChange={(e) => setCycleSettings({ ...cycleSettings, contests: parseInt(e.target.value) || 0 })} className="bg-white/5 border-white/10 font-mono text-xs" />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label className="font-mono text-xs text-muted-foreground">TEMPS LIBRE (MIN)</Label>
                                                    <Input type="number" value={cycleSettings.temps_libre} onChange={(e) => setCycleSettings({ ...cycleSettings, temps_libre: parseInt(e.target.value) || 0 })} className="bg-white/5 border-white/10 font-mono text-xs" />
                                                </div>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button
                                                onClick={massDeployInstances}
                                                disabled={isMassDeploying || !massDeployPrefix || massPlayers.length === 0}
                                                className="font-mono bg-secondary hover:bg-secondary/80 text-secondary-foreground w-full"
                                            >
                                                {isMassDeploying ? "DEPLOYING..." : `DEPLOY_ALL (${massPlayers.length} joueurs)`}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>

                        <Card className="glass-panel border-white/10 bg-background/50">
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-white/5">
                                        <TableRow className="border-white/10 hover:bg-transparent">
                                            <TableHead className="font-mono text-primary">NAME</TableHead>
                                            <TableHead className="font-mono text-primary">STAFF CODE</TableHead>
                                            <TableHead className="font-mono text-primary">STATUS</TableHead>
                                            <TableHead className="font-mono text-primary">CREATED</TableHead>
                                            <TableHead className="text-right font-mono text-primary">ACTIONS</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {games.map((g) => {
                                            const staffData = staffList.find((s: any) => s.game_id === g.id);
                                            return (
                                                <TableRow key={g.id} className="border-white/10 hover:bg-white/5">
                                                    <TableCell className="font-bold">{g.name}</TableCell>
                                                    <TableCell className="font-mono text-secondary text-sm">{staffData?.code || 'None'}</TableCell>
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
                                            )
                                        })}
                                        {games.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground font-mono">NO ACTIVE INSTANCES</TableCell>
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
                                            <TableHead className="font-mono text-primary">STAFF CODE</TableHead>
                                            <TableHead className="font-mono text-primary">NAME</TableHead>
                                            <TableHead className="font-mono text-primary">CODE</TableHead>
                                            <TableHead className="font-mono text-primary">PRESTIGE</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {brigades.map((b) => {
                                            const gameName = games.find(g => g.id === b.game_id)?.name || "Unknown Game";
                                            const staffData = staffList.find(s => s.game_id === b.game_id);
                                            return (
                                                <TableRow key={b.id} className="border-white/10 hover:bg-white/5">
                                                    <TableCell className="font-mono text-xs text-muted-foreground">{gameName}</TableCell>
                                                    <TableCell className="font-mono text-secondary text-xs">{staffData?.code || 'None'}</TableCell>
                                                    <TableCell className="font-bold">{b.name}</TableCell>
                                                    <TableCell className="font-mono text-secondary">{b.code}</TableCell>
                                                    <TableCell className="font-mono">{b.prestige_points}</TableCell>
                                                </TableRow>
                                            )
                                        })}
                                        {brigades.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground font-mono">NO BRIGADES FOUND</TableCell>
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
                            <div className="flex items-center gap-2">
                                <Button variant="outline" className="font-mono border-destructive text-destructive hover:bg-destructive/10" onClick={deleteAllPlayers}>
                                    <Trash2 className="w-4 h-4 mr-2" /> DELETE_ALL
                                </Button>
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
                                                <Label className="font-mono text-muted-foreground">FICHIER EXCEL (.xlsx)</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="file"
                                                        accept=".xlsx, .xls"
                                                        onChange={handleFileUpload}
                                                        className="bg-white/5 border-white/10 font-mono text-xs cursor-pointer"
                                                    />
                                                </div>
                                                {importFileName && <p className="text-xs text-muted-foreground mt-1">Fichier sélectionné : {importFileName} ({importedNames.length} joueurs trouvés)</p>}
                                                <p className="text-xs text-muted-foreground mt-1 text-primary">Le fichier doit contenir les colonnes 'Nom' et 'Prénom'.</p>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button
                                                onClick={importAndDistributePlayers}
                                                disabled={isImporting || importedNames.length === 0 || !importGameId}
                                                className="font-mono bg-secondary hover:bg-secondary/80 text-secondary-foreground w-full"
                                            >
                                                {isImporting ? "PROCESSING..." : "DISTRIBUTE_ROLES"}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
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
                                            <TableHead className="text-right font-mono text-primary">ACTIONS</TableHead>
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
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="icon" title="Supprimer" onClick={() => deletePlayer(p.id)} className="h-8 w-8 hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                        {players.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground font-mono">NO PLAYERS FOUND</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ROLES TAB */}
                    <TabsContent value="roles" className="mt-0 space-y-6">
                        <div className="flex justify-between items-center bg-background z-10 sticky top-0 py-2">
                            <div>
                                <h2 className="text-2xl font-bold font-mono text-white">Roles Catalog</h2>
                                <p className="text-muted-foreground text-sm">Define global roles and their powers.</p>
                            </div>
                        </div>

                        <Card className="glass-panel border-white/10 p-4 space-y-4">
                            <div className="flex gap-4">
                                <Input placeholder="Role Title" value={newRole.title} onChange={e => setNewRole({ ...newRole, title: e.target.value })} className="bg-white/5 font-mono" />
                                <Input placeholder="Power Name" value={newRole.power_name} onChange={e => setNewRole({ ...newRole, power_name: e.target.value })} className="bg-white/5 font-mono" />
                                <Input placeholder="Description" value={newRole.description} onChange={e => setNewRole({ ...newRole, description: e.target.value })} className="flex-1 bg-white/5 font-mono" />
                                <Button onClick={createRole} className="font-mono bg-primary">ADD</Button>
                            </div>
                        </Card>

                        <Card className="glass-panel border-white/10 bg-background/50">
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-white/5">
                                        <TableRow className="border-white/10">
                                            <TableHead className="font-mono text-primary w-1/4">TITLE</TableHead>
                                            <TableHead className="font-mono text-primary w-1/4">POWER</TableHead>
                                            <TableHead className="font-mono text-primary flex-1">DESCRIPTION</TableHead>
                                            <TableHead className="font-mono text-primary w-16"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {catalogRoles.map((r) => (
                                            <TableRow key={r.id} className="border-white/10">
                                                <TableCell className="font-bold">{r.title}</TableCell>
                                                <TableCell className="font-mono text-secondary text-xs">{r.power_name}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{r.description}</TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => deleteCatalogItem('catalog_roles', r.id, fetchCatalogRoles)} className="hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* MISSIONS TAB */}
                    <TabsContent value="missions" className="mt-0 space-y-6">
                        <div className="flex justify-between items-center bg-background z-10 sticky top-0 py-2">
                            <div>
                                <h2 className="text-2xl font-bold font-mono text-white">Missions Catalog</h2>
                                <p className="text-muted-foreground text-sm">Define global missions.</p>
                            </div>
                        </div>

                        <Card className="glass-panel border-white/10 p-4 space-y-4">
                            <div className="flex gap-4">
                                <Input placeholder="Mission Title" value={newMission.title} onChange={e => setNewMission({ ...newMission, title: e.target.value })} className="bg-white/5 font-mono w-1/4" />
                                <Input placeholder="Description" value={newMission.description} onChange={e => setNewMission({ ...newMission, description: e.target.value })} className="flex-1 bg-white/5 font-mono" />
                                <Button onClick={createMission} className="font-mono bg-primary">ADD</Button>
                            </div>
                        </Card>

                        <Card className="glass-panel border-white/10 bg-background/50">
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-white/5">
                                        <TableRow className="border-white/10">
                                            <TableHead className="font-mono text-primary w-1/3">TITLE</TableHead>
                                            <TableHead className="font-mono text-primary flex-1">DESCRIPTION</TableHead>
                                            <TableHead className="font-mono text-primary w-16"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {catalogMissions.map((m) => (
                                            <TableRow key={m.id} className="border-white/10">
                                                <TableCell className="font-bold">{m.title}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{m.description}</TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => deleteCatalogItem('catalog_missions', m.id, fetchCatalogMissions)} className="hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* CONTESTS TAB */}
                    <TabsContent value="contests" className="mt-0 space-y-6">
                        <div className="flex justify-between items-center bg-background z-10 sticky top-0 py-2">
                            <div>
                                <h2 className="text-2xl font-bold font-mono text-white">Contests Catalog</h2>
                                <p className="text-muted-foreground text-sm">Define global contests.</p>
                            </div>
                        </div>

                        <Card className="glass-panel border-white/10 p-4 space-y-4">
                            <div className="flex gap-4">
                                <Input placeholder="Contest Title" value={newContest.title} onChange={e => setNewContest({ ...newContest, title: e.target.value })} className="bg-white/5 font-mono w-1/4" />
                                <Input placeholder="Description" value={newContest.description} onChange={e => setNewContest({ ...newContest, description: e.target.value })} className="flex-1 bg-white/5 font-mono" />
                                <Button onClick={createContest} className="font-mono bg-primary">ADD</Button>
                            </div>
                        </Card>

                        <Card className="glass-panel border-white/10 bg-background/50">
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-white/5">
                                        <TableRow className="border-white/10">
                                            <TableHead className="font-mono text-primary w-1/3">TITLE</TableHead>
                                            <TableHead className="font-mono text-primary flex-1">DESCRIPTION</TableHead>
                                            <TableHead className="font-mono text-primary w-16"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {catalogContests.map((c) => (
                                            <TableRow key={c.id} className="border-white/10">
                                                <TableCell className="font-bold">{c.title}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{c.description}</TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => deleteCatalogItem('catalog_contests', c.id, fetchCatalogContests)} className="hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
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
