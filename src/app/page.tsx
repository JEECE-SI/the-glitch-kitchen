"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, ServerCrash, Terminal, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LandingPage() {
  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  const handleJoin = async (e: React.FormEvent, role: 'player' | 'staff' | 'admin') => {
    e.preventDefault();
    if (!accessCode) return;
    setLoading(true);
    setErrorMsg("");

    const codeUpper = accessCode.toUpperCase();

    try {
      if (role === 'admin') {
        // 1. Check Admin Password
        if (accessCode === 'fnpéç39J0') {
          const res = await fetch('/api/auth', { method: 'POST', body: JSON.stringify({ role: 'admin', id: 'admin' }) });
          if (res.ok) {
            router.push('/admin');
            return;
          }
        }
        setErrorMsg("Admin password incorrect.");
      } else {
        // Since we need supabase client
        const { supabase } = await import('@/lib/supabase/client');

        if (role === 'player') {
          // 2. Check Player (Brigade code)
          const { data: bData } = await supabase.from('brigades').select('id').eq('code', codeUpper).maybeSingle();
          if (bData) {
            const res = await fetch('/api/auth', { method: 'POST', body: JSON.stringify({ role: 'player', id: bData.id }) });
            if (res.ok) {
              router.push(`/player/${bData.id}`);
              return;
            }
          }
          setErrorMsg("Brigade code incorrect or not found.");
        } else if (role === 'staff') {
          // 3. Check Staff code
          const { data: sData } = await supabase.from('staff').select('game_id').eq('code', codeUpper).maybeSingle();
          if (sData) {
            const res = await fetch('/api/auth', { method: 'POST', body: JSON.stringify({ role: 'staff', id: sData.game_id }) });
            if (res.ok) {
              router.push(`/staff/${sData.game_id}`);
              return;
            }
          }
          setErrorMsg("Staff code incorrect or not found.");
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred during authentication.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Title Section */}
        <div className="flex flex-col justify-center space-y-6 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start space-x-4 mb-2">
            <ChefHat className="w-12 h-12 text-primary" />
            <ServerCrash className="w-10 h-10 text-secondary" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase relative">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
              The Glitch
            </span>
            <br />
            <span className="text-white">Kitchen</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto md:mx-0">
            A real-time culinary cyber-warfare. Form your brigade, decrypt the fragments, and assemble the ultimate recipe before the system crashes.
          </p>
          <div className="flex items-center justify-center md:justify-start space-x-4 text-sm text-muted-foreground pt-4">
            <span className="flex items-center gap-1"><Terminal className="w-4 h-4" /> 200 Players</span>
            <span className="flex items-center gap-1"><Skull className="w-4 h-4" /> 2h30 Game Time</span>
          </div>
        </div>

        {/* Login Form */}
        <Card className="glass-panel border-primary/20 bg-background/40 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold font-mono">SYSTEM_LOGIN</CardTitle>
            <CardDescription>Enter your credentials to access the selected network.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="player" className="w-full" onValueChange={() => { setAccessCode(""); setErrorMsg(""); }}>
              <TabsList className="grid w-full grid-cols-3 mb-6 bg-background/50 border border-white/10">
                <TabsTrigger value="player" className="font-mono text-xs">PLAYER</TabsTrigger>
                <TabsTrigger value="staff" className="font-mono text-xs">STAFF</TabsTrigger>
                <TabsTrigger value="admin" className="font-mono text-xs">ADMIN</TabsTrigger>
              </TabsList>

              <TabsContent value="player">
                <form onSubmit={(e) => handleJoin(e, 'player')} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium font-mono text-secondary">BRIGADE_CODE</label>
                    <Input
                      type="text"
                      placeholder="Enter brigade code"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      className="bg-background/50 border-white/10 text-white placeholder:text-muted-foreground focus-visible:ring-secondary uppercase font-mono tracking-widest"
                      maxLength={6}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full font-mono font-bold bg-primary hover:bg-primary/80 text-primary-foreground mt-6 transition-all glitch-hover"
                    disabled={loading}
                  >
                    {loading ? "AUTHENTICATING..." : "ACCESS_NETWORK"}
                  </Button>
                  {errorMsg && (
                    <p className="text-red-500 text-xs font-mono font-bold text-center mt-2">{errorMsg}</p>
                  )}
                </form>
              </TabsContent>

              <TabsContent value="staff">
                <form onSubmit={(e) => handleJoin(e, 'staff')} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium font-mono text-secondary">STAFF_CODE</label>
                    <Input
                      type="text"
                      placeholder="Enter staff code"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      className="bg-background/50 border-white/10 text-white placeholder:text-muted-foreground focus-visible:ring-secondary uppercase font-mono tracking-widest"
                      maxLength={10}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full font-mono font-bold bg-secondary hover:bg-secondary/80 text-secondary-foreground mt-6 transition-all glitch-hover"
                    disabled={loading}
                  >
                    {loading ? "AUTHENTICATING..." : "STAFF_LOGIN"}
                  </Button>
                  {errorMsg && (
                    <p className="text-red-500 text-xs font-mono font-bold text-center mt-2">{errorMsg}</p>
                  )}
                </form>
              </TabsContent>

              <TabsContent value="admin">
                <form onSubmit={(e) => handleJoin(e, 'admin')} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium font-mono text-secondary">ROOT_PASSWORD</label>
                    <Input
                      type="password"
                      placeholder="Enter admin password"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      className="bg-background/50 border-white/10 text-white placeholder:text-muted-foreground focus-visible:ring-secondary font-mono tracking-widest"
                      maxLength={20}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full font-mono font-bold bg-destructive hover:bg-destructive/80 text-destructive-foreground mt-6 transition-all glitch-hover"
                    disabled={loading}
                  >
                    {loading ? "AUTHENTICATING..." : "ROOT_ACCESS"}
                  </Button>
                  {errorMsg && (
                    <p className="text-red-500 text-xs font-mono font-bold text-center mt-2">{errorMsg}</p>
                  )}
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
