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

    useEffect(() => {
        const fetchPlayers = async () => {
            const { data: brigadeData } = await supabase.from('brigades').select('id').eq('code', brigadeId).single();
            if (brigadeData) {
                const { data: playersData } = await supabase.from('players').select('*').eq('brigade_id', brigadeData.id);
                if (playersData) setPlayers(playersData);
            }
        };
        fetchPlayers();
    }, [brigadeId]);

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
                    </p>
                </div>
                <div className="flex gap-2">
                    <Card className="bg-white/5 border-primary/20">
                        <CardContent className="p-3 flex flex-col items-center justify-center min-w-[100px]">
                            <span className="text-[10px] text-primary font-mono font-bold mb-1">PRESTIGE</span>
                            <span className="text-2xl font-black font-mono">100</span>
                        </CardContent>
                    </Card>
                    <Card className="bg-white/5 border-secondary/20">
                        <CardContent className="p-3 flex flex-col items-center justify-center min-w-[100px]">
                            <span className="text-[10px] text-secondary font-mono font-bold mb-1">FRAGMENTS</span>
                            <span className="text-2xl font-black font-mono">0<span className="text-muted-foreground text-sm">/15</span></span>
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
                                        {Array.from({ length: 15 }).map((_, i) => (
                                            <div
                                                key={i}
                                                draggable
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData("text/plain", `#${i + 1}`);
                                                }}
                                                className="aspect-square rounded border border-secondary/20 bg-secondary/5 flex flex-col items-center justify-center p-2 relative group hover:bg-secondary/20 hover:border-secondary/50 transition-colors cursor-grab active:cursor-grabbing"
                                                title="Drag me to a step"
                                            >
                                                <FileText className="w-5 h-5 text-secondary/70 mb-1 group-hover:text-secondary transition-colors pointer-events-none" />
                                                <span className="font-mono text-[10px] font-bold text-secondary/90 pointer-events-none">#{i + 1}</span>
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

        </div>
    );
}
