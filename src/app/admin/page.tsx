"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Database, Plus, Settings, Users, Server, Trash2, Settings2, PlaySquare, Square, AlertTriangle, Edit, ArrowLeftRight, PlusCircle } from "lucide-react";
import * as XLSX from "xlsx";

export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("dashboard");

    const [games, setGames] = useState<any[]>([]);
    const [brigades, setBrigades] = useState<any[]>([]);
    const [players, setPlayers] = useState<any[]>([]);
    const [staffList, setStaffList] = useState<any[]>([]);

    const [catalogRoles, setCatalogRoles] = useState<any[]>([]);
    const [catalogContests, setCatalogContests] = useState<any[]>([]);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);

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
    // massPlayers holds the list of players to be distributed: { name, poste, pool, brigade, email, junior }
    const [massPlayers, setMassPlayers] = useState<{ 
        name: string; 
        poste: string;
        pool?: number;
        brigade?: number;
        email?: string;
        junior?: string;
    }[]>([]);
    const [massManualText, setMassManualText] = useState(""); // manual input: "Prenom Nom,Poste" per line
    const [massExcelFileName, setMassExcelFileName] = useState("");

    const [playerSearchTerm, setPlayerSearchTerm] = useState("");
    const [playerGameFilter, setPlayerGameFilter] = useState("");
    const [playerBrigadeFilter, setPlayerBrigadeFilter] = useState("");

    const [isEditPlayerOpen, setIsEditPlayerOpen] = useState(false);
    const [editingPlayer, setEditingPlayer] = useState<any>(null);
    const [isSwapPlayerOpen, setIsSwapPlayerOpen] = useState(false);
    const [swapSourcePlayer, setSwapSourcePlayer] = useState<any>(null);
    const [swapTargetPlayerId, setSwapTargetPlayerId] = useState("");

    const [isEditBrigadeOpen, setIsEditBrigadeOpen] = useState(false);
    const [editingBrigade, setEditingBrigade] = useState<any>(null);

    const [brigadeSearchTerm, setBrigadeSearchTerm] = useState("");
    const [brigadeGameFilter, setBrigadeGameFilter] = useState("");

    const [activeConnections, setActiveConnections] = useState<any[]>([]);

    useEffect(() => {
        fetchGames();
        fetchBrigades();
        fetchPlayers();
        fetchStaff();
        fetchCatalogRoles();
        fetchCatalogContests();
        fetchLeaderboard();
        fetchActiveConnections();

        // Optional realtime updates
        const gamesSubscription = supabase
            .channel('public:games')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, fetchGames)
            .subscribe();

        const leaderboardSubscription = supabase
            .channel('public:recipe_tests')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'recipe_tests' }, fetchLeaderboard)
            .subscribe();

        const playersSubscription = supabase
            .channel('public:players')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
                fetchPlayers();
                fetchActiveConnections();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(gamesSubscription);
            supabase.removeChannel(leaderboardSubscription);
            supabase.removeChannel(playersSubscription);
        };
    }, []);

    const [isSeeding, setIsSeeding] = useState(false);
    const seedCatalog = async () => {
        if (!confirm('ÔÜá´©Å Cela va EFFACER et REMPLACER tous les r├┤les et contests du catalogue par les 8 r├┤les et 12 contests officiels. Continuer ?')) return;
        setIsSeeding(true);
        try {
            const res = await fetch('/api/seed-catalog', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert(`Ô£à Catalogue initialis├® ! ${data.roles.length} r├┤les et ${data.contests.length} contests cr├®├®s.`);
                fetchCatalogRoles();
                fetchCatalogContests();
            } else {
                alert('ÔØî Erreur : ' + data.error);
            }
        } catch (e: any) {
            alert('ÔØî Erreur r├®seau : ' + e.message);
        } finally {
            setIsSeeding(false);
        }
    };

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
    const fetchCatalogContests = async () => {
        const { data } = await supabase.from('catalog_contests').select('*').order('created_at', { ascending: false });
        if (data) setCatalogContests(data);
    };

    const fetchLeaderboard = async () => {
        const { data } = await supabase
            .from('recipe_tests')
            .select('*, brigades!inner(id, name, code, game_id, games!inner(id, name))')
            .order('global_score', { ascending: false })
            .limit(50);
        if (data) setLeaderboard(data);
    };

    const fetchActiveConnections = async () => {
        // Get all brigades with their player count and game info
        const { data: brigadesData } = await supabase
            .from('brigades')
            .select('id, name, code, game_id, prestige_points');
        
        if (!brigadesData) return;

        const connections = await Promise.all(
            brigadesData.map(async (brigade) => {
                const { count } = await supabase
                    .from('players')
                    .select('*', { count: 'exact', head: true })
                    .eq('brigade_id', brigade.id);
                
                const game = games.find(g => g.id === brigade.game_id);
                
                return {
                    ...brigade,
                    playerCount: count || 0,
                    gameName: game?.name || 'Unknown',
                    gameStatus: game?.status || 'unknown'
                };
            })
        );

        setActiveConnections(connections.filter(c => c.playerCount > 0));
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

            // Try to save cycleSettings ÔÇö only works after the migration_recipe_tests.sql migration is applied
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
            alert("Erreur lors de la cr├®ation : " + error.message);
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
            const parsed: { 
                name: string; 
                poste: string;
                pool?: number;
                brigade?: number;
                email?: string;
                junior?: string;
            }[] = [];
            data.forEach((row: any) => {
                const nom = row['Nom'] || row['nom'] || row['NOM'] || '';
                const prenom = row['Pr├®nom'] || row['Prenom'] || row['prenom'] || row['PRENOM'] || '';
                const poste = row['Poste'] || row['poste'] || row['POSTE'] || row['role'] || row['Role'] || row['ROLE'] || row['R├┤le'] || row['JE'] || row['je'] || '';
                const email = row['email'] || row['Email'] || row['EMAIL'] || '';
                const junior = row['junior'] || row['Junior'] || row['JUNIOR'] || '';
                const poolStr = String(row['pool'] || row['Pool'] || row['POOL'] || '');
                const brigadeStr = String(row['brigade'] || row['Brigade'] || row['BRIGADE'] || '');
                
                const fullName = `${prenom} ${nom}`.trim();
                if (fullName) {
                    const player: any = { 
                        name: fullName, 
                        poste: String(poste).trim() 
                    };
                    
                    if (poolStr && !isNaN(parseInt(poolStr))) {
                        player.pool = parseInt(poolStr);
                    }
                    if (brigadeStr && !isNaN(parseInt(brigadeStr))) {
                        player.brigade = parseInt(brigadeStr);
                    }
                    if (email) {
                        player.email = email;
                    }
                    if (junior) {
                        player.junior = junior;
                    }
                    
                    parsed.push(player);
                }
            });
            if (parsed.length > 0) {
                setMassPlayers(prev => {
                    // merge, deduplicate by name
                    const existing = new Set(prev.map(p => p.name));
                    return [...prev, ...parsed.filter(p => !existing.has(p.name))];
                });
            } else {
                alert("Aucun joueur trouv├®. V├®rifiez les colonnes 'Nom', 'Pr├®nom'.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleMassManualAdd = () => {
        const lines = massManualText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const parsed: { 
            name: string; 
            poste: string;
            pool?: number;
            brigade?: number;
        }[] = lines.map(line => {
            const parts = line.split(',').map(p => p.trim());
            const name = parts[0] || '';
            const poste = parts[1] || '';
            const poolStr = parts[2] || '';
            const brigadeStr = parts[3] || '';
            
            const player: any = { name, poste };
            if (poolStr && !isNaN(parseInt(poolStr))) {
                player.pool = parseInt(poolStr);
            }
            if (brigadeStr && !isNaN(parseInt(brigadeStr))) {
                player.brigade = parseInt(brigadeStr);
            }
            
            return player;
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
        const ROLE_MAP: Record<string, string> = {
            // 1. Le Chef (Pr├®sident) ÔÇö Voix d'Or
            "pr├®sident": "Le Chef",
            "president": "Le Chef",
            "pdg": "Le Chef",
            "ceo": "Le Chef",
            // 2. Le Bras Droit (Chef de Projet) ÔÇö Renfort
            "chef de projet": "Le Bras Droit",
            "project manager": "Le Bras Droit",
            "pm": "Le Bras Droit",
            // 3. Le Filet (Secr├®taire G├®n├®ral) ÔÇö Seconde Chance
            "secr├®taire g├®n├®ral": "Le Filet",
            "secretaire general": "Le Filet",
            "secr├®taire": "Le Filet",
            "secretaire": "Le Filet",
            // 4. L'├ëclaireur (Resp. Commercial) ÔÇö Vision
            "responsable commercial": "L'├ëclaireur",
            "resp commercial": "L'├ëclaireur",
            "commercial": "L'├ëclaireur",
            "sales": "L'├ëclaireur",
            // 5. Le Contr├┤leur (Resp. Qualit├®) ÔÇö V├®rification
            "responsable qualit├®": "Le Contr├┤leur",
            "responsable qualite": "Le Contr├┤leur",
            "resp qualit├®": "Le Contr├┤leur",
            "qualit├®": "Le Contr├┤leur",
            "qualite": "Le Contr├┤leur",
            // 6. Le D├®codeur (DSI) ÔÇö D├®cryptage
            "dsi": "Le D├®codeur",
            "si": "Le D├®codeur",
            "it": "Le D├®codeur",
            "informatique": "Le D├®codeur",
            "tech": "Le D├®codeur",
            "directeur des syst├¿mes d'information": "Le D├®codeur",
            "directeur si": "Le D├®codeur",
            // 7. Le N├®gociateur (D├®v. Commercial) ÔÇö Influence
            "d├®veloppeur commercial": "Le N├®gociateur",
            "developpeur commercial": "Le N├®gociateur",
            "bizdev": "Le N├®gociateur",
            "d├®veloppement commercial": "Le N├®gociateur",
            "dev commercial": "Le N├®gociateur",
            // 8. L'Agent Double (Resp. Communication) ÔÇö Perturbation
            "responsable communication": "L'Agent Double",
            "resp communication": "L'Agent Double",
            "communication": "L'Agent Double",
            "com": "L'Agent Double",
            "responsable com": "L'Agent Double",
        };

        const getPreferredRole = (poste: string): string | null => {
            if (!poste) return null;
            const normalized = poste.toLowerCase().trim();
            if (ROLE_MAP[normalized]) return ROLE_MAP[normalized];

            // Fallback match directly if they used the literal game role name
            const match = availableRoles.find(r => r.toLowerCase() === normalized);
            return match || null;
        };

        // Shuffle players to place them randomly in brigades
        const shuffledPlayers = [...playerList].sort(() => 0.5 - Math.random());

        // Track roles used per brigade
        const brigadeRolesUsed: Map<string, Set<string>> = new Map();
        brigadeList.forEach(b => brigadeRolesUsed.set(b.id, new Set()));

        const result: { brigade_id: string; name: string; role: string | null }[] = [];

        // Spread players out evenly across brigades
        shuffledPlayers.forEach((player, i) => {
            const brigade = brigadeList[i % brigadeList.length];
            const usedRoles = brigadeRolesUsed.get(brigade.id)!;
            const prefRole = getPreferredRole(player.poste);

            let assignedRole: string | null = null;
            if (prefRole && !usedRoles.has(prefRole)) {
                assignedRole = prefRole;
            } else {
                // If preferred role is taken or unknown, pick a random available role
                const freeRoles = availableRoles.filter(r => !usedRoles.has(r));
                if (freeRoles.length > 0) {
                    assignedRole = freeRoles[Math.floor(Math.random() * freeRoles.length)];
                } else {
                    assignedRole = null; // No roles left
                }
            }

            if (assignedRole) usedRoles.add(assignedRole);
            result.push({ brigade_id: brigade.id, name: player.name, role: assignedRole });
        });

        return result;
    };

    const massDeployInstances = async () => {
        if (!massDeployPrefix || massGameCount <= 0 || massBrigadeCount <= 0) return;
        if (massPlayers.length === 0) {
            alert("Ajoutez d'abord des joueurs ├á la liste.");
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

            // 4. Distribute Players based on pool/brigade or smart distribution
            let playersToInsert: any[] = [];
            
            // Check if players have pool/brigade assignments
            const hasPoolBrigadeInfo = massPlayers.some(p => p.pool !== undefined && p.brigade !== undefined);
            
            if (hasPoolBrigadeInfo) {
                // Group players by pool and brigade
                const playersByPoolBrigade = new Map<string, typeof massPlayers>();
                massPlayers.forEach(player => {
                    const pool = player.pool || 1;
                    const brigade = player.brigade || 1;
                    const key = `${pool}-${brigade}`;
                    if (!playersByPoolBrigade.has(key)) {
                        playersByPoolBrigade.set(key, []);
                    }
                    playersByPoolBrigade.get(key)!.push(player);
                });

                // Assign each pool-brigade group to a game brigade
                let brigadeIndex = 0;
                playersByPoolBrigade.forEach((players) => {
                    const targetBrigade = allNewBrigades[brigadeIndex % allNewBrigades.length];
                    brigadeIndex++;

                    // Track roles used in this brigade
                    const rolesUsed = new Set<string>();

                    players.forEach(player => {
                        let assignedRole = player.poste || null;
                        
                        // If role is already used in this brigade, assign a different one
                        if (assignedRole && rolesUsed.has(assignedRole)) {
                            const availableRoles = ROLES.filter(r => !rolesUsed.has(r));
                            assignedRole = availableRoles.length > 0 ? availableRoles[0] : null;
                        }
                        
                        if (assignedRole) rolesUsed.add(assignedRole);

                        playersToInsert.push({
                            brigade_id: targetBrigade.id,
                            name: player.name,
                            role: assignedRole
                        });
                    });
                });
            } else {
                // Fallback to smart distribution if no pool/brigade info
                playersToInsert = smartDistribute(massPlayers, allNewBrigades, ROLES);
            }

            const { error: playerError } = await supabase.from('players').insert(playersToInsert);
            if (playerError) throw playerError;

            setMassDeployPrefix("Session");
            setMassPlayers([]);
            setMassExcelFileName("");
            setIsMassDeployOpen(false);
            fetchGames(); fetchBrigades(); fetchStaff(); fetchPlayers();
            alert(`Succ├¿s! ${massGameCount} parties cr├®├®es, ${playersToInsert.length} joueurs r├®partis dans ${allNewBrigades.length} brigades.`);
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
            alert("Erreur lors de la cr├®ation : " + error.message);
        } finally {
            setIsCreatingBrigade(false);
        }
    };

    const ROLES = catalogRoles.map(r => r.title);

    const [isPlayerImportOpen, setIsPlayerImportOpen] = useState(false);
    const [importGameId, setImportGameId] = useState("");
    const [isImporting, setIsImporting] = useState(false);
    const [importedPlayers, setImportedPlayers] = useState<{
        name: string;
        email?: string;
        junior?: string;
        pool: number;
        brigade: number;
        role: string;
    }[]>([]);
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

            const players: {
                name: string;
                email?: string;
                junior?: string;
                pool: number;
                brigade: number;
                role: string;
            }[] = [];
            
            data.forEach((row: any) => {
                const nom = row['nom'] || row['Nom'] || row['NOM'] || '';
                const prenom = row['prenom'] || row['Prenom'] || row['Pr├®nom'] || row['PRENOM'] || '';
                const email = row['email'] || row['Email'] || row['EMAIL'] || '';
                const junior = row['junior'] || row['Junior'] || row['JUNIOR'] || '';
                const pool = parseInt(String(row['pool'] || row['Pool'] || row['POOL'] || '1'));
                const brigade = parseInt(String(row['brigade'] || row['Brigade'] || row['BRIGADE'] || '1'));
                const role = row['role'] || row['Role'] || row['ROLE'] || row['R├┤le'] || '';

                const fullName = `${prenom} ${nom}`.trim();
                if (fullName && !isNaN(pool) && !isNaN(brigade)) {
                    players.push({
                        name: fullName,
                        email: email || undefined,
                        junior: junior || undefined,
                        pool,
                        brigade,
                        role: String(role).trim()
                    });
                }
            });

            if (players.length > 0) {
                setImportedPlayers(players);
            } else {
                alert("Aucun joueur trouv├® dans le fichier. Assurez-vous d'avoir les colonnes 'prenom', 'nom', 'pool', 'brigade', et 'role'.");
            }
        };
        reader.readAsBinaryString(file);
    };


    const importAndDistributePlayers = async () => {
        if (importedPlayers.length === 0 || !importGameId) return;
        setIsImporting(true);
        try {
            // Get game brigades
            const gameBrigades = brigades.filter(b => b.game_id === importGameId);
            if (gameBrigades.length === 0) throw new Error("This game has no brigades.");

            // Group players by pool and brigade
            const playersByPoolBrigade = new Map<string, typeof importedPlayers>();
            importedPlayers.forEach(player => {
                const key = `${player.pool}-${player.brigade}`;
                if (!playersByPoolBrigade.has(key)) {
                    playersByPoolBrigade.set(key, []);
                }
                playersByPoolBrigade.get(key)!.push(player);
            });

            const playersToInsert: any[] = [];
            const brigadesByPoolBrigade = new Map<string, string>();

            // For each pool-brigade combination, assign to a game brigade
            let brigadeIndex = 0;
            playersByPoolBrigade.forEach((players, key) => {
                const targetBrigade = gameBrigades[brigadeIndex % gameBrigades.length];
                brigadesByPoolBrigade.set(key, targetBrigade.id);
                brigadeIndex++;

                // Track roles used in this brigade
                const rolesUsed = new Set<string>();

                players.forEach(player => {
                    let assignedRole = player.role || null;
                    
                    // If role is already used in this brigade, assign a different one
                    if (assignedRole && rolesUsed.has(assignedRole)) {
                        const availableRoles = ROLES.filter(r => !rolesUsed.has(r));
                        assignedRole = availableRoles.length > 0 ? availableRoles[0] : null;
                    }
                    
                    if (assignedRole) rolesUsed.add(assignedRole);

                    playersToInsert.push({
                        brigade_id: targetBrigade.id,
                        name: player.name,
                        role: assignedRole
                    });
                });
            });

            const { error } = await supabase.from('players').insert(playersToInsert);
            if (error) throw error;

            setImportedPlayers([]);
            setImportFileName("");
            setIsPlayerImportOpen(false);
            fetchPlayers();
            alert(`Succ├¿s! ${playersToInsert.length} joueurs r├®partis dans ${brigadesByPoolBrigade.size} brigades (${playersByPoolBrigade.size} pools).`);
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

    const openEditPlayer = (player: any) => {
        setEditingPlayer({ ...player });
        setIsEditPlayerOpen(true);
    };

    const updatePlayer = async () => {
        if (!editingPlayer) return;
        try {
            await supabase
                .from('players')
                .update({
                    name: editingPlayer.name,
                    role: editingPlayer.role,
                    brigade_id: editingPlayer.brigade_id
                })
                .eq('id', editingPlayer.id);
            setIsEditPlayerOpen(false);
            setEditingPlayer(null);
            fetchPlayers();
        } catch (error: any) {
            console.error(error);
            alert('Erreur lors de la mise à jour : ' + error.message);
        }
    };

    const openSwapPlayer = (player: any) => {
        setSwapSourcePlayer(player);
        setSwapTargetPlayerId("");
        setIsSwapPlayerOpen(true);
    };

    const swapPlayers = async () => {
        if (!swapSourcePlayer || !swapTargetPlayerId) return;
        try {
            const targetPlayer = players.find(p => p.id === swapTargetPlayerId);
            if (!targetPlayer) return;

            const sourceBrigadeId = swapSourcePlayer.brigade_id;
            const targetBrigadeId = targetPlayer.brigade_id;

            await supabase.from('players').update({ brigade_id: targetBrigadeId }).eq('id', swapSourcePlayer.id);
            await supabase.from('players').update({ brigade_id: sourceBrigadeId }).eq('id', targetPlayer.id);

            setIsSwapPlayerOpen(false);
            setSwapSourcePlayer(null);
            setSwapTargetPlayerId("");
            fetchPlayers();
            alert('Échange effectué avec succès !');
        } catch (error: any) {
            console.error(error);
            alert('Erreur lors de l\'échange : ' + error.message);
        }
    };

    const openEditBrigade = (brigade: any) => {
        setEditingBrigade({ ...brigade });
        setIsEditBrigadeOpen(true);
    };

    const updateBrigade = async () => {
        if (!editingBrigade) return;
        try {
            await supabase
                .from('brigades')
                .update({
                    name: editingBrigade.name,
                    code: editingBrigade.code,
                    prestige_points: editingBrigade.prestige_points
                })
                .eq('id', editingBrigade.id);
            setIsEditBrigadeOpen(false);
            setEditingBrigade(null);
            fetchBrigades();
        } catch (error: any) {
            console.error(error);
            alert('Erreur lors de la mise à jour : ' + error.message);
        }
    };

    const addAttemptToBrigade = async (brigadeId: string, brigadeName: string) => {
        if (!confirm(`Ajouter une tentative supplémentaire à ${brigadeName} ?`)) return;
        try {
            const res = await fetch('/api/add-attempt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brigadeId })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                fetchBrigades();
            } else {
                alert('Erreur : ' + (data.error || 'Unknown error'));
            }
        } catch (error: any) {
            console.error(error);
            alert('Erreur lors de l\'ajout de tentative : ' + error.message);
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

    const resetAllInstances = async () => {
        if (!confirm("ÔÜá´©Å ATTENTION : Voulez-vous vraiment r├®initialiser toutes les donn├®es de TOUTES les instances de jeu actives (objets, notes, recettes, ├®v├¿nements) ?\nLes joueurs, les ├®quipes et leurs attributions de r├┤les seront conserv├®s.")) {
            return;
        }

        try {
            const bIds = brigades.map((b: any) => b.id);
            if (bIds.length > 0) {
                await supabase.from('inventory').update({ fragment_data: null }).in('brigade_id', bIds);
                await supabase.from('recipe_notes').delete().in('brigade_id', bIds);
                await supabase.from('recipe_tests').delete().in('brigade_id', bIds);
                await supabase.from('players').update({ role_used: false }).in('brigade_id', bIds);
            }

            const gIds = games.map((g: any) => g.id);
            if (gIds.length > 0) {
                await supabase.from('game_logs').delete().in('game_id', gIds);
                const syncData = JSON.stringify({ timeLeft: 0, globalTime: 0, timerActive: false, updatedAt: Date.now(), phaseTimers: {}, contestAssignments: {} });
                await supabase.from('games').update({
                    status: 'setup',
                    active_contest: syncData
                }).in('id', gIds);
            }

            alert("Ô£à L'├®tat de l'ensemble des instances a ├®t├® r├®initialis├® avec succ├¿s !");
            fetchGames();
            fetchPlayers();
        } catch (e: any) {
            console.error("Erreur lors du reset global", e);
            alert("Une erreur s'est produite lors du reset global : " + e.message);
        }
    };

    return (
        <div className="min-h-screen flex flex-col p-3 md:p-6 bg-background">
            <header className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                <div className="flex items-center gap-3">
                    <Server className="w-6 h-6 text-primary" />
                    <div>
                        <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-white font-mono">
                            SYSADMIN_PANEL
                        </h1>
                        <p className="text-muted-foreground font-mono text-xs">Global Configuration & Provisioning</p>
                    </div>
                </div>
                <Button variant="outline" className="font-mono text-xs h-8" onClick={() => router.push("/")}>
                    EXIT_ADMIN
                </Button>
            </header>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col md:flex-row gap-4">
                <div className="w-full md:w-48 shrink-0">
                    <TabsList className="flex md:flex-col flex-row overflow-x-auto h-auto bg-transparent items-stretch md:space-y-1 space-x-1 md:space-x-0">
                        <TabsTrigger value="dashboard" className="justify-start whitespace-nowrap data-[state=active]:bg-primary/20 data-[state=active]:border-l-4 md:border-l-4 border-l-0 border-b-2 md:border-b-0 border-transparent border-primary font-mono py-2 text-xs">
                            <Database className="w-3 h-3 mr-1 md:mr-2" /> <span className="hidden sm:inline">DASHBOARD</span><span className="sm:hidden">DASH</span>
                        </TabsTrigger>
                        <TabsTrigger value="games" className="justify-start whitespace-nowrap data-[state=active]:bg-primary/20 data-[state=active]:border-l-4 md:border-l-4 border-l-0 border-b-2 md:border-b-0 border-transparent border-primary font-mono py-2 text-xs">
                            <Database className="w-3 h-3 mr-1 md:mr-2" /> GAMES
                        </TabsTrigger>
                        <TabsTrigger value="brigades" className="justify-start whitespace-nowrap data-[state=active]:bg-primary/20 data-[state=active]:border-l-4 md:border-l-4 border-l-0 border-b-2 md:border-b-0 border-transparent border-primary font-mono py-2 text-xs">
                            <Users className="w-3 h-3 mr-1 md:mr-2" /> <span className="hidden sm:inline">BRIGADES</span><span className="sm:hidden">BRIG</span>
                        </TabsTrigger>
                        <TabsTrigger value="players" className="justify-start whitespace-nowrap data-[state=active]:bg-primary/20 data-[state=active]:border-l-4 md:border-l-4 border-l-0 border-b-2 md:border-b-0 border-transparent border-primary font-mono py-2 text-xs">
                            <Users className="w-3 h-3 mr-1 md:mr-2" /> <span className="hidden sm:inline">PLAYERS</span><span className="sm:hidden">PLAY</span>
                        </TabsTrigger>
                        <TabsTrigger value="roles" className="justify-start whitespace-nowrap data-[state=active]:bg-primary/20 data-[state=active]:border-l-4 md:border-l-4 border-l-0 border-b-2 md:border-b-0 border-transparent border-primary font-mono py-2 text-xs">
                            <Database className="w-3 h-3 mr-1 md:mr-2" /> ROLES
                        </TabsTrigger>
                        <TabsTrigger value="contests" className="justify-start whitespace-nowrap data-[state=active]:bg-primary/20 data-[state=active]:border-l-4 md:border-l-4 border-l-0 border-b-2 md:border-b-0 border-transparent border-primary font-mono py-2 text-xs">
                            <Database className="w-3 h-3 mr-1 md:mr-2" /> <span className="hidden sm:inline">CONTESTS</span><span className="sm:hidden">CONT</span>
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="justify-start whitespace-nowrap data-[state=active]:bg-primary/20 data-[state=active]:border-l-4 md:border-l-4 border-l-0 border-b-2 md:border-b-0 border-transparent border-primary font-mono py-2 text-xs">
                            <Settings className="w-3 h-3 mr-1 md:mr-2" /> CONFIG
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1">
                    {/* DASHBOARD TAB */}
                    <TabsContent value="dashboard" className="mt-0">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-lg font-bold font-mono text-white">Dashboard</h2>
                            <Button variant="outline" size="sm" className="font-mono text-xs h-7" onClick={() => {
                                fetchActiveConnections();
                                fetchLeaderboard();
                                fetchGames();
                            }}>
                                🔄
                            </Button>
                        </div>

                        {/* Compact Grid Layout */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {/* Left Column - Stats */}
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="glass-panel border-white/10 bg-background/50 p-3">
                                        <div className="text-xs font-mono text-muted-foreground mb-1">GAMES</div>
                                        <div className="text-2xl font-bold font-mono">{games.length}</div>
                                        <div className="text-xs text-muted-foreground">{games.filter(g => g.status === 'active').length} active</div>
                                    </div>

                                    <div className="glass-panel border-white/10 bg-background/50 p-3">
                                        <div className="text-xs font-mono text-muted-foreground mb-1">BRIGADES</div>
                                        <div className="text-2xl font-bold font-mono">{brigades.length}</div>
                                        <div className="text-xs text-muted-foreground">{activeConnections.length} active</div>
                                    </div>

                                    <div className="glass-panel border-white/10 bg-background/50 p-3">
                                        <div className="text-xs font-mono text-muted-foreground mb-1">PLAYERS</div>
                                        <div className="text-2xl font-bold font-mono">{players.length}</div>
                                        <div className="text-xs text-muted-foreground">Total</div>
                                    </div>

                                    <div className="glass-panel border-white/10 bg-background/50 p-3">
                                        <div className="text-xs font-mono text-muted-foreground mb-1">TESTS</div>
                                        <div className="text-2xl font-bold font-mono">{leaderboard.length}</div>
                                        <div className="text-xs text-muted-foreground">Submissions</div>
                                    </div>
                                </div>

                                {/* Active Connections */}
                                <div className="glass-panel border-white/10 bg-background/50">
                                    <div className="p-3 border-b border-white/10">
                                        <div className="font-mono text-sm font-bold text-primary">Active Connections</div>
                                        <div className="text-xs text-muted-foreground">Brigades avec joueurs</div>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto">
                                        <div className="p-2 space-y-1">
                                            {activeConnections.map((conn) => (
                                                <div key={conn.id} className="flex items-center justify-between p-2 rounded hover:bg-white/5 border border-white/5">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-sm truncate">{conn.name}</div>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            <span className="font-mono">{conn.code}</span>
                                                            <span>•</span>
                                                            <span className="truncate">{conn.gameName}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 ml-2">
                                                        <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                                                            conn.gameStatus === 'active' ? 'bg-green-500/20 text-green-500' : 
                                                            conn.gameStatus === 'setup' ? 'bg-secondary/20 text-secondary' : 
                                                            'bg-muted text-muted-foreground'
                                                        }`}>
                                                            {conn.gameStatus}
                                                        </span>
                                                        <span className="font-mono font-bold text-sm">{conn.playerCount}p</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {activeConnections.length === 0 && (
                                                <div className="text-center py-8 text-muted-foreground text-xs font-mono">
                                                    NO ACTIVE CONNECTIONS
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Middle Column - Game Progress */}
                            <div className="glass-panel border-white/10 bg-background/50">
                                <div className="p-3 border-b border-white/10">
                                    <div className="font-mono text-sm font-bold text-primary">Game Progress</div>
                                    <div className="text-xs text-muted-foreground">Cycle status</div>
                                </div>
                                <div className="max-h-[500px] overflow-y-auto">
                                    <div className="p-2 space-y-1">
                                        {games.map((game) => {
                                            const gameBrigades = brigades.filter(b => b.game_id === game.id);
                                            let activeContest = 'None';
                                            try {
                                                if (game.active_contest) {
                                                    const parsed = JSON.parse(game.active_contest);
                                                    if (parsed.contestAssignments) {
                                                        const contests = Object.values(parsed.contestAssignments);
                                                        if (contests.length > 0) {
                                                            activeContest = contests[0] as string;
                                                        }
                                                    }
                                                }
                                            } catch (e) {
                                                activeContest = 'None';
                                            }
                                            
                                            return (
                                                <div key={game.id} className="p-2 rounded hover:bg-white/5 border border-white/5">
                                                    <div className="flex items-start justify-between mb-1">
                                                        <div className="font-bold text-sm">{game.name}</div>
                                                        <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                                                            game.status === 'setup' ? 'bg-secondary/20 text-secondary' : 
                                                            game.status === 'active' ? 'bg-green-500/20 text-green-500' : 
                                                            'bg-muted text-muted-foreground'
                                                        }`}>
                                                            {game.status}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground space-y-0.5">
                                                        <div>{gameBrigades.length} brigades</div>
                                                        <div className="truncate">Contest: {activeContest}</div>
                                                        <div>{new Date(game.created_at).toLocaleDateString('fr-FR')}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {games.length === 0 && (
                                            <div className="text-center py-8 text-muted-foreground text-xs font-mono">
                                                NO GAMES FOUND
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column - Leaderboard */}
                            <div className="glass-panel border-white/10 bg-background/50">
                                <div className="p-3 border-b border-white/10">
                                    <div className="font-mono text-sm font-bold text-primary">Global Leaderboard</div>
                                    <div className="text-xs text-muted-foreground">Top 10 scores</div>
                                </div>
                                <div className="max-h-[500px] overflow-y-auto">
                                    <div className="p-2 space-y-1">
                                        {leaderboard.slice(0, 10).map((entry, index) => {
                                            const brigade = entry.brigades;
                                            const game = brigade?.games;
                                            return (
                                                <div key={entry.id} className="flex items-center gap-2 p-2 rounded hover:bg-white/5 border border-white/5">
                                                    <div className="w-8 text-center font-mono font-bold">
                                                        {index === 0 && <span className="text-yellow-500">🥇</span>}
                                                        {index === 1 && <span className="text-gray-400">🥈</span>}
                                                        {index === 2 && <span className="text-orange-600">🥉</span>}
                                                        {index > 2 && <span className="text-muted-foreground text-xs">#{index + 1}</span>}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-sm truncate">{brigade?.name || 'Unknown'}</div>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            <span className="font-mono">{brigade?.code || 'N/A'}</span>
                                                            <span>•</span>
                                                            <span className="truncate">{game?.name || 'Unknown'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className={`font-mono font-bold text-lg ${
                                                            entry.global_score >= 90 ? 'text-green-500' :
                                                            entry.global_score >= 70 ? 'text-yellow-500' :
                                                            entry.global_score >= 50 ? 'text-orange-500' :
                                                            'text-red-500'
                                                        }`}>
                                                            {entry.global_score}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">/100</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {leaderboard.length === 0 && (
                                            <div className="text-center py-8 text-muted-foreground text-xs font-mono">
                                                NO SCORES YET
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* GAMES TAB */}
                    <TabsContent value="games" className="mt-0 space-y-6">
                        <div className="flex justify-between items-center bg-background z-10 sticky top-0 py-2">
                            <div>
                                <h2 className="text-2xl font-bold font-mono text-white">Instance Management</h2>
                                <p className="text-muted-foreground text-sm">Create and manage game sessions.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="destructive" className="font-mono text-xs shadow-[0_0_15px_-3px_rgba(239,68,68,0.4)]" onClick={resetAllInstances}>
                                    <AlertTriangle className="w-4 h-4 mr-2" /> RESET_ALL_INSTANCES
                                </Button>
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
                                                Cr├®ez plusieurs instances de jeu et r├®partissez intelligemment les joueurs selon leur poste.
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
                                                    <Label className="font-mono text-xs text-muted-foreground">IMPORT_EXCEL (.xlsx ÔÇö colonnes: prenom, nom, email, junior, pool, brigade, role)</Label>
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
                                                    <Label className="font-mono text-xs text-muted-foreground">SAISIE_MANUELLE (Pr├®nom Nom, Poste, Pool, Brigade ÔÇö 1 par ligne)</Label>
                                                    <textarea
                                                        className="flex min-h-[80px] w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
                                                        placeholder={"Jean Dupont, Le Chef, 1, 1\nMarie Martin, Le Filet, 1, 2"}
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
                                                        + Ajouter ├á la liste
                                                    </Button>
                                                </div>

                                                {/* Player preview */}
                                                {massPlayers.length > 0 && (
                                                    <div className="max-h-[120px] overflow-y-auto rounded border border-white/5 bg-white/5 p-2">
                                                        {massPlayers.map((p, i) => (
                                                            <div key={i} className="flex items-center justify-between text-xs font-mono py-0.5">
                                                                <span className="flex-1">{p.name}</span>
                                                                <span className="text-muted-foreground ml-2">{p.poste || 'ÔÇö'}</span>
                                                                {(p.pool !== undefined || p.brigade !== undefined) && (
                                                                    <span className="text-primary ml-2">P{p.pool || '?'}/B{p.brigade || '?'}</span>
                                                                )}
                                                                <button className="ml-2 text-destructive hover:opacity-80" onClick={() => setMassPlayers(prev => prev.filter((_, j) => j !== i))}>Ô£ò</button>
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
                                                            <Button variant="ghost" size="icon" title="Arr├¬ter" onClick={() => changeGameStatus(g.id, 'finished')} className="h-8 w-8 hover:text-orange-500"><Square className="w-4 h-4" /></Button>
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

                        <Card className="glass-panel border-white/10 bg-background/50 p-4 space-y-4">
                            <div className="flex gap-4">
                                <Input
                                    placeholder="Rechercher par nom ou code..."
                                    value={brigadeSearchTerm}
                                    onChange={(e) => setBrigadeSearchTerm(e.target.value)}
                                    className="bg-white/5 border-white/10 font-mono flex-1"
                                />
                                <select
                                    className="flex h-10 w-48 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
                                    value={brigadeGameFilter}
                                    onChange={(e) => setBrigadeGameFilter(e.target.value)}
                                >
                                    <option value="" className="bg-background text-white">Toutes les parties</option>
                                    {games.map(g => (
                                        <option key={g.id} value={g.id} className="bg-background text-white">{g.name}</option>
                                    ))}
                                </select>
                            </div>
                        </Card>

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
                                            <TableHead className="font-mono text-primary">TENTATIVES</TableHead>
                                            <TableHead className="text-right font-mono text-primary">ACTIONS</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {brigades
                                            .filter(b => {
                                                const gameName = games.find(g => g.id === b.game_id)?.name || "";
                                                const matchesSearch = !brigadeSearchTerm || 
                                                    b.name.toLowerCase().includes(brigadeSearchTerm.toLowerCase()) ||
                                                    b.code.toLowerCase().includes(brigadeSearchTerm.toLowerCase()) ||
                                                    gameName.toLowerCase().includes(brigadeSearchTerm.toLowerCase());
                                                const matchesGame = !brigadeGameFilter || b.game_id === brigadeGameFilter;
                                                return matchesSearch && matchesGame;
                                            })
                                            .map((b) => {
                                            const gameName = games.find(g => g.id === b.game_id)?.name || "Unknown Game";
                                            const staffData = staffList.find(s => s.game_id === b.game_id);
                                            return (
                                                <TableRow key={b.id} className="border-white/10 hover:bg-white/5">
                                                    <TableCell className="font-mono text-xs text-muted-foreground">{gameName}</TableCell>
                                                    <TableCell className="font-mono text-secondary text-xs">{staffData?.code || 'None'}</TableCell>
                                                    <TableCell className="font-bold">{b.name}</TableCell>
                                                    <TableCell className="font-mono text-secondary">{b.code}</TableCell>
                                                    <TableCell className="font-mono">{b.prestige_points}</TableCell>
                                                    <TableCell className="font-mono text-xs">{b.max_attempts || 3}</TableCell>
                                                    <TableCell className="text-right space-x-1">
                                                        <Button variant="ghost" size="icon" title="Ajouter une tentative" onClick={() => addAttemptToBrigade(b.id, b.name)} className="h-8 w-8 hover:text-green-500"><PlusCircle className="w-4 h-4" /></Button>
                                                        <Button variant="ghost" size="icon" title="Modifier" onClick={() => openEditBrigade(b)} className="h-8 w-8 hover:text-primary"><Edit className="w-4 h-4" /></Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                        {brigades.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground font-mono">NO BRIGADES FOUND</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Edit Brigade Dialog */}
                        <Dialog open={isEditBrigadeOpen} onOpenChange={setIsEditBrigadeOpen}>
                            <DialogContent className="glass-panel border-white/10 bg-background/95 sm:max-w-[500px]">
                                <DialogHeader>
                                    <DialogTitle className="font-mono text-xl">Modifier la brigade</DialogTitle>
                                    <DialogDescription>Modifiez les informations de la brigade.</DialogDescription>
                                </DialogHeader>
                                {editingBrigade && (
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2">
                                            <Label className="font-mono text-muted-foreground">NOM</Label>
                                            <Input
                                                value={editingBrigade.name}
                                                onChange={(e) => setEditingBrigade({ ...editingBrigade, name: e.target.value })}
                                                className="bg-white/5 border-white/10 font-mono"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className="font-mono text-muted-foreground">CODE</Label>
                                            <Input
                                                value={editingBrigade.code}
                                                onChange={(e) => setEditingBrigade({ ...editingBrigade, code: e.target.value })}
                                                className="bg-white/5 border-white/10 font-mono"
                                                maxLength={10}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className="font-mono text-muted-foreground">POINTS DE PRESTIGE</Label>
                                            <Input
                                                type="number"
                                                value={editingBrigade.prestige_points}
                                                onChange={(e) => setEditingBrigade({ ...editingBrigade, prestige_points: parseInt(e.target.value) || 0 })}
                                                className="bg-white/5 border-white/10 font-mono"
                                            />
                                        </div>
                                        <div className="p-3 bg-white/5 rounded-md border border-white/10">
                                            <Label className="font-mono text-xs text-muted-foreground">PARTIE</Label>
                                            <p className="font-mono text-sm mt-1">{games.find(g => g.id === editingBrigade.game_id)?.name || 'Unknown'}</p>
                                        </div>
                                    </div>
                                )}
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsEditBrigadeOpen(false)} className="font-mono">
                                        Annuler
                                    </Button>
                                    <Button onClick={updateBrigade} className="font-mono bg-primary hover:bg-primary/80">
                                        Enregistrer
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
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
                                                {importFileName && <p className="text-xs text-muted-foreground mt-1">Fichier s├®lectionn├® : {importFileName} ({importedPlayers.length} joueurs trouv├®s)</p>}
                                                <p className="text-xs text-muted-foreground mt-1 text-primary">Le fichier doit contenir les colonnes 'prenom', 'nom', 'pool', 'brigade', et 'role'.</p>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button
                                                onClick={importAndDistributePlayers}
                                                disabled={isImporting || importedPlayers.length === 0 || !importGameId}
                                                className="font-mono bg-secondary hover:bg-secondary/80 text-secondary-foreground w-full"
                                            >
                                                {isImporting ? "PROCESSING..." : "DISTRIBUTE_ROLES"}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>

                        <Card className="glass-panel border-white/10 bg-background/50 p-4 space-y-4">
                            <div className="flex gap-4">
                                <Input
                                    placeholder="Rechercher par nom..."
                                    value={playerSearchTerm}
                                    onChange={(e) => setPlayerSearchTerm(e.target.value)}
                                    className="bg-white/5 border-white/10 font-mono flex-1"
                                />
                                <select
                                    className="flex h-10 w-48 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
                                    value={playerGameFilter}
                                    onChange={(e) => {
                                        setPlayerGameFilter(e.target.value);
                                        setPlayerBrigadeFilter("");
                                    }}
                                >
                                    <option value="" className="bg-background text-white">Toutes les parties</option>
                                    {games.map(g => (
                                        <option key={g.id} value={g.id} className="bg-background text-white">{g.name}</option>
                                    ))}
                                </select>
                                <select
                                    className="flex h-10 w-48 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
                                    value={playerBrigadeFilter}
                                    onChange={(e) => setPlayerBrigadeFilter(e.target.value)}
                                >
                                    <option value="" className="bg-background text-white">Toutes les brigades</option>
                                    {brigades
                                        .filter(b => !playerGameFilter || b.game_id === playerGameFilter)
                                        .map(b => (
                                            <option key={b.id} value={b.id} className="bg-background text-white">{b.name} ({b.code})</option>
                                        ))}
                                </select>
                            </div>
                        </Card>

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
                                        {players
                                            .filter(p => {
                                                const brigade = brigades.find(b => b.id === p.brigade_id);
                                                const matchesSearch = !playerSearchTerm || 
                                                    p.name.toLowerCase().includes(playerSearchTerm.toLowerCase()) ||
                                                    (p.role && p.role.toLowerCase().includes(playerSearchTerm.toLowerCase()));
                                                const matchesGame = !playerGameFilter || brigade?.game_id === playerGameFilter;
                                                const matchesBrigade = !playerBrigadeFilter || p.brigade_id === playerBrigadeFilter;
                                                return matchesSearch && matchesGame && matchesBrigade;
                                            })
                                            .map((p) => {
                                            const brigade = brigades.find(b => b.id === p.brigade_id);
                                            const brigadeCode = brigade?.code || "Unknown";
                                            const gameName = games.find(g => g.id === brigade?.game_id)?.name || "Unknown Game";

                                            return (
                                                <TableRow key={p.id} className="border-white/10 hover:bg-white/5">
                                                    <TableCell className="font-bold">{p.name}</TableCell>
                                                    <TableCell className="font-mono text-secondary">{brigadeCode}</TableCell>
                                                    <TableCell className="font-mono text-xs text-muted-foreground">{p.role || "No Role"}</TableCell>
                                                    <TableCell className="font-mono text-xs text-muted-foreground">{gameName}</TableCell>
                                                    <TableCell className="text-right space-x-1">
                                                        <Button variant="ghost" size="icon" title="Modifier" onClick={() => openEditPlayer(p)} className="h-8 w-8 hover:text-primary"><Edit className="w-4 h-4" /></Button>
                                                        <Button variant="ghost" size="icon" title="Échanger" onClick={() => openSwapPlayer(p)} className="h-8 w-8 hover:text-secondary"><ArrowLeftRight className="w-4 h-4" /></Button>
                                                        <Button variant="ghost" size="icon" title="Supprimer" onClick={() => deletePlayer(p.id)} className="h-8 w-8 hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                        {players.filter(p => {
                                            const brigade = brigades.find(b => b.id === p.brigade_id);
                                            const matchesSearch = !playerSearchTerm || 
                                                p.name.toLowerCase().includes(playerSearchTerm.toLowerCase()) ||
                                                (p.role && p.role.toLowerCase().includes(playerSearchTerm.toLowerCase()));
                                            const matchesGame = !playerGameFilter || brigade?.game_id === playerGameFilter;
                                            const matchesBrigade = !playerBrigadeFilter || p.brigade_id === playerBrigadeFilter;
                                            return matchesSearch && matchesGame && matchesBrigade;
                                        }).length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground font-mono">NO PLAYERS FOUND</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Edit Player Dialog */}
                        <Dialog open={isEditPlayerOpen} onOpenChange={setIsEditPlayerOpen}>
                            <DialogContent className="glass-panel border-white/10 bg-background/95 sm:max-w-[500px]">
                                <DialogHeader>
                                    <DialogTitle className="font-mono text-xl">Modifier le joueur</DialogTitle>
                                    <DialogDescription>Modifiez les informations du joueur.</DialogDescription>
                                </DialogHeader>
                                {editingPlayer && (
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2">
                                            <Label className="font-mono text-muted-foreground">NOM</Label>
                                            <Input
                                                value={editingPlayer.name}
                                                onChange={(e) => setEditingPlayer({ ...editingPlayer, name: e.target.value })}
                                                className="bg-white/5 border-white/10 font-mono"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className="font-mono text-muted-foreground">RÔLE</Label>
                                            <select
                                                className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
                                                value={editingPlayer.role || ""}
                                                onChange={(e) => setEditingPlayer({ ...editingPlayer, role: e.target.value })}
                                            >
                                                <option value="" className="bg-background text-muted-foreground">Aucun rôle</option>
                                                {catalogRoles.map(r => (
                                                    <option key={r.id} value={r.title} className="bg-background text-white">{r.title}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className="font-mono text-muted-foreground">BRIGADE</Label>
                                            <select
                                                className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
                                                value={editingPlayer.brigade_id}
                                                onChange={(e) => setEditingPlayer({ ...editingPlayer, brigade_id: e.target.value })}
                                            >
                                                {brigades.map(b => {
                                                    const game = games.find(g => g.id === b.game_id);
                                                    return (
                                                        <option key={b.id} value={b.id} className="bg-background text-white">
                                                            {game?.name} - {b.name} ({b.code})
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                    </div>
                                )}
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsEditPlayerOpen(false)} className="font-mono">
                                        Annuler
                                    </Button>
                                    <Button onClick={updatePlayer} className="font-mono bg-primary hover:bg-primary/80">
                                        Enregistrer
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* Swap Player Dialog */}
                        <Dialog open={isSwapPlayerOpen} onOpenChange={setIsSwapPlayerOpen}>
                            <DialogContent className="glass-panel border-white/10 bg-background/95 sm:max-w-[500px]">
                                <DialogHeader>
                                    <DialogTitle className="font-mono text-xl">Échanger deux joueurs</DialogTitle>
                                    <DialogDescription>
                                        Les deux joueurs échangeront leurs brigades respectives.
                                    </DialogDescription>
                                </DialogHeader>
                                {swapSourcePlayer && (
                                    <div className="grid gap-4 py-4">
                                        <div className="p-3 bg-white/5 rounded-md border border-white/10">
                                            <Label className="font-mono text-xs text-muted-foreground">JOUEUR SOURCE</Label>
                                            <p className="font-mono font-bold mt-1">{swapSourcePlayer.name}</p>
                                            <p className="font-mono text-xs text-muted-foreground mt-1">
                                                {brigades.find(b => b.id === swapSourcePlayer.brigade_id)?.name} ({brigades.find(b => b.id === swapSourcePlayer.brigade_id)?.code})
                                            </p>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className="font-mono text-muted-foreground">JOUEUR CIBLE</Label>
                                            <select
                                                className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
                                                value={swapTargetPlayerId}
                                                onChange={(e) => setSwapTargetPlayerId(e.target.value)}
                                            >
                                                <option value="" disabled className="bg-background text-muted-foreground">Sélectionner un joueur...</option>
                                                {players
                                                    .filter(p => p.id !== swapSourcePlayer.id)
                                                    .map(p => {
                                                        const brigade = brigades.find(b => b.id === p.brigade_id);
                                                        const game = games.find(g => g.id === brigade?.game_id);
                                                        return (
                                                            <option key={p.id} value={p.id} className="bg-background text-white">
                                                                {p.name} - {game?.name} - {brigade?.name} ({brigade?.code})
                                                            </option>
                                                        );
                                                    })}
                                            </select>
                                        </div>
                                    </div>
                                )}
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsSwapPlayerOpen(false)} className="font-mono">
                                        Annuler
                                    </Button>
                                    <Button 
                                        onClick={swapPlayers} 
                                        disabled={!swapTargetPlayerId}
                                        className="font-mono bg-secondary hover:bg-secondary/80"
                                    >
                                        Échanger
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </TabsContent>

                    {/* ROLES TAB */}
                    <TabsContent value="roles" className="mt-0 space-y-6">
                        <div className="flex justify-between items-center bg-background z-10 sticky top-0 py-2">
                            <div>
                                <h2 className="text-2xl font-bold font-mono text-white">Roles Catalog</h2>
                                <p className="text-muted-foreground text-sm">Define global roles and their powers.</p>
                            </div>
                            <Button
                                onClick={seedCatalog}
                                disabled={isSeeding}
                                className="font-mono text-xs bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                            >
                                {isSeeding ? 'SEEDING...' : 'ÔÜí SEED_CATALOG (8 r├┤les + 12 contests)'}
                            </Button>
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
                                    <Input readOnly type="password" value={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'ÔÇóÔÇóÔÇóÔÇóÔÇóÔÇóÔÇóÔÇóÔÇóÔÇóÔÇóÔÇóÔÇóÔÇóÔÇóÔÇó' : 'Not configured in .env'} className="bg-white/5 border-white/10 font-mono text-muted-foreground" />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
