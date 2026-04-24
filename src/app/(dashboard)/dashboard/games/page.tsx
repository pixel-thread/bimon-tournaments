"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Gamepad2, Brain, Hash, ChevronRight, Users, Trophy } from "lucide-react";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";

interface GameCardData {
    key: string;
    label: string;
    tagline: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    image: string;
}

const GAMES: GameCardData[] = [
    {
        key: "memory",
        label: "Memory Game",
        tagline: "Match pairs · Test your memory",
        icon: Brain,
        color: "text-purple-400",
        image: "/images/game-memory.png",
    },
    {
        key: "number-rush",
        label: "Number Rush",
        tagline: "Tap 1→30 · Fastest time wins",
        icon: Hash,
        color: "text-amber-400",
        image: "/images/game-number-rush.png",
    },
];

function GameCard({ game }: { game: GameCardData }) {
    const Icon = game.icon;

    const { data: settings } = useQuery({
        queryKey: ["admin-games", game.key],
        queryFn: async () => {
            const res = await fetch(`/api/admin/games?game=${game.key}`);
            return res.json();
        },
    });

    const { data: leaderboard } = useQuery({
        queryKey: ["admin-games-lb", game.key],
        queryFn: async () => {
            const res = await fetch(`/api/games/leaderboard?all=1&game=${game.key}`);
            return res.json();
        },
    });

    const scoreCount = settings?.scoreCount ?? 0;
    const rewards = (settings?.rewards || {}) as Record<string, number>;
    const topPrize = rewards["1"] || 0;
    const scores = leaderboard?.scores || [];
    const topPlayer = scores[0];

    return (
        <Link href={`/dashboard/games/${game.key}`}>
            <div className="group relative overflow-hidden rounded-2xl border border-divider transition-all duration-300 hover:scale-[1.02] hover:border-primary/30 active:scale-[0.98]">
                {/* Banner */}
                <div className="relative h-32 overflow-hidden">
                    <img src={game.image} alt={game.label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/20" />

                    {/* Top accent bar */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    {/* Content */}
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                        <div className="flex items-center justify-between">
                            <div style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                                <div className="flex items-center gap-2">
                                    <Icon className={`h-5 w-5 ${game.color}`} />
                                    <h2 className="text-base font-bold text-white">{game.label}</h2>
                                </div>
                                <p className="text-[11px] text-white/50 mt-0.5">{game.tagline}</p>
                            </div>
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
                                <ChevronRight className="h-4 w-4 text-white/50 group-hover:text-white/80 transition-colors" />
                            </div>
                        </div>

                        {/* Stats row */}
                        <div className="mt-2.5 flex items-center gap-4" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>
                            <div className="flex items-center gap-1.5">
                                <Users className="h-3 w-3 text-white/40" />
                                <span className="text-[11px] text-white/50">
                                    <span className="font-semibold text-white/80">{scoreCount}</span> players
                                </span>
                            </div>
                            {topPlayer && (
                                <div className="flex items-center gap-1.5">
                                    <Trophy className="h-3 w-3 text-yellow-500/80" />
                                    <span className="text-[11px] text-white/50">
                                        Top: <span className="font-semibold text-white/80">{topPlayer.displayName}</span> ({topPlayer.score})
                                    </span>
                                </div>
                            )}
                            {topPrize > 0 && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-success font-semibold">
                                        🏆 {topPrize} <CurrencyIcon size={9} />
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
}

/* ── Main Page ─────────────────────────────────────────── */
export default function AdminGamesPage() {
    return (
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
            <div>
                <div className="flex items-center gap-2">
                    <Gamepad2 className="h-5 w-5 text-primary" />
                    <h1 className="text-lg font-bold">Games Management</h1>
                </div>
                <p className="text-sm text-foreground/50">
                    Configure rewards and leaderboards for each game.
                </p>
            </div>

            <div className="space-y-3">
                {GAMES.map((game) => (
                    <GameCard key={game.key} game={game} />
                ))}
            </div>
        </div>
    );
}
