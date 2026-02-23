"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, ServerCrash, Terminal, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";

export default function LandingPage() {
  const [brigadeCode, setBrigadeCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brigadeCode || !playerName) return;
    setLoading(true);
    // TODO: Verify brigade code and create player with Supabase
    setTimeout(() => {
      // Mock join
      router.push(`/player/${brigadeCode.toUpperCase()}`);
    }, 1000);
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
            <CardDescription>Enter your credentials to access the brigade network.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium font-mono text-primary">PLAYER_NAME</label>
                <Input
                  type="text"
                  placeholder="e.g. NeoChef99"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="bg-background/50 border-white/10 text-white placeholder:text-muted-foreground focus-visible:ring-primary font-mono"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium font-mono text-secondary">BRIGADE_ID</label>
                <Input
                  type="text"
                  placeholder="Enter 4-digit code"
                  value={brigadeCode}
                  onChange={(e) => setBrigadeCode(e.target.value)}
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
                {loading ? "AUTHENTICATING..." : "JOIN_BRIGADE"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-white/5 pt-4 mt-2">
            <Button variant="link" className="text-xs text-muted-foreground hover:text-white" onClick={() => router.push('/gm')}>
              Initialize Game Master Override
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
