"use client";

import { useEffect, useState } from "react";
import { BarChart3, Trophy, Medal, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { GAME } from "@/lib/game-config";

interface PlayerData {
    displayName: string;
    kills: number;
    matches: number;
    kd: number;
    wins: number;
}

export default function LeaderboardPublicPage() {
    const [players, setPlayers] = useState<PlayerData[]>([]);
    const [season, setSeason] = useState("Current");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/public/leaderboard")
            .then((r) => r.json())
            .then((json) => {
                setPlayers(json.data?.players ?? []);
                setSeason(json.data?.season ?? "Current");
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="min-h-dvh bg-background text-foreground">
            <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
                {/* Header */}
                <div className="mb-10">
                    <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-4 py-1.5 text-xs font-medium text-foreground/60">
                        <BarChart3 className="h-3.5 w-3.5 text-violet-400" />
                        Season: {season}
                    </div>
                    <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                        {GAME.gameName} Leaderboard
                    </h1>
                    <p className="mt-2 text-base text-foreground/50">
                        Top {GAME.gameName} players ranked by performance across all Bimon tournaments this season.
                        Stats are calculated from verified match results and updated after every tournament.
                    </p>
                </div>

                {/* Table */}
                {loading ? (
                    <div className="space-y-2">
                        {[...Array(10)].map((_, i) => (
                            <div key={i} className="h-12 animate-pulse rounded-lg bg-foreground/5" />
                        ))}
                    </div>
                ) : players.length === 0 ? (
                    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] py-16 text-center">
                        <BarChart3 className="mx-auto h-10 w-10 text-foreground/20" />
                        <p className="mt-3 text-foreground/40">No leaderboard data available yet</p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-foreground/10">
                        {/* Header */}
                        <div className="grid grid-cols-[40px_1fr_60px_60px_60px] sm:grid-cols-[50px_1fr_80px_80px_80px_80px] gap-2 bg-foreground/[0.05] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-foreground/40">
                            <span>#</span>
                            <span>Player</span>
                            <span className="text-right">K/D</span>
                            <span className="text-right">Kills</span>
                            <span className="text-right hidden sm:block">Matches</span>
                            <span className="text-right">
                                {GAME.features.hasBracket ? "Wins" : "Avg"}
                            </span>
                        </div>

                        {/* Rows */}
                        {players.map((p, i) => (
                            <div
                                key={i}
                                className={`grid grid-cols-[40px_1fr_60px_60px_60px] sm:grid-cols-[50px_1fr_80px_80px_80px_80px] gap-2 px-4 py-3 text-sm transition-colors hover:bg-foreground/[0.03] ${
                                    i !== players.length - 1 ? "border-b border-foreground/5" : ""
                                }`}
                            >
                                <span className="flex items-center">
                                    {i < 3 ? (
                                        <span className="text-base">{["🥇", "🥈", "🥉"][i]}</span>
                                    ) : (
                                        <span className="text-foreground/30 font-mono text-xs">{i + 1}</span>
                                    )}
                                </span>
                                <span className="flex items-center font-semibold truncate">
                                    {p.displayName}
                                </span>
                                <span className={`text-right font-bold tabular-nums ${
                                    p.kd >= 3 ? "text-amber-400" : p.kd >= 2 ? "text-emerald-400" : p.kd >= 1 ? "text-blue-400" : "text-foreground/60"
                                }`}>
                                    {p.kd.toFixed(2)}
                                </span>
                                <span className="text-right tabular-nums text-foreground/70">
                                    {p.kills}
                                </span>
                                <span className="text-right tabular-nums text-foreground/50 hidden sm:block">
                                    {p.matches}
                                </span>
                                <span className="text-right tabular-nums text-foreground/70">
                                    {GAME.features.hasBracket ? p.wins : (p.matches > 0 ? (p.kills / p.matches).toFixed(1) : "0")}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* SEO Content */}
                <div className="mt-16 space-y-6">
                    <h2 className="text-lg font-bold text-foreground">How the Leaderboard Works</h2>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5">
                            <h3 className="flex items-center gap-2 text-base font-bold">
                                <Target className="h-4 w-4 text-rose-400" />
                                Kill/Death Ratio (K/D)
                            </h3>
                            <p className="mt-2 text-sm text-foreground/50">
                                Your K/D ratio measures your average kills per match across all tournaments.
                                A K/D of 2.0 means you average 2 kills per match. Higher K/D players are
                                ranked higher on the leaderboard and may be placed in stronger teams for balance.
                            </p>
                        </div>
                        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5">
                            <h3 className="flex items-center gap-2 text-base font-bold">
                                <TrendingUp className="h-4 w-4 text-emerald-400" />
                                Season Rankings
                            </h3>
                            <p className="mt-2 text-sm text-foreground/50">
                                Leaderboard rankings reset each season. This ensures that every player gets a fresh
                                start and that rankings reflect recent performance. Past season data is preserved
                                in tournament history.
                            </p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5">
                        <h3 className="flex items-center gap-2 text-base font-bold">
                            <Medal className="h-4 w-4 text-amber-400" />
                            Player Tiers
                        </h3>
                        <p className="mt-2 text-sm text-foreground/50">
                            Players are categorized into performance tiers based on their stats.
                            Our team-generation algorithm uses these tiers to create balanced squads,
                            ensuring every tournament match is competitive and fair for all skill levels.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {["Conqueror", "Ace", "Crown", "Diamond", "Platinum", "Gold", "Silver", "Bronze"].map((tier) => (
                                <span key={tier} className="rounded-full border border-foreground/10 bg-foreground/[0.05] px-3 py-1 text-xs font-medium text-foreground/60">
                                    {tier}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-12 border-t border-foreground/10 pt-6">
                    <Link href="/" className="text-sm text-foreground/40 hover:text-foreground/60 transition-colors">
                        ← Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
