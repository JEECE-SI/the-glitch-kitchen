"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Lock, FileText, Database, Shield, Zap, Terminal, Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function PlayerDashboard() {
    const params = useParams();
    const brigadeId = params.brigade_id as string;
    const [activeTab, setActiveTab] = useState("intel");

    return (
        <div className="min-h-screen flex flex-col p-4 md:p-8 bg-background relative overflow-hidden">
            {/* Background glitch effect */}
            <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-primary/5 rounded-full blur-3xl -z-10" />
            <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-secondary/5 rounded-full blur-3xl -z-10" />

            {/* Header Info */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-white/5 mb-8">
                <div>
                    <h1 className="text-3xl font-black tracking-widest font-mono text-transparent bg-clip-text bg-gradient-to-r from-white to-white/50 border-l-4 border-primary pl-4">
                        BRIGADE_{brigadeId}
                    </h1>
                    <p className="text-muted-foreground font-mono text-sm mt-2 pl-5 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-green-500" />
                        SECURE_CONNECTION_ESTABLISHED
                    </p>
                </div>
                <div className="flex gap-4">
                    <Card className="bg-white/5 border-primary/20">
                        <CardContent className="p-4 flex flex-col items-center justify-center min-w-[120px]">
                            <span className="text-xs text-primary font-mono font-bold mb-1">PRESTIGE (PP)</span>
                            <span className="text-3xl font-black font-mono">100</span>
                        </CardContent>
                    </Card>
                    <Card className="bg-white/5 border-secondary/20">
                        <CardContent className="p-4 flex flex-col items-center justify-center min-w-[120px]">
                            <span className="text-xs text-secondary font-mono font-bold mb-1">FRAGMENTS</span>
                            <span className="text-3xl font-black font-mono">0<span className="text-muted-foreground text-sm">/15</span></span>
                        </CardContent>
                    </Card>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 max-w-6xl mx-auto w-full">
                <Tabs defaultValue="intel" onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-4 mb-8 bg-white/5 border border-white/10 p-1 rounded-xl">
                        <TabsTrigger value="intel" className="font-mono text-xs md:text-sm data-[state=active]:bg-primary/20 glass-panel">INTEL_FEED</TabsTrigger>
                        <TabsTrigger value="inventory" className="font-mono text-xs md:text-sm data-[state=active]:bg-secondary/20 glass-panel">INVENTORY</TabsTrigger>
                        <TabsTrigger value="contests" className="font-mono text-xs md:text-sm data-[state=active]:bg-primary/20 glass-panel">ACTIVE_CONTESTS</TabsTrigger>
                        <TabsTrigger value="power" className="font-mono text-xs md:text-sm data-[state=active]:bg-destructive/20 glass-panel">EXECUTE_POWER</TabsTrigger>
                    </TabsList>

                    <TabsContent value="intel" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="glass-panel border-white/10 bg-background/50 h-[400px] flex flex-col">
                                <CardHeader className="border-b border-white/5 pb-4">
                                    <CardTitle className="font-mono text-lg flex items-center gap-2">
                                        <Terminal className="w-5 h-5 text-secondary" />
                                        SYSTEM_BROADCAST
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-auto p-4 space-y-4 font-mono text-sm">
                                    <div className="border-l-2 border-primary pl-3">
                                        <span className="text-xs text-muted-foreground block mb-1">10:00:00</span>
                                        <span className="text-white">Welcome to The Glitch Kitchen phase setup.</span>
                                    </div>
                                    <div className="border-l-2 border-secondary pl-3">
                                        <span className="text-xs text-muted-foreground block mb-1">10:05:41</span>
                                        <span className="text-white">Awaiting GM instruction to initiate Cycle 1...</span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="glass-panel border-white/10 bg-background/50 h-[400px] flex flex-col">
                                <CardHeader className="border-b border-white/5 pb-4">
                                    <CardTitle className="font-mono text-lg flex items-center gap-2 text-primary">
                                        <Shield className="w-5 h-5" />
                                        BRIGADE_ROSTER
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-auto p-4">
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between p-3 rounded bg-white/5 border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary text-primary font-bold">1</div>
                                                <span className="font-mono font-bold">NeoChef99</span>
                                            </div>
                                            <Badge variant="outline" className="text-primary border-primary">Hack_Chef</Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="inventory" className="space-y-6">
                        <Card className="glass-panel border-white/10">
                            <CardHeader>
                                <CardTitle className="font-mono text-secondary">DECRYPTED_FRAGMENTS</CardTitle>
                                <CardDescription>Assemble these to form the final recipe.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    {Array.from({ length: 15 }).map((_, i) => (
                                        <div key={i} className="aspect-square rounded-lg border-2 border-dashed border-white/10 flex flex-col items-center justify-center p-4 relative group hover:border-secondary/50 transition-colors">
                                            <Lock className="w-8 h-8 text-white/20 mb-2 group-hover:text-secondary/50 transition-colors" />
                                            <span className="font-mono text-xs text-white/30">SLOT_{i + 1}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                            <CardFooter className="border-t border-white/5 justify-end">
                                <Button variant="outline" className="font-mono" disabled>
                                    SUBMIT_RECIPE (0/15)
                                </Button>
                            </CardFooter>
                        </Card>
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

                    <TabsContent value="power">
                        <Card className="glass-panel border-destructive/30">
                            <CardHeader>
                                <CardTitle className="font-mono text-destructive flex items-center gap-2">
                                    <Zap className="w-5 h-5" />
                                    ROLE_OVERRIDE_CAPABILITY
                                </CardTitle>
                                <CardDescription>
                                    Your unique brigade capability. WARNING: Can only be executed ONCE per simulation.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="h-48 flex items-center justify-center flex-col">
                                <p className="mb-6 font-mono text-center text-sm md:text-base max-w-lg">
                                    [ROLE_NOT_ASSIGNED] Please wait for game synchronization to receive your capability protocol.
                                </p>
                                <Button disabled variant="destructive" className="font-mono opacity-50 glitch-hover">
                                    INITIATE_OVERRIDE
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

        </div>
    );
}
