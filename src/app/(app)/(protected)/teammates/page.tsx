"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, Chip, Select, SelectItem, Skeleton } from "@heroui/react";
import { Users, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

/* ─── Types ─────────────────────────────────────────────────── */

interface Teammate {
    playerId: string;
    displayName: string;
    imageUrl: string | null;
    total: number;
    bySeason: Record<string, number>;
}

interface Season {
    id: string;
    name: string;
}

interface TeammateHistoryData {
    teammates: Teammate[];
    seasons: Season[];
    totalTournaments: number;
}

/* ─── Page ──────────────────────────────────────────────────── */

export default function TeammateHistoryPage() {
    const [seasonFilter, setSeasonFilter] = useState<string>("");

    const { data, isLoading, error } = useQuery<TeammateHistoryData>({
        queryKey: ["teammate-history", seasonFilter],
        queryFn: async () => {
            const params = seasonFilter && seasonFilter !== "all" ? `?seasonId=${seasonFilter}` : "";
            const res = await fetch(`/api/players/teammate-history${params}`);
            if (!res.ok) throw new Error("Failed to load");
            const json = await res.json();

            // Default to latest season on first load (Season 3 and below has unreliable data)
            if (!seasonFilter && json.data?.seasons?.length > 0) {
                setSeasonFilter(json.data.seasons[0].id);
            }

            return json.data;
        },
    });

    const teammates = data?.teammates ?? [];
    const seasons = data?.seasons ?? [];
    const totalTournaments = data?.totalTournaments ?? 0;
    const maxCount = teammates[0]?.total ?? 1;

    // Stats summary
    const stats = useMemo(() => {
        if (teammates.length === 0) return null;
        const uniqueTeammates = teammates.length;
        const mostFrequent = teammates[0];
        const avgTimes = teammates.length > 0
            ? (teammates.reduce((s, t) => s + t.total, 0) / teammates.length).toFixed(1)
            : "0";
        return { uniqueTeammates, mostFrequent, avgTimes };
    }, [teammates]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-default-50">
            {/* Header */}
            <div className="sticky top-16 z-20 bg-background/80 backdrop-blur-lg border-b border-divider">
                <div className="max-w-2xl mx-auto px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/profile"
                            className="w-8 h-8 rounded-full bg-default-100 flex items-center justify-center hover:bg-default-200 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <div className="flex-1">
                            <h1 className="text-lg font-bold">Teammate History</h1>
                            <p className="text-xs text-foreground/50">
                                See who you&apos;ve played with the most
                            </p>
                        </div>
                        <Users className="w-5 h-5 text-foreground/30" />
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
                {/* Stats Summary */}
                {!isLoading && stats && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-3 gap-3"
                    >
                        <div className="rounded-xl bg-primary/5 border border-primary/10 p-3 text-center">
                            <p className="text-2xl font-black text-primary">{totalTournaments}</p>
                            <p className="text-[10px] text-foreground/50 uppercase tracking-wider">Tournaments</p>
                        </div>
                        <div className="rounded-xl bg-secondary/5 border border-secondary/10 p-3 text-center">
                            <p className="text-2xl font-black text-secondary">{stats.uniqueTeammates}</p>
                            <p className="text-[10px] text-foreground/50 uppercase tracking-wider">Teammates</p>
                        </div>
                        <div className="rounded-xl bg-warning/5 border border-warning/10 p-3 text-center">
                            <p className="text-2xl font-black text-warning">{stats.avgTimes}×</p>
                            <p className="text-[10px] text-foreground/50 uppercase tracking-wider">Avg repeat</p>
                        </div>
                    </motion.div>
                )}

                {/* Season Filter */}
                {seasons.length > 0 && (
                    <Select
                        label="Filter by season"
                        size="sm"
                        variant="bordered"
                        selectedKeys={[seasonFilter]}
                        onSelectionChange={(keys) => {
                            const val = Array.from(keys)[0] as string;
                            if (val) setSeasonFilter(val);
                        }}
                        className="max-w-xs"
                    >
                        {[
                            <SelectItem key="all">All Seasons</SelectItem>,
                            ...seasons.map((s) => (
                                <SelectItem key={s.id}>{s.name}</SelectItem>
                            )),
                        ]}
                    </Select>
                )}

                {/* Loading */}
                {isLoading && (
                    <div className="space-y-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-default-50">
                                <Skeleton className="w-10 h-10 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="w-32 h-4 rounded" />
                                    <Skeleton className="w-20 h-3 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="text-center py-8 text-danger text-sm">
                        Failed to load teammate history
                    </div>
                )}

                {/* Empty */}
                {!isLoading && !error && teammates.length === 0 && (
                    <div className="text-center py-12">
                        <Users className="w-12 h-12 text-foreground/20 mx-auto mb-3" />
                        <p className="text-foreground/50">No match history yet</p>
                        <p className="text-xs text-foreground/30 mt-1">
                            Play some matches and come back!
                        </p>
                    </div>
                )}

                {/* Teammate List */}
                {!isLoading && teammates.length > 0 && (
                    <div className="space-y-2">
                        {teammates.map((t, i) => {
                            const pct = Math.round((t.total / maxCount) * 100);
                            const isMost = i === 0;

                            return (
                                <motion.div
                                    key={t.playerId}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: Math.min(i * 0.03, 0.5) }}
                                    className={`relative overflow-hidden rounded-xl border p-3 transition-colors ${
                                        isMost
                                            ? "bg-gradient-to-r from-amber-500/5 to-orange-500/5 border-amber-500/20"
                                            : "bg-default-50 border-divider hover:bg-default-100"
                                    }`}
                                >
                                    {/* Progress bar background */}
                                    <div
                                        className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                                            isMost ? "bg-amber-500/10" : "bg-primary/5"
                                        }`}
                                        style={{ width: `${pct}%` }}
                                    />

                                    <div className="relative flex items-center gap-3">
                                        {/* Rank */}
                                        <span className={`text-xs font-bold w-6 text-center ${
                                            i < 3 ? "text-amber-500" : "text-foreground/30"
                                        }`}>
                                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                                        </span>

                                        {/* Avatar */}
                                        <Avatar
                                            src={t.imageUrl ?? undefined}
                                            name={t.displayName}
                                            size="sm"
                                            className="w-9 h-9 flex-shrink-0"
                                        />

                                        {/* Name */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                                                {t.displayName}
                                                {isMost && (
                                                    <Chip size="sm" variant="flat" className="bg-amber-500/15 text-amber-600 text-[10px] h-4">
                                                        Most frequent
                                                    </Chip>
                                                )}
                                            </p>
                                        </div>

                                        {/* Count */}
                                        <div className="text-right flex-shrink-0">
                                            <p className={`text-lg font-black tabular-nums ${
                                                isMost ? "text-amber-500" : "text-foreground/70"
                                            }`}>
                                                {t.total}×
                                            </p>
                                            <p className="text-[10px] text-foreground/40">
                                                {t.total === 1 ? "match" : "matches"}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
