"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Gamepad2, Trophy, Users, Timer, ChevronRight, Zap } from "lucide-react";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";

interface GameMeta {
    id: string;
    name: string;
    tagline: string;
    emoji: string;
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
        href: "/games/number-rush",
        gradient: "linear-gradient(135deg, #d97706 0%, #f59e0b 40%, #fbbf24 100%)",
        glowColor: "rgba(245, 158, 11, 0.3)",
        accentClass: "text-amber-400",
    },
];

function GameCard({ game, index, stats }: { game: GameMeta; index: number; stats?: { myBest: number; topScore: number; prize: number } }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: index * 0.1, type: "spring", stiffness: 200, damping: 20 }}
        >
            <Link href={game.href}>
                <div
                    className="group relative overflow-hidden rounded-2xl border border-white/[0.06] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                        background: `linear-gradient(135deg, rgba(30,30,35,0.95), rgba(20,20,25,0.98))`,
                    }}
                >
                    {/* Gradient accent bar */}
                    <div
                        className="absolute top-0 left-0 right-0 h-[3px]"
                        style={{ background: game.gradient }}
                    />

                    {/* Ambient glow */}
                    <div
                        className="absolute -top-20 -right-20 h-40 w-40 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-40"
                        style={{ background: game.glowColor }}
                    />

                    <div className="relative p-5">
                        {/* Top row: emoji + name + arrow */}
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3.5">
                                <div
                                    className="flex h-14 w-14 items-center justify-center rounded-xl text-3xl shadow-lg"
                                    style={{
                                        background: game.gradient,
                                        boxShadow: `0 4px 20px ${game.glowColor}`,
                                    }}
                                >
                                    {game.emoji}
                                </div>
                                <div>
                                    <h2 className="text-base font-bold tracking-tight">{game.name}</h2>
                                    <p className="text-xs text-foreground/40 mt-0.5">{game.tagline}</p>
                                </div>
                            </div>
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.04] group-hover:bg-white/[0.08] transition-colors mt-1">
                                <ChevronRight className="h-4 w-4 text-foreground/30 group-hover:text-foreground/60 transition-colors" />
                            </div>
                        </div>

                        {/* Stats row */}
                        {stats && (
                            <div className="mt-4 flex items-center gap-4">
                                {stats.myBest > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <Trophy className="h-3 w-3 text-foreground/25" />
                                        <span className="text-[11px] text-foreground/35">Your Best: <span className="font-semibold text-foreground/50">{stats.myBest}</span></span>
                                    </div>
                                )}
                                {stats.topScore > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <Trophy className="h-3 w-3 text-foreground/25" />
                                        <span className="text-[11px] text-foreground/35">Top: {stats.topScore}</span>
                                    </div>
                                )}
                                {stats.prize > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <Zap className="h-3 w-3 text-success/60" />
                                        <span className="text-[11px] text-success/70 font-semibold">
                                            Free {stats.prize} <CurrencyIcon size={9} />
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Shimmer on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                        <div
                            className="absolute inset-0"
                            style={{
                                background: `linear-gradient(105deg, transparent 40%, ${game.glowColor.replace('0.3', '0.05')} 50%, transparent 60%)`,
                            }}
                        />
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}

export default function GamesPage() {
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
        const scores = (data.scores || []) as { score: number }[];
        const rewards = (data.rewards || {}) as Record<string, number>;
        return {
            myBest: (data.myBest || 0) as number,
            topScore: scores[0]?.score || 0,
            prize: rewards["1"] || 0,
        };
    }

    const statsMap: Record<string, ReturnType<typeof getStats>> = {
        memory: getStats(memoryData),
        "number-rush": getStats(rushData),
    };

    return (
        <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
            >
                <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04]">
                        <Gamepad2 className="h-5 w-5 game-text" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight">Arcade</h1>
                        <p className="text-xs text-foreground/40">Play · Compete · Win prizes</p>
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
