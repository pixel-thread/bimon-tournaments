"use client";

import { useEffect, useState } from "react";
import { Trophy, Calendar, Users, Coins, Swords, Medal, Gamepad2, Target } from "lucide-react";
import Link from "next/link";
import { GAME } from "@/lib/game-config";

interface TournamentWinner {
    position: number;
    amount: number;
    teamName: string;
    players: string[];
}

interface TournamentData {
    id: string;
    name: string;
    date: string;
    type: string;
    teamType: string;
    isSquad: boolean;
    entryFee: number;
    teamCount: number;
    matchCount: number;
    totalPrizePool: number;
    winners: TournamentWinner[];
}

const POSITION_EMOJI = ["🥇", "🥈", "🥉"];
const POSITION_COLORS = ["text-amber-400", "text-zinc-300", "text-amber-600"];

function getTypeLabel(type: string) {
    switch (type) {
        case "BR": return "Battle Royale";
        case "TDM": return "Team Deathmatch";
        case "WoW": return "World of Wonder";
        case "BRACKET_1V1": return "1v1 Knockout";
        case "LEAGUE": return "Round-Robin League";
        case "GROUP_KNOCKOUT": return "Group + Knockout";
        default: return type;
    }
}

function getTypeIcon(type: string) {
    switch (type) {
        case "TDM": return <Swords className="h-3.5 w-3.5" />;
        case "WoW": return <Gamepad2 className="h-3.5 w-3.5" />;
        default: return <Target className="h-3.5 w-3.5" />;
    }
}

export default function TournamentsPublicPage() {
    const [tournaments, setTournaments] = useState<TournamentData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/public/tournaments")
            .then((r) => r.json())
            .then((json) => setTournaments(json.data ?? []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="min-h-dvh bg-background text-foreground">
            <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
                {/* Header */}
                <div className="mb-10">
                    <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-4 py-1.5 text-xs font-medium text-foreground/60">
                        <Trophy className="h-3.5 w-3.5 text-amber-400" />
                        Tournament History
                    </div>
                    <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                        Past Tournament Results
                    </h1>
                    <p className="mt-2 text-base text-foreground/50">
                        Complete results and winner breakdowns from all completed {GAME.gameName} tournaments on Bimon.
                        Every tournament features fair, skill-balanced competition with {GAME.currency} prizes
                        distributed transparently to top performers.
                    </p>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-40 animate-pulse rounded-xl bg-foreground/5" />
                        ))}
                    </div>
                ) : tournaments.length === 0 ? (
                    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] py-16 text-center">
                        <Trophy className="mx-auto h-10 w-10 text-foreground/20" />
                        <p className="mt-3 text-foreground/40">No completed tournaments yet</p>
                    </div>
                ) : (
                    <>
                        {/* Summary Stats */}
                        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <StatCard
                                label="Tournaments"
                                value={tournaments.length.toString()}
                                icon={<Trophy className="h-4 w-4 text-amber-400" />}
                            />
                            <StatCard
                                label="Total Teams"
                                value={tournaments.reduce((s, t) => s + t.teamCount, 0).toString()}
                                icon={<Users className="h-4 w-4 text-blue-400" />}
                            />
                            <StatCard
                                label="Total Matches"
                                value={tournaments.reduce((s, t) => s + t.matchCount, 0).toString()}
                                icon={<Swords className="h-4 w-4 text-rose-400" />}
                            />
                            <StatCard
                                label={`${GAME.currency} Distributed`}
                                value={tournaments.reduce((s, t) => s + t.totalPrizePool, 0).toLocaleString()}
                                icon={<Coins className="h-4 w-4 text-emerald-400" />}
                            />
                        </div>

                        {/* Tournament Cards */}
                        <div className="space-y-4">
                            {tournaments.map((t) => (
                                <article
                                    key={t.id}
                                    className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5 transition-colors hover:bg-foreground/[0.04]"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h2 className="text-lg font-bold truncate">{t.name}</h2>
                                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-foreground/40">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    {getTypeIcon(t.type)}
                                                    {getTypeLabel(t.type)}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Users className="h-3 w-3" />
                                                    {t.teamCount} teams · {t.matchCount} match{t.matchCount !== 1 ? "es" : ""}
                                                </span>
                                                {t.entryFee > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <Coins className="h-3 w-3" />
                                                        {t.entryFee} {GAME.currency} entry
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {t.totalPrizePool > 0 && (
                                            <div className="shrink-0 text-right">
                                                <div className="text-xs text-foreground/40">Prize Pool</div>
                                                <div className="text-lg font-extrabold text-amber-400">
                                                    {t.totalPrizePool.toLocaleString()} <span className="text-xs font-medium">{GAME.currency}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Winners */}
                                    {t.winners.length > 0 && (
                                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                                            {t.winners.map((w, i) => (
                                                <div
                                                    key={w.position}
                                                    className="flex items-center gap-3 rounded-lg bg-foreground/[0.04] px-3 py-2"
                                                >
                                                    <span className="text-lg">{POSITION_EMOJI[i] ?? `#${w.position}`}</span>
                                                    <div className="min-w-0 flex-1">
                                                        <div className={`text-sm font-bold truncate ${POSITION_COLORS[i] ?? "text-foreground/60"}`}>
                                                            {w.teamName}
                                                        </div>
                                                        <div className="text-[10px] text-foreground/30 truncate">
                                                            {w.players.join(", ")}
                                                        </div>
                                                    </div>
                                                    {w.amount > 0 && (
                                                        <div className="shrink-0 text-xs font-bold text-emerald-400">
                                                            +{w.amount}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </article>
                            ))}
                        </div>
                    </>
                )}

                {/* SEO Content Block */}
                <div className="mt-16 space-y-4 text-sm leading-relaxed text-foreground/50">
                    <h2 className="text-lg font-bold text-foreground">About Bimon Tournament Results</h2>
                    <p>
                        Bimon organizes regular {GAME.gameName} tournaments with transparent scoring, fair team balancing,
                        and real {GAME.currency} prize pools. Every tournament result shown above is verified and final —
                        prize distribution happens automatically through our platform.
                    </p>
                    <p>
                        Our tournaments use a geometric decay prize distribution system where {GAME.currency} prizes
                        are split among top-performing teams. Entry fees from all participants go directly into the prize pool,
                        ensuring that bigger tournaments mean bigger rewards for winners.
                    </p>
                    <p>
                        Whether you&apos;re a seasoned competitor or a new player looking to test your skills,
                        Bimon provides a level playing field with skill-balanced teams and detailed stat tracking
                        for every match.
                    </p>
                </div>

                {/* Back link */}
                <div className="mt-12 border-t border-foreground/10 pt-6">
                    <Link href="/" className="text-sm text-foreground/40 hover:text-foreground/60 transition-colors">
                        ← Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
                {icon}
                <span className="text-xl font-extrabold">{value}</span>
            </div>
            <div className="mt-1 text-[11px] text-foreground/40">{label}</div>
        </div>
    );
}
