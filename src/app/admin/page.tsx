"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, Plus, Settings, Users, Server, Trash2, Edit } from "lucide-react";

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState("games");

    // Mock Data
    const [games, setGames] = useState([
        { id: "game-001", name: "Glitch Kitchen - Session Paris", status: "setup", created_at: "2026-02-23" },
        { id: "game-002", name: "Glitch Kitchen - Session Lyon", status: "finished", created_at: "2026-02-20" },
    ]);

    const [brigades, setBrigades] = useState([
        { id: "brig-001", name: "Red Phantoms", number: 1, game_id: "game-001", players: 10 },
        { id: "brig-002", name: "Neon Vipers", number: 2, game_id: "game-001", players: 8 },
    ]);

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
                <Button variant="outline" className="font-mono text-xs" onClick={() => window.location.href = "/"}>
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
                        <TabsTrigger value="settings" className="justify-start data-[state=active]:bg-primary/20 data-[state=active]:border-l-4 border-l-4 border-transparent border-primary font-mono py-3">
                            <Settings className="w-4 h-4 mr-3" /> GLOBAL_CONFIG
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1">
                    {/* GAMES TAB */}
                    <TabsContent value="games" className="mt-0 space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold font-mono text-white">Instance Management</h2>
                                <p className="text-muted-foreground text-sm">Create and manage game sessions.</p>
                            </div>
                            <Button className="font-mono bg-primary hover:bg-primary/80">
                                <Plus className="w-4 h-4 mr-2" /> NEW_GAME
                            </Button>
                        </div>

                        <Card className="glass-panel border-white/10 bg-background/50">
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-white/5">
                                        <TableRow className="border-white/10 hover:bg-transparent">
                                            <TableHead className="font-mono text-primary">ID</TableHead>
                                            <TableHead className="font-mono text-primary">NAME</TableHead>
                                            <TableHead className="font-mono text-primary">STATUS</TableHead>
                                            <TableHead className="font-mono text-primary">CREATED_DATE</TableHead>
                                            <TableHead className="text-right font-mono text-primary">ACTIONS</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {games.map((g) => (
                                            <TableRow key={g.id} className="border-white/10 hover:bg-white/5">
                                                <TableCell className="font-mono text-xs text-muted-foreground">{g.id}</TableCell>
                                                <TableCell className="font-bold">{g.name}</TableCell>
                                                <TableCell>
                                                    <span className={`px-2 py-1 rounded text-xs font-mono uppercase ${g.status === 'setup' ? 'bg-secondary/20 text-secondary' : 'bg-muted text-muted-foreground'}`}>
                                                        {g.status}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm font-mono">{g.created_at}</TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-secondary"><Edit className="w-4 h-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Quick Game Creation Form */}
                        <Card className="glass-panel border-white/10 bg-background/50 mt-8">
                            <CardHeader>
                                <CardTitle className="font-mono text-lg">Initialize New Instance</CardTitle>
                                <CardDescription>Setup a new Game environment for an event.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="font-mono text-muted-foreground">GAME_NAME</Label>
                                        <Input placeholder="e.g. Corporate Event 2026" className="bg-white/5 border-white/10 font-mono" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-mono text-muted-foreground">BRIGADE_COUNT</Label>
                                        <Input type="number" defaultValue={20} className="bg-white/5 border-white/10 font-mono" />
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="justify-end border-t border-white/10 pt-4">
                                <Button className="font-mono bg-secondary hover:bg-secondary/80 text-secondary-foreground">DEPLOY_INSTANCE</Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>

                    {/* BRIGADES TAB */}
                    <TabsContent value="brigades" className="mt-0 space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold font-mono text-white">Brigade Roster</h2>
                                <p className="text-muted-foreground text-sm">Manage teams and assign them to games.</p>
                            </div>
                            <Button className="font-mono bg-primary hover:bg-primary/80">
                                <Plus className="w-4 h-4 mr-2" /> ADD_BRIGADE
                            </Button>
                        </div>

                        <Card className="glass-panel border-white/10 bg-background/50">
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-white/5">
                                        <TableRow className="border-white/10 hover:bg-transparent">
                                            <TableHead className="font-mono text-primary">#</TableHead>
                                            <TableHead className="font-mono text-primary">NAME</TableHead>
                                            <TableHead className="font-mono text-primary">GAME_ID</TableHead>
                                            <TableHead className="font-mono text-primary">PLAYERS</TableHead>
                                            <TableHead className="text-right font-mono text-primary">ACTIONS</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {brigades.map((b) => (
                                            <TableRow key={b.id} className="border-white/10 hover:bg-white/5">
                                                <TableCell className="font-mono text-xl font-bold">{b.number}</TableCell>
                                                <TableCell className="font-bold">{b.name}</TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground">{b.game_id}</TableCell>
                                                <TableCell className="font-mono">{b.players} / 10</TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-secondary"><Edit className="w-4 h-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
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
                                <p className="text-muted-foreground text-sm">Tweak global timers and connection strings.</p>
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

                        <Card className="glass-panel border-white/10 bg-background/50">
                            <CardHeader>
                                <CardTitle className="font-mono text-lg text-secondary">Game Mechanics Tuning</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="font-mono text-muted-foreground">DEFAULT_CYCLE_TIME (seconds)</Label>
                                    <Input type="number" defaultValue={1500} className="bg-white/5 border-white/10 font-mono" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-mono text-muted-foreground">STARTING_PRESTIGE_POINTS</Label>
                                    <Input type="number" defaultValue={100} className="bg-white/5 border-white/10 font-mono" />
                                </div>
                            </CardContent>
                            <CardFooter className="justify-end border-t border-white/10 pt-4">
                                <Button className="font-mono bg-primary hover:bg-primary/80">SAVE_CONFIG</Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
