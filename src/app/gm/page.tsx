"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Users, Swords, Activity, Settings2 } from "lucide-react";
import { useGameStore } from "@/store/useGameStore";

export default function GameMasterDashboard() {
    const { game, updateGameState } = useGameStore();
    const [activeTab, setActiveTab] = useState("overview");

    // Mock game state for demo
    const [phase, setPhase] = useState("phase_0");

    const advancePhase = () => {
        // In a real app we'd trigger a Supabase update
        setPhase("cycle_1");
    };

    return (
        <div className="min-h-screen flex flex-col p-4 md:p-8">
            <header className="flex items-center justify-between pb-8">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary flex items-center gap-3">
                        <ShieldAlert className="w-8 h-8 text-primary" />
                        GM_TERMINAL
                    </h1>
                    <p className="text-muted-foreground font-mono text-sm mt-1">STATUS: {phase === "phase_0" ? "SETUP" : "ACTIVE"}</p>
                </div>
                <div className="flex gap-4">
                    <Button variant="outline" className="font-mono">
                        <Activity className="w-4 h-4 mr-2" />
                        SYSTEM_LOGS
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
                            <TabsTrigger value="contests" className="data-[state=active]:bg-primary/20"><Swords className="w-4 h-4 mr-2" /> CONTESTS</TabsTrigger>
                            <TabsTrigger value="settings" className="data-[state=active]:bg-primary/20"><Settings2 className="w-4 h-4 mr-2" /> SETTINGS</TabsTrigger>
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
                                        <div className="text-2xl font-bold font-mono text-primary uppercase">{phase.replace('_', ' ')}</div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-white/5 border-white/10">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm text-muted-foreground font-mono">ACTIVE_PLAYERS</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold font-mono">0 / 200</div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-white/5 border-white/10">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm text-muted-foreground font-mono">DEPLOYED_FRAGMENTS</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold font-mono text-secondary">0 / 15</div>
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
                                        <CardDescription>Live feed of game events, powers used, and trades.</CardDescription>
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
                                        <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 font-mono hover:text-red-500 hover:border-red-500">
                                            <ShieldAlert className="w-6 h-6" />
                                            SYSTEM_PENALTY
                                        </Button>
                                        <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 font-mono text-secondary hover:text-secondary hover:border-secondary">
                                            <Settings2 className="w-6 h-6" />
                                            GIVE_FRAGMENT
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="brigades">
                            <div className="flex items-center justify-center h-64 text-muted-foreground font-mono">
                                [BRIGADE LIST MODULE OFFLINE]
                            </div>
                        </TabsContent>

                        <TabsContent value="contests">
                            <div className="flex items-center justify-center h-64 text-muted-foreground font-mono">
                                [CONTEST CONTROL MODULE OFFLINE]
                            </div>
                        </TabsContent>

                        <TabsContent value="settings">
                            <div className="flex items-center justify-center h-64 text-muted-foreground font-mono">
                                [SYSTEM SETTINGS OFFLINE]
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    );
}
