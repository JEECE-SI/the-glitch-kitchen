"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { FileText, Database, Shield, Terminal, Activity, ListOrdered, Users, FlaskConical, Loader2, XCircle, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { getCatalogCycle } from "@/lib/cycleRotation";
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [activeTab, setActiveTab] = useState("intel");
    const [players, setPlayers] = useState<any[]>([]);
    const [catalogRoles, setCatalogRoles] = useState<any[]>([]);
    const [catalogContests, setCatalogContests] = useState<any[]>([]);
    const [gameId, setGameId] = useState<string | null>(null);
    const [brigadeName, setBrigadeName] = useState("");
    const [brigadeDbId, setBrigadeDbId] = useState("");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    const [brigadeRankings, setBrigadeRankings] = useState<{ name: string; code: string; best_score: number; attempt: number }[]>([]);

    // Annonce popup state
    const [showAnnoncePopup, setShowAnnoncePopup] = useState(false);
    const [annonceIntel, setAnnonceIntel] = useState<any[]>([]);
    const annonceTriggeredRef = useRef<number>(0);

    // Recipe testing state
    const [isTesting, setIsTesting] = useState(false);
    const [testAttempts, setTestAttempts] = useState(0);
    const [previousTests, setPreviousTests] = useState<any[]>([]);
    const [selectedTestResult, setSelectedTestResult] = useState<any | null>(null);
    const [showTestDetails, setShowTestDetails] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    // Ref so saveStepToDb always has the latest brigadeDbId even inside debounce callbacks
    const brigadeDbIdRef = useRef<string>("");
    // Stable ref to all brigades list — used by realtime ranking refresh
    const allBrigadesRef = useRef<{ id: string; name: string; code: string }[]>([]);

    const refreshRankings = useCallback(async () => {
        const brigades = allBrigadesRef.current;
        if (!brigades || brigades.length === 0) return;
        try {
            const { data: allTests } = await supabase
                .from('recipe_tests')
                .select('brigade_id, global_score, attempt_number')
                .in('brigade_id', brigades.map((b) => b.id));
            if (!allTests) return;
            const rankMap: Record<string, { best_score: number; attempt: number }> = {};
            for (const t of allTests) {
                if (!rankMap[t.brigade_id] || t.global_score > rankMap[t.brigade_id].best_score) {
                    rankMap[t.brigade_id] = { best_score: t.global_score, attempt: t.attempt_number };
                }
            }
            const rankings = brigades.map((b) => ({
                name: b.name,
                code: b.code,
                best_score: rankMap[b.id]?.best_score ?? -1,
                attempt: rankMap[b.id]?.attempt ?? 0,
            })).sort((a, b) => b.best_score - a.best_score);
            setBrigadeRankings(rankings);
        } catch (e) {
            console.warn('[refreshRankings] error:', e);
        }
    }, []);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // STEP 1: Fetch brigade data first (required for subsequent queries)
                const { data: brigadeRows, error: brigadeError } = await supabase
                    .from('brigades')
                    .select('*')
                    .eq('id', brigadeId)
                    .limit(1);

                if (brigadeError) {
                    console.error('[PlayerDashboard] Brigade fetch error:', brigadeError);
                    return;
                }

                const brigadeData = brigadeRows?.[0] ?? null;

                if (!brigadeData) {
                    console.warn('[PlayerDashboard] No brigade found for code:', brigadeId);
                    return;
                }

                setGameId(brigadeData.game_id);
                setBrigadeName(brigadeData.name);
                setBrigadeDbId(brigadeData.id);
                brigadeDbIdRef.current = brigadeData.id;

                // STEP 2: Parallelize all independent queries (reduces load time by ~70%)
                const [
                    gameResult,
                    playersResult,
                    logsResult,
                    staffResult,
                    invResult,
                    notesResult,
                    testsResult,
                    allBrigadesResult,
                    rolesResult,
                    contestsResult
                ] = await Promise.allSettled([
                    supabase.from('games').select('*').eq('id', brigadeData.game_id).limit(1),
                    supabase.from('players').select('*').eq('brigade_id', brigadeData.id),
                    supabase.from('game_logs').select('*').eq('game_id', brigadeData.game_id).order('created_at', { ascending: false }).limit(100),
                    supabase.from('staff').select('code').eq('game_id', brigadeData.game_id).limit(1),
                    supabase.from('inventory').select('*').eq('brigade_id', brigadeData.id).order('slot_index', { ascending: true }),
                    supabase.from('recipe_notes').select('*').eq('brigade_id', brigadeData.id).order('step_index', { ascending: true }),
                    supabase.from('recipe_tests').select('*').eq('brigade_id', brigadeData.id).order('attempt_number', { ascending: true }),
                    supabase.from('brigades').select('id, name, code').eq('game_id', brigadeData.game_id),
                    supabase.from('catalog_roles').select('*'),
                    supabase.from('catalog_contests').select('*').order('title', { ascending: true })
                ]);

                // Process game data
                if (gameResult.status === 'fulfilled' && gameResult.value.data?.[0]) {
                    setGameState(gameResult.value.data[0]);
                }

                // Process players data
                if (playersResult.status === 'fulfilled' && playersResult.value.data) {
                    setPlayers(playersResult.value.data);
                }

                // Process logs data (limit to 100 most recent to reduce memory)
                if (logsResult.status === 'fulfilled' && logsResult.value.data) {
                    setGameLogs(logsResult.value.data);
                }

                // Process staff data
                if (staffResult.status === 'fulfilled' && staffResult.value.data?.[0]) {
                    setStaffCode(staffResult.value.data[0].code);
                }

                // Process inventory data (with async initialization if needed)
                if (invResult.status === 'fulfilled') {
                    const invData = invResult.value.data;
                    if (invData && invData.length > 0) {
                        if (invData.length < 50) {
                            const existingIndices = new Set(invData.map((s: any) => s.slot_index));
                            const missingSlots = Array.from({ length: 50 }, (_, i) => i + 1)
                                .filter(idx => !existingIndices.has(idx))
                                .map(idx => ({ brigade_id: brigadeData.id, slot_index: idx, fragment_data: null }));
                            
                            // Non-blocking insert
                            supabase.from('inventory').insert(missingSlots).select().then(({ data: inserted }) => {
                                const allSlots = [...invData, ...(inserted || [])].sort((a: any, b: any) => a.slot_index - b.slot_index);
                                setInventory(allSlots);
                            });
                            setInventory(invData);
                        } else {
                            setInventory(invData);
                        }
                    } else {
                        const newInv = Array.from({ length: 50 }, (_, i) => ({
                            brigade_id: brigadeData.id,
                            slot_index: i + 1,
                            fragment_data: null
                        }));
                        supabase.from('inventory').insert(newInv).select().then(({ data: insertedSlots }) => {
                            if (insertedSlots) setInventory(insertedSlots);
                        });
                    }
                }

                // Process recipe notes data
                if (notesResult.status === 'fulfilled') {
                    const notesData = notesResult.value.data;
                    if (notesData && notesData.length > 0) {
                        const loadedSteps = Array.from({ length: 10 }, (_, i) => {
                            const note = notesData.find((n: any) => n.step_index === i + 1);
                            return {
                                fragments: note?.fragments || "",
                                ingredient: note?.ingredient || "",
                                technique: note?.technique || "",
                                tool: note?.tool || "",
                                notes: note?.notes || "",
                            };
                        });
                        setRecipeSteps(loadedSteps);
                    } else {
                        const newNotes = Array.from({ length: 10 }, (_, i) => ({
                            brigade_id: brigadeData.id,
                            step_index: i + 1,
                            fragments: "",
                            ingredient: "",
                            technique: "",
                            tool: "",
                            notes: ""
                        }));
                        supabase.from('recipe_notes').insert(newNotes);
                    }
                }

                // Process recipe tests data
                if (testsResult.status === 'fulfilled' && testsResult.value.data) {
                    setPreviousTests(testsResult.value.data);
                    setTestAttempts(testsResult.value.data.length);
                } else if (testsResult.status === 'rejected') {
                    console.warn('[PlayerDashboard] recipe_tests fetch error:', testsResult.reason);
                }

                // Process all brigades and rankings
                if (allBrigadesResult.status === 'fulfilled' && allBrigadesResult.value.data) {
                    allBrigadesRef.current = allBrigadesResult.value.data;
                    refreshRankings();
                }

                // Process catalog roles
                if (rolesResult.status === 'fulfilled' && rolesResult.value.data) {
                    setCatalogRoles(rolesResult.value.data);
                }

                // Process catalog contests
                if (contestsResult.status === 'fulfilled' && contestsResult.value.data) {
                    setCatalogContests(contestsResult.value.data);
                }

            } catch (error) {
                console.error('[PlayerDashboard] Critical error during data fetch:', error);
            }
        };
        fetchInitialData();
    }, [brigadeId, refreshRankings]);

    useEffect(() => {
        if (!gameId || !brigadeDbId) return;

        // OPTIMIZATION: Use a single shared channel for all realtime subscriptions
        // This reduces WebSocket connections from 4 per user to 1 per user
        const sharedChannel = supabase
            .channel(`game-${gameId}-brigade-${brigadeDbId}`)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'game_logs', 
                filter: `game_id=eq.${gameId}` 
            }, (payload) => {
                setGameLogs((prev) => {
                    // Limit to 100 most recent logs to prevent memory bloat
                    const updated = [payload.new, ...prev];
                    return updated.slice(0, 100);
                });
            })
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'games', 
                filter: `id=eq.${gameId}` 
            }, (payload) => {
                setGameState(payload.new);
            })
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'inventory', 
                filter: `brigade_id=eq.${brigadeDbId}` 
            }, (payload) => {
                setInventory((prev) => prev.map(item => item.id === payload.new.id ? payload.new : item));
            })
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'recipe_tests' 
            }, () => {
                // Debounce rankings refresh to avoid excessive recalculations
                refreshRankings();
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Realtime] Connected to shared channel');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('[Realtime] Channel error - attempting reconnect');
                } else if (status === 'TIMED_OUT') {
                    console.error('[Realtime] Connection timed out');
                }
            });

        return () => {
            supabase.removeChannel(sharedChannel);
        };
    }, [gameId, brigadeDbId, refreshRankings]);

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
            } catch { }
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

    // Trigger the annonce popup when the phase changes to 'annonce' for a new cycle
    // Listen directly to gameState.status (source of truth) to avoid derived-state batching issues
    useEffect(() => {
        if (!gameState?.status || !brigadeDbId || !gameId || catalogContests.length === 0) return;

        const status = gameState.status as string;
        if (!status.startsWith('annonce_c')) return;

        const cycleNum = parseInt(status.replace('annonce_c', ''), 10);
        if (isNaN(cycleNum)) return;
        if (annonceTriggeredRef.current === cycleNum) return; // already triggered for this cycle
        annonceTriggeredRef.current = cycleNum;

        // Cycle catalogue affiché pour cette session (rotation par nom: Session 1→1.x, Session 2→2.x, etc.)
        const catalogCycle = getCatalogCycle(cycleNum, gameId, gameState?.name);

        // --- Seeded random utilities ---
        const seededRng = (seed: string) => {
            let h = 0;
            for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
            return () => {
                h = (h + 0x6D2B79F5) | 0;
                let t = Math.imul(h ^ (h >>> 15), 1 | h);
                t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
        };

        const fisherShuffle = <T,>(arr: T[], rng: () => number): T[] => {
            const a = [...arr];
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(rng() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        };

        // Get the 3 contests for this cycle from catalog (rotated per session)
        const cycleContests = catalogContests
            .filter(c => c.title.match(new RegExp(`^${catalogCycle}\\.`)))
            .sort((a, b) => a.title.localeCompare(b.title))
            .slice(0, 3);

        if (cycleContests.length === 0) return;

        // Parse type & effectif from description (format: "Type | Effectif | ...")
        const parseDesc = (desc: string) => {
            const parts = desc.split(' | ');
            const rawEffectif = parts[1]?.trim() || '?';
            return { type: parts[0]?.trim() || '?', effectif: rawEffectif.replace(/Min/g, 'Minimum').replace(/Max/g, 'Maximum') };
        };

        // --- Per-brigade intel: which contest type(s) are revealed ---
        const rngType = seededRng(`${brigadeDbId}-${cycleNum}-type`);
        const indices = fisherShuffle([0, 1, 2], rngType);
        // 1 or 2 types revealed (never 0)
        const revealCount = 1 + Math.floor(rngType() * 2);
        const typeRevealSet = new Set(indices.slice(0, revealCount));

        // --- Game-wide title bonus: 2 lucky brigades get ONE contest title ---
        // IMPORTANT: Sort IDs before shuffling so all player pages agree on the same result
        // regardless of the order Supabase returns brigades in.
        const allBrigsForSeed = allBrigadesRef.current;
        const sortedBrigIds = allBrigsForSeed.map(b => b.id).sort(); // deterministic order
        const rngTitle = seededRng(`${gameId}-${cycleNum}-title`);
        const shuffledBrigIds = fisherShuffle(sortedBrigIds, rngTitle);
        // The first 2 in the shuffled list are this cycle's lucky brigades
        const luckyBrigadeIds = new Set(shuffledBrigIds.slice(0, 2));
        const isLucky = luckyBrigadeIds.has(brigadeDbId);
        // Both lucky brigades see the title of the SAME randomly picked contest
        const titleContestIndex = Math.floor(rngTitle() * cycleContests.length);

        const intel = cycleContests.map((contest, i) => {
            const contestNumber = contest.title.split('\u2014')[0]?.trim() ||
                contest.title.split('-')[0]?.trim() ||
                contest.title;
            const afterDash = contest.title.includes('\u2014')
                ? contest.title.split('\u2014').slice(1).join('\u2014').trim()
                : contest.title.includes(' — ')
                    ? contest.title.split(' — ').slice(1).join(' — ').trim()
                    : '';
            const { type, effectif } = parseDesc(contest.description);
            return {
                contestNumber: contestNumber.replace('\u2014', '').trim(),
                fullTitle: afterDash,
                type,
                effectif,
                showType: typeRevealSet.has(i),
                showTitle: isLucky && i === titleContestIndex,
            };
        });

        setAnnonceIntel(intel);
        setShowAnnoncePopup(true);
    }, [gameState, brigadeDbId, gameId, catalogContests]);

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

    // Auto-save a single step's recipe notes to Supabase
    const saveStepToDb = useCallback(async (stepIndex: number, step: typeof recipeSteps[0]) => {
        const id = brigadeDbIdRef.current;
        if (!id) {
            console.warn('[saveStepToDb] brigadeDbId not ready yet, skipping save');
            return;
        }
        const { error } = await supabase.from('recipe_notes').upsert({
            brigade_id: id,
            step_index: stepIndex + 1,
            fragments: step.fragments,
            ingredient: step.ingredient,
            technique: step.technique,
            tool: step.tool,
            notes: step.notes,
        }, { onConflict: 'brigade_id,step_index' });
        if (error) {
            console.error('[saveStepToDb] upsert error:', error);
        } else {
            console.log('[saveStepToDb] step', stepIndex + 1, 'saved ok');
        }
    }, []);

    // Also expose a full-save for the test-recipe path
    const saveRecipeToDb = useCallback(async (steps: typeof recipeSteps) => {
        if (!brigadeDbId) return;
        for (let i = 0; i < steps.length; i++) {
            await saveStepToDb(i, steps[i]);
        }
    }, [brigadeDbId, saveStepToDb]);

    const updateRecipeStep = (index: number, field: keyof typeof recipeSteps[0], value: string) => {
        const newSteps = [...recipeSteps];
        newSteps[index] = { ...newSteps[index], [field]: value };
        setRecipeSteps(newSteps);

        // Debounced save — only the modified step
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            saveStepToDb(index, newSteps[index]);
        }, 1000);
    };

    // Handle recipe test via AI
    const handleTestRecipe = async () => {
        if (isTesting || testAttempts >= 3) return;
        if (!brigadeDbId) {
            alert('Erreur : Brigade non identifiée. Rechargez la page.');
            return;
        }
        setIsTesting(true);
        // 70s client-side timeout — the route allows 60s + a little margin
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 70_000);
        try {
            // Save current recipe first
            await saveRecipeToDb(recipeSteps);

            const res = await fetch('/api/test-recipe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    brigadeId,
                    brigadeDbId,
                    recipeSteps,
                }),
                signal: abortController.signal,
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.error || 'Erreur lors du test.');
                return;
            }

            // Update state
            setTestAttempts(data.attempt_number);
            const newTest = {
                attempt_number: data.attempt_number,
                global_score: data.global_score,
                details: JSON.stringify(data),
                created_at: new Date().toISOString(),
            };
            setPreviousTests(prev => [...prev, newTest]);
            setSelectedTestResult(data);
            setShowTestDetails(true);
            refreshRankings();
        } catch (error: any) {
            console.error(error);
            if (error.name === 'AbortError') {
                alert("Délai d'analyse dépassé (> 70s). Veuillez réessayer.");
            } else {
                alert('Erreur réseau: ' + error.message);
            }
        } finally {
            clearTimeout(timeoutId);
            setIsTesting(false);
        }
    };


    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-400';
        if (score >= 50) return 'text-yellow-400';
        if (score >= 25) return 'text-orange-400';
        return 'text-red-400';
    };

    const getScoreBg = (score: number) => {
        if (score >= 80) return 'bg-green-500/20 border-green-500/50';
        if (score >= 50) return 'bg-yellow-500/20 border-yellow-500/50';
        if (score >= 25) return 'bg-orange-500/20 border-orange-500/50';
        return 'bg-red-500/20 border-red-500/50';
    };

    const getScoreRingColor = (score: number) => {
        if (score >= 80) return '#22c55e';
        if (score >= 50) return '#eab308';
        if (score >= 25) return '#f97316';
        return '#ef4444';
    };

    return (
        <div className="min-h-screen flex flex-col p-4 md:p-8 bg-background relative overflow-hidden">
            {/* Background glitch effect */}
            <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-primary/5 rounded-full blur-3xl -z-10" />
            <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-secondary/5 rounded-full blur-3xl -z-10" />

            {/* Header Info */}
            <header className="flex flex-col gap-3 pb-4 border-b border-white/5 mb-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl md:text-2xl lg:text-3xl font-black tracking-widest font-mono text-transparent bg-clip-text bg-gradient-to-r from-white to-white/50 border-l-4 border-primary pl-3 md:pl-4">
                        {brigadeName ? brigadeName.toUpperCase() : `BRIGADE_${brigadeId}`}
                    </h1>
                    <Card className="bg-white/5 border-secondary/20">
                        <CardContent className="p-2 md:p-3 flex flex-col items-center justify-center min-w-[80px] md:min-w-[100px]">
                            <span className="text-[9px] md:text-[10px] text-secondary font-mono font-bold mb-1">FRAGMENTS</span>
                            <span className="text-xl md:text-2xl font-black font-mono">{inventory.filter(s => s.fragment_data).length}<span className="text-muted-foreground text-xs md:text-sm">/50</span></span>
                        </CardContent>
                    </Card>
                </div>
                <div className="flex gap-2 w-full">
                    <Input
                        placeholder="CODE FRAGMENT..."
                        value={decryptInput}
                        onChange={e => setDecryptInput(e.target.value)}
                        className="bg-white/5 border-secondary/20 font-mono text-secondary uppercase flex-1 text-xs md:text-sm"
                    />
                    <Button
                        onClick={handleDecrypt}
                        disabled={isDecrypting || !decryptInput}
                        className="bg-secondary hover:bg-secondary/80 text-secondary-foreground font-mono text-xs md:text-sm"
                    >
                        {isDecrypting ? "..." : "DECRYPT"}
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 max-w-6xl mx-auto w-full">
                <Tabs defaultValue="intel" onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-4 bg-white/5 border border-white/10 p-1 rounded-xl gap-1">
                        <TabsTrigger value="intel" className="font-mono text-[10px] sm:text-xs md:text-sm data-[state=active]:bg-primary/20 glass-panel h-auto py-2"><span className="hidden sm:inline">INTEL_FEED</span><span className="sm:hidden">INTEL</span></TabsTrigger>
                        <TabsTrigger value="recipe" className="font-mono text-[10px] sm:text-xs md:text-sm data-[state=active]:bg-green-500/20 glass-panel h-auto py-2"><span className="hidden sm:inline">RECIPE_ASSEMBLY</span><span className="sm:hidden">RECIPE</span></TabsTrigger>
                        <TabsTrigger value="roster" className="font-mono text-[10px] sm:text-xs md:text-sm data-[state=active]:bg-secondary/20 glass-panel h-auto py-2"><span className="hidden sm:inline">BRIGADE_ROSTER</span><span className="sm:hidden">ROSTER</span></TabsTrigger>
                    </TabsList>

                    <TabsContent value="intel" className="space-y-6">
                        {/* CURRENT GAME STATUS WIDGET */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                            <div className="bg-white/5 border border-white/10 p-2 md:p-4 rounded-xl flex flex-col justify-center items-center">
                                <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono font-bold mb-1">CYCLE</span>
                                <span className="text-base md:text-xl font-black font-mono text-white">{currentCycle}/4</span>
                            </div>
                            <div className="bg-white/5 border border-white/10 p-2 md:p-4 rounded-xl flex flex-col justify-center items-center">
                                <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono font-bold mb-1">ÉTAPE</span>
                                <span className="text-[10px] md:text-sm font-black font-mono text-primary text-center leading-tight">{phaseName}</span>
                            </div>
                            <div className="bg-white/5 border border-white/10 p-2 md:p-4 rounded-xl flex flex-col justify-center items-center">
                                <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono font-bold mb-1">TIMER</span>
                                <span className={`text-lg md:text-2xl font-black font-mono ${cycleTimer <= 60 && isTimerRunning && cycleTimer > 0 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                                    {formatTime(cycleTimer)}
                                </span>
                            </div>
                            <div className="bg-white/5 border border-white/10 p-2 md:p-4 rounded-xl flex flex-col justify-center items-center flex-1">
                                <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono font-bold mb-1">GLOBAL</span>
                                <span className="text-base md:text-xl font-black font-mono text-white/70">
                                    {formatTime(globalTimer)}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                            {/* Logs - left */}
                            <Card className="glass-panel border-white/10 bg-background/50 h-[400px] flex flex-col lg:col-span-2">
                                <CardHeader className="border-b border-white/5 pb-4">
                                    <CardTitle className="font-mono text-lg flex items-center gap-2 text-primary">
                                        <Terminal className="w-5 h-5" />
                                        SYSTEM_BROADCAST
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-auto p-4 space-y-4 font-mono text-sm">
                                    {gameLogs.map(log => {
                                        let logStyle = 'border-primary text-white';
                                        if (log.event_type === 'contest_won') logStyle = 'border-yellow-500 text-yellow-500 font-bold bg-yellow-500/5 py-1 -mx-1 px-1 rounded-r border-l-4';
                                        else if (log.event_type === 'fragment_unlocked') logStyle = 'border-secondary text-secondary/90';
                                        else if (log.event_type === 'game_start' || log.event_type === 'game_finish') logStyle = 'border-red-500 text-red-400 font-bold bg-red-500/5 py-1 -mx-1 px-1 rounded-r border-l-4 tracking-wider';
                                        else if (log.event_type === 'phase_change' || log.event_type === 'cycle_change') logStyle = 'border-blue-500 text-blue-300 font-bold';
                                        else if (log.event_type === 'timer_paused') logStyle = 'border-orange-500 text-orange-400 italic';
                                        else if (log.event_type === 'timer_resumed') logStyle = 'border-green-500 text-green-400 italic';

                                        return (
                                            <div key={log.id} className={`border-l-2 pl-3 ${logStyle}`}>
                                                <span className="text-xs text-muted-foreground block mb-1">
                                                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </span>
                                                <span>{log.message}</span>
                                            </div>
                                        );
                                    })}
                                    {gameLogs.length === 0 && (
                                        <div className="border-l-2 border-primary pl-3">
                                            <span className="text-xs text-muted-foreground block mb-1">System init</span>
                                            <span className="text-white">Awaiting GM instruction to initiate operations...</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Brigade Rankings - right */}
                            <Card className="glass-panel border-white/10 bg-background/50 h-[400px] flex flex-col lg:col-span-1 shadow-2xl shadow-yellow-500/5">
                                <CardHeader className="border-b border-white/5 pb-4 bg-gradient-to-b from-white/5 to-transparent">
                                    <CardTitle className="font-mono text-lg flex items-center gap-2 text-yellow-400">
                                        <Trophy className="w-5 h-5" />
                                        RECIPE_LEADERBOARD
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-auto p-4">
                                    {brigadeRankings.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
                                            <Trophy className="w-10 h-10 text-yellow-400" />
                                            <p className="font-mono text-xs text-muted-foreground text-center">NO_SCORES_YET<br /><span className="text-[10px]">Aucune brigade n&apos;a soumis de recette</span></p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 font-mono">
                                            {brigadeRankings.map((b, idx) => {
                                                const isMe = b.code === brigadeId;
                                                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                                                const scoreColor = b.best_score < 0 ? 'text-white/20' :
                                                    b.best_score >= 80 ? 'text-green-400' :
                                                        b.best_score >= 50 ? 'text-yellow-400' :
                                                            b.best_score >= 25 ? 'text-orange-400' : 'text-red-400';

                                                const progressWidth = b.best_score < 0 ? 0 : b.best_score;
                                                const progressColor = b.best_score < 0 ? 'bg-white/5' :
                                                    b.best_score >= 80 ? 'bg-green-500' :
                                                        b.best_score >= 50 ? 'bg-yellow-500' :
                                                            b.best_score >= 25 ? 'bg-orange-500' : 'bg-red-500';

                                                return (
                                                    <div key={b.code} className={`relative overflow-hidden flex items-center justify-between p-3 py-3.5 rounded-xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-sm transition-all duration-300 hover:border-white/20 ${isMe ? 'ring-1 ring-primary ring-offset-1 ring-offset-background bg-primary/5' : ''}`}>
                                                        {/* Progress bar background */}
                                                        {b.best_score >= 0 && (
                                                            <div className={`absolute bottom-0 left-0 h-[2px] ${progressColor} opacity-70 transition-all duration-1000 ease-out`} style={{ width: `${progressWidth}%` }} />
                                                        )}

                                                        <div className="flex items-center gap-3 min-w-0 z-10">
                                                            <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-black/40 border border-white/5 text-sm shadow-inner shrink-0 ${idx < 3 ? 'ring-1 ring-yellow-500/30 bg-yellow-500/5' : ''}`}>
                                                                {medal}
                                                            </div>
                                                            <div className="min-w-0 flex flex-col justify-center">
                                                                <p className={`text-sm tracking-wide font-black truncate drop-shadow-md ${isMe ? 'text-primary' : 'text-white/90'}`}>
                                                                    {b.name}
                                                                </p>
                                                                {isMe && <span className="text-[9px] font-sans text-primary/70 uppercase tracking-widest leading-none mt-0.5">VOTRE BRIGADE</span>}
                                                            </div>
                                                        </div>

                                                        <div className="shrink-0 text-right z-10 pl-3 border-l border-white/5 flex flex-col justify-center items-end">
                                                            {b.best_score < 0 ? (
                                                                <span className="text-xs text-white/20 font-sans tracking-widest">AWAITING</span>
                                                            ) : (
                                                                <>
                                                                    <div className="flex items-baseline justify-end gap-0.5 drop-shadow-md">
                                                                        <span className={`text-xl font-black ${scoreColor} leading-none`}>{b.best_score}</span>
                                                                        <span className="text-xs font-normal text-white/50">%</span>
                                                                    </div>
                                                                    <p className="text-[9px] text-white/40 font-sans tracking-widest mt-1">ESSAI {b.attempt}/3</p>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="recipe" className="space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b border-white/10 pb-4 gap-3">
                            <div>
                                <h2 className="text-lg md:text-xl font-bold font-mono text-white flex items-center gap-2">
                                    <ListOrdered className="w-4 h-4 md:w-5 md:h-5 text-green-500" />
                                    <span className="hidden sm:inline">RECIPE_ASSEMBLY_LAB</span>
                                    <span className="sm:hidden">RECIPE_LAB</span>
                                </h2>
                                <p className="text-[10px] md:text-xs text-muted-foreground font-mono mt-1">Drag & drop fragments. Auto-saved.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className={`w-3 h-3 rounded-full border ${i <= testAttempts ? 'bg-primary border-primary' : 'border-white/20 bg-transparent'}`} title={`Essai ${i}`} />
                                    ))}
                                    <span className="text-[10px] text-muted-foreground font-mono ml-1">{testAttempts}/3</span>
                                </div>
                                <Button
                                    onClick={handleTestRecipe}
                                    disabled={isTesting || testAttempts >= 3}
                                    className={`font-mono text-xs h-9 gap-2 ${testAttempts >= 3 ? 'bg-white/10 text-muted-foreground' : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-500/20'}`}
                                    size="sm"
                                >
                                    {isTesting ? (
                                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> ANALYSE_SYSTEME...</>
                                    ) : testAttempts >= 3 ? (
                                        <><XCircle className="w-3.5 h-3.5" /> MAX_REACHED</>
                                    ) : (
                                        <><FlaskConical className="w-3.5 h-3.5" /> TEST_RECIPE</>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Previous test results summary */}
                        {previousTests.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                                {previousTests.map((test, idx) => {
                                    const details = typeof test.details === 'string' ? JSON.parse(test.details) : test.details;
                                    const score = details?.global_score || test.global_score || 0;
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                setSelectedTestResult(details);
                                                setShowTestDetails(true);
                                            }}
                                            className={`relative overflow-hidden p-4 rounded-xl border transition-all hover:scale-[1.02] cursor-pointer ${getScoreBg(score)}`}
                                        >
                                            <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-20" style={{ background: getScoreRingColor(score) }} />
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col items-start">
                                                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Essai {test.attempt_number || idx + 1}</span>
                                                    <span className="text-xs font-mono text-white/60 mt-0.5">
                                                        {test.created_at ? new Date(test.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-3xl font-black font-mono ${getScoreColor(score)}`}>{score}<span className="text-lg">%</span></span>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 items-start">
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
                                                                            placeholder="ex: Sucre, œufs..."
                                                                            className="bg-background/50 border-white/10 font-sans text-xs text-white h-8"
                                                                            value={step.ingredient}
                                                                            onChange={(e) => updateRecipeStep(index, "ingredient", e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-white font-mono text-[10px] uppercase">Technique</Label>
                                                                        <Input
                                                                            placeholder="ex: Mélanger délicatement..."
                                                                            className="bg-background/50 border-white/10 font-sans text-xs text-white h-8"
                                                                            value={step.technique}
                                                                            onChange={(e) => updateRecipeStep(index, "technique", e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-white font-mono text-[10px] uppercase">Outil(s)</Label>
                                                                        <Input
                                                                            placeholder="ex: Fouet, spatule..."
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

                        {/* Test Results Detail Modal */}
                        {showTestDetails && selectedTestResult && (
                            <Card className="glass-panel border-purple-500/30 bg-background/95 mt-4 overflow-hidden">
                                <CardHeader className="border-b border-purple-500/20 bg-gradient-to-r from-purple-500/10 to-blue-500/10 py-4">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="font-mono text-base flex items-center gap-2 text-purple-400">
                                            <Trophy className="w-5 h-5" />
                                            RÉSULTAT_SYSTEME
                                        </CardTitle>
                                        <Button variant="ghost" size="sm" className="font-mono text-xs h-7" onClick={() => setShowTestDetails(false)}>
                                            FERMER
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6">
                                    {/* Global score hero */}
                                    <div className="flex flex-col items-center mb-8">
                                        <div className="relative w-32 h-32 flex items-center justify-center mb-4">
                                            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                                                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                                                <circle
                                                    cx="50" cy="50" r="42" fill="none"
                                                    stroke={getScoreRingColor(selectedTestResult.global_score)}
                                                    strokeWidth="8"
                                                    strokeDasharray={`${(selectedTestResult.global_score / 100) * 264} 264`}
                                                    strokeLinecap="round"
                                                    className="transition-all duration-1000 ease-out"
                                                />
                                            </svg>
                                            <span className={`text-4xl font-black font-mono ${getScoreColor(selectedTestResult.global_score)}`}>
                                                {selectedTestResult.global_score}<span className="text-2xl">%</span>
                                            </span>
                                        </div>
                                        <p className="text-sm text-white/70 text-center max-w-md font-sans">
                                            {selectedTestResult.global_feedback}
                                        </p>
                                    </div>

                                    {/* Per-step breakdown */}
                                    <div className="space-y-2">
                                        <h4 className="font-mono text-xs text-muted-foreground uppercase mb-3">Détail par étape</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {selectedTestResult.steps?.map((step: any) => (
                                                <div key={step.step} className={`p-3 rounded-lg border ${getScoreBg(step.step_score)}`}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-mono text-xs text-white font-bold">STEP_{String(step.step).padStart(2, '0')}</span>
                                                        <span className={`font-mono text-lg font-black ${getScoreColor(step.step_score)}`}>{step.step_score}%</span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 mb-2">
                                                        <div className="text-center">
                                                            <div className="text-[9px] font-mono text-muted-foreground uppercase">Ingr.</div>
                                                            <div className={`text-sm font-bold font-mono ${getScoreColor(step.ingredient_score)}`}>{step.ingredient_score}%</div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-[9px] font-mono text-muted-foreground uppercase">Tech.</div>
                                                            <div className={`text-sm font-bold font-mono ${getScoreColor(step.technique_score)}`}>{step.technique_score}%</div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-[9px] font-mono text-muted-foreground uppercase">Outil</div>
                                                            <div className={`text-sm font-bold font-mono ${getScoreColor(step.tool_score)}`}>{step.tool_score}%</div>
                                                        </div>
                                                    </div>
                                                    <p className="text-[10px] text-white/60 font-sans italic">{step.feedback}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>


                    <TabsContent value="roster" className="space-y-6">
                        <Card className="glass-panel border-secondary/30">
                            <CardHeader>
                                <CardTitle className="font-mono text-secondary flex items-center gap-2">
                                    <Users className="w-5 h-5" />
                                    BRIGADE_ROSTER
                                </CardTitle>
                                <CardDescription>
                                    Liste du personnel détecté et de leur pouvoir de jeu.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {players.map((p, i) => {
                                        // Extract role title from formats like "Le Chef" or "Le Contrôleur (Resp. Qualité)"
                                        const roleTitle = p.role?.split('(')[0]?.trim() || p.role;
                                        const roleInfo = catalogRoles.find(r => r.title === roleTitle || r.title === p.role);
                                        return (
                                            <div key={i} className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col gap-3 group hover:bg-white/8 hover:border-secondary/30 transition-all duration-200">
                                                {/* Background accent */}
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-secondary/5 rounded-bl-[60px] -z-10 group-hover:bg-secondary/10 transition-colors" />
                                                {/* Header: Name + Status */}
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-secondary/15 border border-secondary/30 flex items-center justify-center shrink-0">
                                                            <Shield className="w-5 h-5 text-secondary/70" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="font-bold text-white leading-tight">{p.name}</p>
                                                            {p.role_used && <Badge variant="destructive" className="mt-1 text-[9px] font-mono px-1.5 py-0">POUVOIR UTILISÉ</Badge>}
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Role info */}
                                                <div className="border-t border-white/5 pt-3 space-y-2">
                                                    {roleInfo ? (
                                                        <>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="font-mono text-xs font-bold text-primary">{p.role}</span>
                                                                {roleInfo.power_name && (
                                                                    <span className="font-mono text-[10px] bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded-full whitespace-nowrap">{roleInfo.power_name}</span>
                                                                )}
                                                            </div>
                                                            {roleInfo.description && (
                                                                <p className="text-xs text-white/70 leading-relaxed">{roleInfo.description}</p>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="font-mono text-xs text-white/30 italic">{p.role || "NON ASSIGNÉ"}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
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

            {/* ============================================================ */}
            {/* ANNONCE POPUP — shown at the start of each cycle's annonce phase */}
            {showAnnoncePopup && annonceIntel.length > 0 && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAnnoncePopup(false); }}>
                    <div className="w-full max-w-xl animate-in fade-in zoom-in-95 duration-300">

                        {/* Header */}
                        <div className="text-center mb-5">
                            <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/40 text-primary px-4 py-1.5 rounded-full font-mono text-xs mb-3 animate-pulse">
                                <Activity className="w-3.5 h-3.5" />
                                CYCLE {currentCycle} / 4
                            </div>
                            <h2 className="text-2xl font-black font-mono text-white tracking-widest uppercase">
                                Briefing des Contests
                            </h2>
                            <p className="text-white/35 text-xs font-mono mt-1.5 max-w-sm mx-auto leading-relaxed">
                                Informations interceptées selon votre niveau d'accès brigade.
                            </p>
                        </div>

                        {/* Contest Cards */}
                        <div className="grid grid-cols-3 gap-3 mb-5">
                            {annonceIntel.map((info, i) => {
                                const typeColors: Record<string, string> = {
                                    'Mémoire': 'text-blue-400   bg-blue-400/10   border-blue-400/30',
                                    'Physique': 'text-orange-400 bg-orange-400/10 border-orange-400/30',
                                    'Social': 'text-pink-400   bg-pink-400/10   border-pink-400/30',
                                    'Coordination': 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
                                    'Dilemme': 'text-red-400    bg-red-400/10    border-red-400/30',
                                    'Logique': 'text-purple-400 bg-purple-400/10 border-purple-400/30',
                                    'Stratégie': 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
                                };
                                const typeColor = typeColors[info.type] || 'text-white/40 bg-white/5 border-white/10';

                                return (
                                    <div
                                        key={i}
                                        className={`relative bg-white/5 border rounded-xl p-4 flex flex-col items-center gap-3 overflow-hidden transition-all duration-300
                                            ${info.showTitle ? 'border-yellow-400/30 shadow-[0_0_24px_-6px_rgba(250,204,21,0.4)]' : 'border-white/10'}`}
                                    >
                                        {/* Lucky glow */}
                                        {info.showTitle && (
                                            <div className="absolute inset-0 bg-gradient-to-b from-yellow-400/5 to-transparent pointer-events-none rounded-xl" />
                                        )}

                                        {/* Contest number — always visible */}
                                        <span className="font-mono text-3xl font-black text-white tracking-tight">
                                            {info.contestNumber}
                                        </span>

                                        {/* Effectif — always visible */}
                                        <div className="w-full text-center">
                                            <div className="text-[9px] font-mono text-white/40 uppercase mb-1">Effectif</div>
                                            <span className="font-mono text-[11px] bg-white/10 border border-white/15 px-3 py-1 rounded-full text-white/70 inline-block font-bold">
                                                {info.effectif}
                                            </span>
                                        </div>

                                        {/* Type — conditionally visible */}
                                        <div className="min-h-[40px] flex flex-col items-center justify-center w-full">
                                            <div className="text-[9px] font-mono text-white/40 uppercase mb-1">Type</div>
                                            {info.showType ? (
                                                <span className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border ${typeColor} inline-block font-bold`}>
                                                    {info.type}
                                                </span>
                                            ) : (
                                                <span className="font-mono text-[9px] text-white/20 tracking-[0.2em] uppercase bg-black/30 px-2 py-0.5 rounded">INCONNU</span>
                                            )}
                                        </div>

                                        {/* Title — only for 2 lucky brigades, 1 random contest */}
                                        <div className="min-h-[44px] flex flex-col items-center justify-start w-full text-center">
                                            <div className="text-[9px] font-mono text-white/40 uppercase mb-1">Nom du Contest</div>
                                            {info.showTitle ? (
                                                <span className="font-mono text-[12px] font-bold text-yellow-300 leading-snug break-words px-2">{info.fullTitle}</span>
                                            ) : (
                                                <span className="font-mono text-[10px] text-white/20 tracking-[0.3em] font-bold">—</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Dismiss button */}
                        <div className="text-center">
                            <button
                                onClick={() => setShowAnnoncePopup(false)}
                                className="font-mono text-sm font-bold bg-primary hover:bg-primary/80 text-primary-foreground px-10 py-3 rounded-full transition-all active:scale-95 shadow-[0_0_30px_-5px_rgba(99,102,241,0.5)] hover:shadow-[0_0_40px_-5px_rgba(99,102,241,0.7)]"
                            >
                                J'AI COMPRIS — LANCER LA STRATÉGIE
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
