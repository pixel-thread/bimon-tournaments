"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Gamepad2, Trophy, ChevronRight, Zap, Loader2 } from "lucide-react";
import { Avatar } from "@heroui/react";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";
import { MySlotPage } from "@/components/game/my-slot-page";

interface GameMeta {
    id: string;
    name: string;
    tagline: string;
    emoji: string;
    image: string;
    href: string;
    gradient: string;
    glowColor: string;
    accentClass: string;
}

const GAMES: GameMeta[] = [
    {
        id: "memory",
        name: "Memory Game",
        tagline: "Match pairs · Test your memory",
        emoji: "🧠",
        image: "/images/game-memory.png",
        href: "/games/memory",
        gradient: "linear-gradient(135deg, #7c3aed 0%, #a855f7 40%, #c084fc 100%)",
        glowColor: "rgba(168, 85, 247, 0.3)",
        accentClass: "text-purple-400",
    },
    {
        id: "number-rush",
        name: "Number Rush",
        tagline: "Tap 1→30 · Fastest time wins",
        emoji: "⚡",
        image: "/images/game-number-rush.png",
        href: "/games/number-rush",
        gradient: "linear-gradient(135deg, #d97706 0%, #f59e0b 40%, #fbbf24 100%)",
        glowColor: "rgba(245, 158, 11, 0.3)",
        accentClass: "text-amber-400",
    },
];

function GameCard({ game, index, stats }: { game: GameMeta; index: number; stats?: { myBest: number; topScore: number; topPlayerImage: string | null; topPlayerName: string; prize: number } }) {
    const router = useRouter();
    const [navigating, setNavigating] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: index * 0.1, type: "spring", stiffness: 200, damping: 20 }}
        >
            <div
                onClick={() => {
                    if (navigating) return;
                    setNavigating(true);
                    router.push(game.href);
                }}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.06] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] h-36 sm:h-40 cursor-pointer"
                style={{ background: game.gradient }}
            >
                {/* Banner image */}
                <img
                    src={game.image}
                    alt={game.name}
                    className="absolute inset-0 w-full h-full object-cover"
                />

                {/* Gradient overlay — strong for readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" />

                {/* Accent bar */}
                <div
                    className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{ background: game.gradient }}
                />

                {/* Content overlaid at bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="flex items-center justify-between">
                        <div style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                            <h2 className="text-base font-bold tracking-tight text-white">{game.name}</h2>
                            <p className="text-[11px] text-white/50 mt-0.5">{game.tagline}</p>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
                            {navigating ? (
                                <Loader2 className="h-4 w-4 text-white/80 animate-spin" />
                            ) : (
                                <ChevronRight className="h-4 w-4 text-white/50 group-hover:text-white/80 transition-colors" />
                            )}
                        </div>
                    </div>

                    {/* Stats row */}
                    {stats && (
                        <div className="mt-2.5 flex items-center gap-4" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>
                            {stats.myBest > 0 && (
                                <div className="flex items-center gap-1.5">
                                    <Trophy className="h-3 w-3 text-white/40" />
                                    <span className="text-[11px] text-white/50">Your Best: <span className="font-semibold text-white/80">{stats.myBest}</span></span>
                                </div>
                            )}
                            {stats.topScore > 0 && (
                                <div className="flex items-center gap-1.5">
                                    <Avatar src={stats.topPlayerImage || undefined} name={stats.topPlayerName} className="h-4 w-4 shrink-0 text-[6px]" />
                                    <span className="text-[11px] text-white/50">Top: <span className="font-semibold text-white/80">{stats.topScore}</span></span>
                                </div>
                            )}
                            {stats.prize > 0 && (
                                <div className="flex items-center gap-1.5">
                                    <Zap className="h-3 w-3 text-success/80" />
                                    <span className="text-[11px] text-success font-semibold">
                                        Free {stats.prize} <CurrencyIcon size={9} />
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

export default function GamesPage() {
    // Check if player is in an active tournament
    const { data: myGameData, isLoading: myGameLoading } = useQuery({
        queryKey: ["my-game"],
        queryFn: () => fetch("/api/my-game").then(r => r.json()),
        staleTime: 30_000,
    });

    // If in tournament → show My Slot page
    if (myGameData?.active) {
        return <MySlotPage />;
    }

    // Otherwise → show Arcade
    return <ArcadePage />;
}

function ArcadePage() {
    // Fetch stats for both games
    const { data: memoryData } = useQuery({
        queryKey: ["game-hub", "memory"],
        queryFn: async () => {
            const res = await fetch("/api/games/leaderboard?game=memory");
            return res.json();
        },
        staleTime: 60_000,
    });

    const { data: rushData } = useQuery({
        queryKey: ["game-hub", "number-rush"],
        queryFn: async () => {
            const res = await fetch("/api/games/leaderboard?game=number-rush");
            return res.json();
        },
        staleTime: 60_000,
    });

    function getStats(data: Record<string, unknown> | undefined) {
        if (!data) return undefined;
        const scores = (data.scores || []) as { score: number; imageUrl?: string | null; displayName?: string }[];
        const rewards = (data.rewards || {}) as Record<string, number>;
        return {
            myBest: (data.myBest || 0) as number,
            topScore: scores[0]?.score || 0,
            topPlayerImage: (scores[0]?.imageUrl || null) as string | null,
            topPlayerName: (scores[0]?.displayName || "") as string,
            prize: rewards["1"] || 0,
        };
    }

    const statsMap: Record<string, ReturnType<typeof getStats>> = {
        memory: getStats(memoryData),
        "number-rush": getStats(rushData),
    };

    return (
        <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
            {/* Banner */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 relative overflow-hidden rounded-2xl"
            >
                <img
                    src="/images/arcade-banner.png"
                    alt="Arcade"
                    className="w-full h-32 sm:h-36 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
                            <Gamepad2 className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight text-white">Arcade</h1>
                            <p className="text-xs text-white/50">Play · Compete · Win prizes</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Game cards */}
            <div className="space-y-3">
                {GAMES.map((game, i) => (
                    <GameCard
                        key={game.id}
                        game={game}
                        index={i}
                        stats={statsMap[game.id]}
                    />
                ))}
            </div>

            {/* Bottom hint */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-6 text-center text-[11px] text-foreground/20"
            >
                More games coming soon
            </motion.p>
        </div>
    );
}
