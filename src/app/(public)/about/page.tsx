"use client";

import { useEffect, useState } from "react";
import { Shield, Users, Trophy, Swords, Coins, Heart, Target, Zap } from "lucide-react";
import Link from "next/link";
import { GAME } from "@/lib/game-config";

interface PlatformStats {
    totalPlayers: number;
    totalTournaments: number;
    totalMatches: number;
    totalTeams: number;
    totalPrizeDistributed: number;
}

export default function AboutPage() {
    const [stats, setStats] = useState<PlatformStats | null>(null);

    useEffect(() => {
        fetch("/api/public/stats")
            .then((r) => r.json())
            .then((json) => setStats(json.data ?? null))
            .catch(() => {});
    }, []);

    return (
        <div className="min-h-dvh bg-background text-foreground">
            <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
                {/* Header */}
                <div className="mb-10">
                    <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-4 py-1.5 text-xs font-medium text-foreground/60">
                        <Shield className="h-3.5 w-3.5 text-blue-400" />
                        About Us
                    </div>
                    <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                        About Bimon Tournament
                    </h1>
                    <p className="mt-2 text-lg text-foreground/50">
                        Making competitive {GAME.gameName} accessible, fair, and rewarding for every player.
                    </p>
                </div>

                {/* Live Stats */}
                {stats && (
                    <div className="mb-12 grid grid-cols-2 gap-3 sm:grid-cols-5">
                        <LiveStat icon={<Users className="h-4 w-4 text-blue-400" />} value={stats.totalPlayers} label="Players" />
                        <LiveStat icon={<Trophy className="h-4 w-4 text-amber-400" />} value={stats.totalTournaments} label="Tournaments" />
                        <LiveStat icon={<Swords className="h-4 w-4 text-rose-400" />} value={stats.totalMatches} label="Matches" />
                        <LiveStat icon={<Users className="h-4 w-4 text-violet-400" />} value={stats.totalTeams} label="Teams" />
                        <LiveStat
                            icon={<Coins className="h-4 w-4 text-emerald-400" />}
                            value={stats.totalPrizeDistributed}
                            label={`${GAME.currency} Distributed`}
                            className="col-span-2 sm:col-span-1"
                        />
                    </div>
                )}

                {/* Story */}
                <div className="space-y-8 text-base leading-relaxed text-foreground/70">
                    <section>
                        <h2 className="text-xl font-bold text-foreground">Our Story</h2>
                        <p className="mt-3">
                            Bimon Tournament started as a small {GAME.gameName} community project — a group of friends
                            who wanted to organize fair, competitive matches without the chaos of random matchmaking.
                            What began as a Discord-managed bracket quickly grew into a full-fledged esports
                            platform serving players across Northeast India.
                        </p>
                        <p className="mt-3">
                            Today, Bimon is built on the idea that grassroots esports should be accessible to everyone.
                            You don&apos;t need to be a pro player or have expensive equipment — all you need is your
                            phone, your skills, and a desire to compete.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                            <Target className="h-5 w-5 text-blue-400" />
                            Our Mission
                        </h2>
                        <p className="mt-3">
                            We believe that competitive gaming should be fair, transparent, and rewarding.
                            Every feature we build serves this mission:
                        </p>
                        <ul className="mt-4 space-y-3">
                            <MissionItem
                                icon={<Shield className="h-4 w-4 text-blue-400" />}
                                title="Fair Competition"
                                description="Our team-balancing algorithm ensures every squad is competitive. No stacking, no unfair advantages — pure skill-based competition."
                            />
                            <MissionItem
                                icon={<Coins className="h-4 w-4 text-emerald-400" />}
                                title="Transparent Prizes"
                                description={`Entry fees go directly into the prize pool. Winners are determined by verified scores and ${GAME.currency} is distributed automatically — no middlemen.`}
                            />
                            <MissionItem
                                icon={<Users className="h-4 w-4 text-violet-400" />}
                                title="Community First"
                                description="We're not a faceless corporation. Bimon is run by players, for players. Our admins are active in the community and responsive to feedback."
                            />
                            <MissionItem
                                icon={<Zap className="h-4 w-4 text-amber-400" />}
                                title="Continuous Improvement"
                                description="We ship new features every week based on player feedback. From squad systems to clan treasuries, the platform evolves with our community's needs."
                            />
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                            <Heart className="h-5 w-5 text-rose-400" />
                            What Makes Bimon Different
                        </h2>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <DiffCard
                                title="Smart Team Balancing"
                                description="Unlike random lobbies, our algorithm analyzes each player's historical K/D, kill average, and placement stats to create skill-balanced squads. Every team has a fair chance."
                            />
                            <DiffCard
                                title="Real Prize Pools"
                                description={`Every ${GAME.currency} in the prize pool comes from entry fees — no inflated numbers, no hidden cuts. Winners see their prizes deposited to their wallet automatically.`}
                            />
                            <DiffCard
                                title="Detailed Stat Tracking"
                                description="Every kill, every placement, every assist is tracked. Your player profile shows complete match history, season-by-season stats, and performance trends."
                            />
                            <DiffCard
                                title="Multiple Formats"
                                description={`From Battle Royale to TDM, 1v1 Knockouts to World Cup-style Group + Knockout — we run diverse tournament formats to keep competition fresh.`}
                            />
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">The Platform</h2>
                        <p className="mt-3">
                            Bimon is a progressive web app (PWA) — meaning it works on any device with a browser
                            and can be installed directly to your home screen for an app-like experience. No app store
                            downloads required.
                        </p>
                        <p className="mt-3">
                            The platform is operated by <strong>Pixel Thread</strong>, a small independent team focused
                            on building tools for competitive gaming communities. We&apos;re committed to keeping the
                            platform ad-supported and accessible to all players regardless of financial status.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">Join Us</h2>
                        <p className="mt-3">
                            Whether you&apos;re looking to compete in your first tournament or you&apos;re a seasoned
                            veteran hunting for the top of the leaderboard, Bimon has a place for you. Create your
                            account, join the next tournament, and start your competitive journey today.
                        </p>
                        <div className="mt-6">
                            <Link
                                href="/sign-up"
                                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/30 hover:brightness-110"
                            >
                                <Swords className="h-4 w-4" />
                                Start Competing
                            </Link>
                        </div>
                    </section>
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

function LiveStat({ icon, value, label, className = "" }: { icon: React.ReactNode; value: number; label: string; className?: string }) {
    return (
        <div className={`rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4 text-center ${className}`}>
            <div className="flex items-center justify-center gap-1.5">
                {icon}
                <span className="text-xl font-extrabold">{value.toLocaleString()}</span>
            </div>
            <div className="mt-1 text-[11px] text-foreground/40">{label}</div>
        </div>
    );
}

function MissionItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <li className="flex gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.06]">
                {icon}
            </div>
            <div>
                <h3 className="text-sm font-bold text-foreground">{title}</h3>
                <p className="mt-0.5 text-sm text-foreground/50">{description}</p>
            </div>
        </li>
    );
}

function DiffCard({ title, description }: { title: string; description: string }) {
    return (
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
            <p className="mt-1.5 text-sm text-foreground/50">{description}</p>
        </div>
    );
}
