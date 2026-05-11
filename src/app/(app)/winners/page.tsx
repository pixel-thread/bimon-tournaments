"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardBody, Skeleton } from "@heroui/react";
import { Trophy, Medal, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { GAME } from "@/lib/game-config";

interface TournamentResult {
    id: string;
    name: string;
    createdAt: string;
    place1: { players: string[] } | null;
    place2: { players: string[] } | null;
    place3: { players: string[] } | null;
}

interface PlayerPlacement {
    name: string;
    firstPlaceCount: number;
    secondPlaceCount: number;
    thirdPlaceCount: number;
    totalPlacements: number;
}

interface WinnersData {
    tournaments: TournamentResult[];
    playerPlacements: PlayerPlacement[];
    totalFunds: number;
}

type ModeKey = "casual" | "ranked" | "tdm" | "wow";

const rankColors = [
    "bg-yellow-400 text-white", // 1st
    "bg-gray-300 text-white",   // 2nd
    "bg-amber-600 text-white",  // 3rd
];

export default function WinnersPage() {
    const [mode, setMode] = useState<ModeKey>("casual");

    const { data, isLoading, error } = useQuery<WinnersData>({
        queryKey: ["public-winners", mode],
        queryFn: async () => {
            const res = await fetch(`/api/winners/recent?mode=${mode}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            return json.data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const tabs: { key: ModeKey; label: string; icon: string }[] = [
        { key: "casual", label: "Casual", icon: "🎮" },
        { key: "ranked", label: "Ranked", icon: "🏆" },
        ...(GAME.features.hasTDM ? [{ key: "tdm" as ModeKey, label: "TDM", icon: "⚔️" }] : []),
        ...(GAME.features.hasWoW ? [{ key: "wow" as ModeKey, label: "WoW", icon: "🌍" }] : []),
    ];

    return (
        <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 pb-24 sm:pb-6">
            {/* Mode tabs */}
            {tabs.length > 1 && (
                <div className="flex items-center justify-center gap-1 p-1 rounded-xl bg-default-100 relative">
                    {tabs.map(({ key, label, icon }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setMode(key)}
                            className="flex-1 relative flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium cursor-pointer z-[1]"
                        >
                            {mode === key && (
                                <motion.div
                                    layoutId="winners-tab-indicator"
                                    className="absolute inset-0 bg-background rounded-lg shadow-sm"
                                    style={{ zIndex: -1 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 500,
                                        damping: 35,
                                        mass: 0.8,
                                    }}
                                />
                            )}
                            <motion.span
                                animate={{ scale: mode === key ? 1.05 : 1 }}
                                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                            >
                                {icon}
                            </motion.span>
                            <motion.span
                                animate={{
                                    color: mode === key ? "var(--foreground)" : "var(--foreground-500)",
                                }}
                                transition={{ duration: 0.2 }}
                            >
                                {label}
                            </motion.span>
                        </button>
                    ))}
                </div>
            )}

            {/* Loading */}
            {isLoading && (
                <div className="space-y-5">
                    {/* Leaderboard skeleton */}
                    <Card className="border border-divider">
                        <CardBody className="gap-3 p-4">
                            <Skeleton className="h-5 w-32 rounded" />
                            <Skeleton className="h-3 w-48 rounded" />
                            <div className="space-y-2">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                                ))}
                            </div>
                        </CardBody>
                    </Card>
                    {/* Recent Winners skeleton */}
                    <Card className="border border-divider">
                        <CardBody className="gap-3 p-4">
                            <Skeleton className="h-5 w-36 rounded" />
                            <Skeleton className="h-3 w-44 rounded" />
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                                ))}
                            </div>
                        </CardBody>
                    </Card>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 rounded-lg bg-danger-50 p-4 text-sm text-danger dark:bg-danger-50/10">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Failed to load winners. Please try again later.
                </div>
            )}

            {data && (
                <>
                    {/* Fund Banner — only for casual */}
                    {mode === "casual" && data.totalFunds > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <div className="flex items-center justify-between rounded-xl border border-yellow-500/20 bg-gradient-to-r from-yellow-500/10 to-emerald-500/10 px-4 py-3">
                                <Image
                                    src="/piggy-bank.svg"
                                    alt="Piggy Bank"
                                    width={48}
                                    height={48}
                                    className="drop-shadow-md"
                                />
                                <div className="text-right">
                                    <p className="text-[10px] uppercase tracking-wide text-foreground/50">Bai picnic</p>
                                    <p className="text-2xl font-bold text-emerald-500">
                                        ₹{Number.isInteger(data.totalFunds) ? data.totalFunds : data.totalFunds.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Leaderboard */}
                    {(data.playerPlacements?.length ?? 0) > 0 && (
                        <motion.div
                            key={`lb-${mode}`}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <Card className="border border-divider">
                                <CardBody className="p-4">
                                    <div className="mb-1 flex items-center gap-2">
                                        <span className="text-lg">📈</span>
                                        <h2 className="text-sm font-bold">Leaderboard</h2>
                                    </div>
                                    <p className="mb-3 text-xs text-foreground/40">
                                        Top {mode === "casual" ? "casual" : mode === "ranked" ? "ranked" : mode === "tdm" ? "TDM" : "WoW"} performers this season
                                    </p>
                                    <div className="max-h-[400px] divide-y divide-divider/50 overflow-y-auto">
                                        {data.playerPlacements.map((player, i) => (
                                            <div
                                                key={player.name}
                                                className="flex items-center gap-3 py-2.5"
                                            >
                                                {/* Rank number */}
                                                <span
                                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i < 3
                                                        ? rankColors[i]
                                                        : "bg-default-100 text-foreground/50"
                                                        }`}
                                                >
                                                    {i + 1}
                                                </span>

                                                {/* Name + Medal badges */}
                                                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                                                    <span className="break-all text-sm font-medium">
                                                        {player.name}
                                                    </span>
                                                    <div className="flex items-center gap-1.5">
                                                        {player.firstPlaceCount > 0 && (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-default-100 px-2 py-0.5 text-xs font-semibold">
                                                                🥇 {player.firstPlaceCount}
                                                            </span>
                                                        )}
                                                        {player.secondPlaceCount > 0 && (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-default-100 px-2 py-0.5 text-xs font-semibold">
                                                                🥈 {player.secondPlaceCount}
                                                            </span>
                                                        )}
                                                        {player.thirdPlaceCount > 0 && (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-default-100 px-2 py-0.5 text-xs font-semibold">
                                                                🥉 {player.thirdPlaceCount}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Total */}
                                                <span className="ml-1 w-6 shrink-0 text-right text-sm font-bold text-foreground/70">
                                                    {player.totalPlacements}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </CardBody>
                            </Card>
                        </motion.div>
                    )}

                    {/* Recent Winners */}
                    <motion.div
                        key={`rw-${mode}`}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <Card className="border border-divider">
                            <CardBody className="p-4">
                                <div className="mb-1 flex items-center gap-2">
                                    <Medal className="h-4 w-4 text-purple-500" />
                                    <h2 className="text-sm font-bold">Recent Winners</h2>
                                </div>
                                <p className="mb-3 text-xs text-foreground/40">
                                    Recent {mode === "casual" ? "casual" : mode === "ranked" ? "ranked" : mode === "tdm" ? "TDM" : "WoW"} tournament results this season
                                </p>

                                {(data.tournaments?.length ?? 0) === 0 ? (
                                    <div className="flex flex-col items-center gap-3 rounded-xl bg-default-100 py-8 text-center">
                                        <Trophy className="h-8 w-8 text-foreground/20" />
                                        <p className="text-sm text-foreground/50">No winners yet</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-divider/50">
                                        {data.tournaments.slice(0, 6).map((t) => (
                                            <div key={t.id} className="py-3 first:pt-0 last:pb-0">
                                                {/* Tournament name */}
                                                <div className="mb-2 flex items-center gap-1.5">
                                                    <Trophy className="h-3.5 w-3.5 text-foreground/30" />
                                                    <span className="text-xs font-semibold">
                                                        {t.name}
                                                    </span>
                                                </div>

                                                {/* 1st place */}
                                                {t.place1 && (
                                                    <div className="mb-1 flex items-start gap-2">
                                                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-bold text-white">1</span>
                                                        <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                                                            {t.place1.players.join(", ")}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* 2nd place */}
                                                {t.place2 && (
                                                    <div className="mb-1 flex items-start gap-2">
                                                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-300 text-[10px] font-bold text-white">2</span>
                                                        <span className="text-xs text-foreground/60">
                                                            {t.place2.players.join(", ")}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* 3rd place */}
                                                {t.place3 && (
                                                    <div className="flex items-start gap-2">
                                                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-600 text-[10px] font-bold text-white">3</span>
                                                        <span className="text-xs text-foreground/50">
                                                            {t.place3.players.join(", ")}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardBody>
                        </Card>
                    </motion.div>
                </>
            )}
        </div>
    );
}
