"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Users, Swords, Activity, ArrowLeft } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function GameMasterDashboard() {
    const params = useParams();
    const router = useRouter();
    const gameId = params.game_id as string;

    const [game, setGame] = useState<any>(null);
    const [brigades, setBrigades] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState("overview");

    const fetchGame = useCallback(async () => {
        const { data } = await supabase.from('games').select('*').eq('id', gameId).single();
        if (data) setGame(data);
    }, [gameId]);

    const fetchBrigades = useCallback(async () => {
        const { data } = await supabase.from('brigades').select('*').eq('game_id', gameId).order('name', { ascending: true });
        if (data) setBrigades(data);
    }, [gameId]);

    useEffect(() => {
        if (!gameId) return;

        fetchGame();
        fetchBrigades();

        const channel = supabase.channel(`game-${gameId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, fetchGame)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'brigades', filter: `game_id=eq.${gameId}` }, fetchBrigades)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [gameId, fetchGame, fetchBrigades]);

    const advancePhase = async () => {
        if (!game) return;

        let nextStatus = 'active';
        if (game.status === 'setup') nextStatus = 'cycle_1';
        else if (game.status === 'cycle_1') nextStatus = 'cycle_2';
        else if (game.status === 'cycle_2') nextStatus = 'cycle_3';
        else nextStatus = 'finished';

        await supabase.from('games').update({ status: nextStatus }).eq('id', gameId);
    };

    if (!game) return <div className="p-8 text-white font-mono flex items-center gap-4"><Activity className="animate-spin" /> CONNECTING TO GAME ENGINE...</div>;

    return (
        <div className="min-h-screen flex flex-col p-4 md:p-8">
            <header className="flex items-center justify-between pb-8">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary flex items-center gap-3">
                        <ShieldAlert className="w-8 h-8 text-primary" />
                        GM_TERMINAL : {game.name}
                    </h1>
                    <p className="text-muted-foreground font-mono text-sm mt-1">STATUS: {game.status.toUpperCase()}</p>
                </div>
                <div className="flex gap-4">
                    <Button variant="outline" className="font-mono text-muted-foreground" onClick={() => router.push('/admin')}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        BACK TO ADMIN
                    </Button>
                    <Button onClick={advancePhase} className="font-mono bg-destructive hover:bg-destructive/80 text-white">
                        ADVANCE_PHASE
                    </Button>
                </div>
            </header>

            <div className="flex-1 border rounded-lg glass-panel overflow-hidden">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                    <div className="border-b px-4 py-3 bg-white/5">
                        <TabsList className="bg-transparent space-x-2">
                            <TabsTrigger value="overview" className="data-[state=active]:bg-primary/20"><Activity className="w-4 h-4 mr-2" /> OVERVIEW</TabsTrigger>
                            <TabsTrigger value="brigades" className="data-[state=active]:bg-primary/20"><Users className="w-4 h-4 mr-2" /> BRIGADES</TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 p-6 overflow-auto">
                        <TabsContent value="overview" className="mt-0 h-full flex flex-col gap-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <Card className="bg-white/5 border-white/10">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm text-muted-foreground font-mono">CURRENT_PHASE</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold font-mono text-primary uppercase">{game.status.replace('_', ' ')}</div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-white/5 border-white/10">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm text-muted-foreground font-mono">BRIGADES</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold font-mono">{brigades.length}</div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-white/5 border-white/10">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm text-muted-foreground font-mono">DEPLOYED_FRAGMENTS</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold font-mono text-secondary">0 / 50</div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-white/5 border-white/10">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm text-muted-foreground font-mono">SYSTEM_LOAD</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold font-mono text-green-500">OPTIMAL</div>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
                                <Card className="bg-white/5 border-white/10 flex flex-col">
                                    <CardHeader>
                                        <CardTitle>Recent Network Activity</CardTitle>
                                        <CardDescription>Live feed of game events.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-1 min-h-[300px] flex items-center justify-center border-t border-white/5">
                                        <p className="text-muted-foreground font-mono text-sm opacity-50">NO NEW EVENTS DETECTED</p>
                                    </CardContent>
                                </Card>

                                <Card className="bg-white/5 border-white/10 flex flex-col">
                                    <CardHeader>
                                        <CardTitle>Quick Actions</CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-2 gap-4">
                                        <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 font-mono">
                                            <Swords className="w-6 h-6" />
                                            INIT_CONTEST
                                        </Button>
                                        <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 font-mono">
                                            <Users className="w-6 h-6" />
                                            GRANT_PP
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="brigades" className="mt-0">
                            <Card className="glass-panel border-white/10 bg-background/50">
                                <CardHeader>
                                    <CardTitle>Brigade Details</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader className="bg-white/5">
                                            <TableRow className="border-white/10 hover:bg-transparent">
                                                <TableHead className="font-mono text-primary">NAME</TableHead>
                                                <TableHead className="font-mono text-primary">CODE</TableHead>
                                                <TableHead className="font-mono text-primary">PRESTIGE</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {brigades.map((b) => (
                                                <TableRow key={b.id} className="border-white/10 hover:bg-white/5">
                                                    <TableCell className="font-bold">{b.name}</TableCell>
                                                    <TableCell className="font-mono text-secondary">{b.code}</TableCell>
                                                    <TableCell className="font-mono">{b.prestige_points}</TableCell>
                                                </TableRow>
                                            ))}
                                            {brigades.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground font-mono">NO BRIGADES IN GAME</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    );
}
