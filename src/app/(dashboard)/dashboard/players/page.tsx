"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import {
    Chip,
    Avatar,
    Button,
    Skeleton,
} from "@heroui/react";
import {
    Wallet,
    Users,
    Crown,
    ChevronsDown,
    AlertCircle,
    Eye,
    EyeOff,
} from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";
import { PlayerDetailModal } from "@/components/dashboard/player-detail-modal";
import { usePlayerFilters } from "@/hooks/use-player-filters";
import { PlayerFiltersBar } from "@/components/players/player-filters-bar";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";

interface PlayerDTO {
    id: string;
    displayName: string | null;
    username: string;
    imageUrl: string | null;
    category: string;
    isBanned: boolean;
    phoneNumber: string | null;
    stats: { kills: number; deaths: number; matches: number; kd: number };
    balance: number;
    hasRoyalPass: boolean;
    hasDiscord: boolean;
    discordUsername: string | null;
}

interface PlayersResponse {
    data: PlayerDTO[];
    meta: { hasMore: boolean; nextCursor: string | null; totalBalance?: number; negativeBalance?: number };
}

const categoryColors: Record<string, "warning" | "primary" | "success" | "secondary" | "danger" | "default"> = {
    LEGEND: "warning",
    ULTRA_PRO: "primary",
    PRO: "success",
    NOOB: "default",
    ULTRA_NOOB: "secondary",
    BOT: "danger",
};

/**
 * /dashboard/players — Admin player management.
 * Shows all players with balance, category, ban status.
 */
export default function AdminPlayersPage() {
    const filters = usePlayerFilters();
    const { search, tier, sortBy, sortOrder, season } = filters;
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [showUC, setShowUC] = useState(false);

    const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
        useInfiniteQuery<PlayersResponse>({
            queryKey: ["admin-players", { search, tier, sortBy, sortOrder, season }],
            queryFn: async ({ pageParam }) => {
                const params = new URLSearchParams({
                    search,
                    tier,
                    sortBy,
                    sortOrder,
                    ...(season ? { season } : {}),
                    limit: "30",
                    ...(pageParam ? { cursor: pageParam as string } : {}),
                });
                const res = await fetch(`/api/players?${params}`);
                if (!res.ok) throw new Error("Failed to fetch");
                return res.json();
            },
            initialPageParam: null as string | null,
            getNextPageParam: (last) =>
                last.meta.hasMore ? last.meta.nextCursor : undefined,
            staleTime: 30 * 1000,
        });

    const players = data?.pages.flatMap((p) => p.data) ?? [];
    const meta = data?.pages[0]?.meta;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold">Players</h1>
                <p className="text-sm text-foreground/50">
                    Manage player profiles and balances
                </p>
            </div>

            {/* Search + Filters */}
            <PlayerFiltersBar {...filters} />

            {/* UC Balance Summary — hidden by default, click eye to reveal */}
            {meta && meta.totalBalance != null && (
                <div className="flex items-center gap-4 text-xs">
                    {showUC && (
                        <>
                            <div className="flex items-center gap-1.5 rounded-lg bg-default-100 px-3 py-1.5">
                                <Wallet className="h-3 w-3 text-default-400" />
                                <span className="text-foreground/50">Total:</span>
                                <span
                                    className={`font-semibold ${(meta.totalBalance ?? 0) >= 0
                                        ? "text-success"
                                        : "text-danger"
                                        }`}
                                >
                                    {(meta.totalBalance ?? 0).toLocaleString()} <CurrencyIcon size={12} />
                                </span>
                            </div>
                            {(meta.negativeBalance ?? 0) < 0 && (
                                <div className="flex items-center gap-1.5 rounded-lg bg-danger-50 px-3 py-1.5 dark:bg-danger-50/10">
                                    <span className="text-foreground/50">Negative:</span>
                                    <span className="font-semibold text-danger">
                                        {(meta.negativeBalance ?? 0).toLocaleString()} <CurrencyIcon size={12} />
                                    </span>
                                </div>
                            )}
                        </>
                    )}
                    <button
                        onClick={() => setShowUC((v) => !v)}
                        className="rounded-md p-1 text-foreground/40 transition-colors hover:bg-default-100 hover:text-foreground/70"
                        title={showUC ? "Hide totals" : "Show totals"}
                    >
                        {showUC ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 rounded-lg bg-danger-50 p-4 text-sm text-danger dark:bg-danger-50/10">
                    <AlertCircle className="h-4 w-4" />
                    Failed to load players.
                </div>
            )}

            {isLoading && (
                <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-xl" />
                    ))}
                </div>
            )}

            {!isLoading && (
                <div className="space-y-1">
                    {/* Table header */}
                    <div className="hidden items-center gap-3 rounded-lg bg-default-100 px-4 py-2 text-xs font-semibold text-foreground/50 sm:flex">
                        <span className="flex-1">Player</span>
                        <span className="w-16 text-center">Tier</span>
                        <span className="w-16 text-right">K/D</span>
                        <span className="w-16 text-right">Matches</span>
                        <span className="w-20 text-right">Balance</span>
                        <span className="w-16 text-center">Status</span>
                    </div>

                    {players.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 rounded-xl bg-default-100 py-12 text-center">
                            <Users className="h-10 w-10 text-foreground/20" />
                            <p className="text-sm text-foreground/50">No players found</p>
                        </div>
                    ) : (
                        players.map((p, i) => (
                            <motion.div
                                key={p.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.01 }}
                            >
                                <div
                                    className="flex cursor-pointer items-center gap-3 rounded-lg px-4 py-2.5 transition-colors hover:bg-default-100"
                                    onClick={() => setSelectedPlayerId(p.id)}
                                >
                                    {/* Avatar */}
                                    <div className="relative shrink-0">
                                        <Avatar
                                            src={p.imageUrl || undefined}
                                            name={p.displayName || p.username}
                                            size="sm"
                                            className="h-9 w-9"
                                        />
                                        {p.hasRoyalPass && (
                                            <Crown className="absolute -right-0.5 -top-0.5 h-3 w-3 text-yellow-500" />
                                        )}
                                    </div>

                                    {/* Name */}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <p className="truncate text-sm font-medium">
                                                {p.displayName || p.username}
                                            </p>
                                            {p.hasDiscord ? (
                                                <svg className="h-3.5 w-3.5 text-[#5865F2] shrink-0" viewBox="0 0 24 24" fill="currentColor"><title>In Discord server</title><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
                                            ) : (
                                                <svg className="h-3.5 w-3.5 text-foreground/15 shrink-0" viewBox="0 0 24 24" fill="currentColor"><title>Not in Discord server</title><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
                                            )}
                                        </div>
                                        <p className="truncate text-xs text-foreground/40 sm:hidden">
                                            {p.category} · {p.balance} <CurrencyIcon size={10} />{p.discordUsername && ` · ${p.discordUsername}`}{!p.hasDiscord && " · Not in server"}
                                        </p>
                                        {p.discordUsername && (
                                            <p className="hidden sm:block truncate text-[11px] text-[#5865F2]/60">
                                                {p.discordUsername}
                                            </p>
                                        )}
                                    </div>

                                    {/* Tier */}
                                    <Chip
                                        size="sm"
                                        variant="flat"
                                        color={categoryColors[p.category] ?? "default"}
                                        className="hidden sm:flex"
                                    >
                                        {p.category}
                                    </Chip>

                                    {/* Stats */}
                                    <span className="hidden w-16 text-right text-sm font-semibold sm:block">
                                        {isFinite(p.stats.kd) ? p.stats.kd.toFixed(2) : "0.00"}
                                    </span>
                                    <span className="hidden w-16 text-right text-sm text-foreground/60 sm:block">
                                        {p.stats.matches}
                                    </span>

                                    {/* Balance */}
                                    <span
                                        className={`hidden w-20 text-right text-sm font-medium sm:block ${p.balance < 0
                                            ? "text-danger"
                                            : p.balance > 0
                                                ? "text-success"
                                                : "text-foreground/40"
                                            }`}
                                    >
                                        {p.balance} <CurrencyIcon size={12} />
                                    </span>

                                    {/* Status */}
                                    <div className="hidden w-16 sm:flex justify-center">
                                        {p.isBanned ? (
                                            <Chip size="sm" variant="flat" color="danger">
                                                Banned
                                            </Chip>
                                        ) : (
                                            <Chip size="sm" variant="flat" color="success">
                                                Active
                                            </Chip>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}

                    {hasNextPage && (
                        <div className="flex justify-center pt-2">
                            <Button
                                size="sm"
                                variant="flat"
                                isLoading={isFetchingNextPage}
                                onPress={() => fetchNextPage()}
                                startContent={
                                    !isFetchingNextPage && <ChevronsDown className="h-4 w-4" />
                                }
                            >
                                Load More
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Player detail modal */}
            <PlayerDetailModal
                playerId={selectedPlayerId}
                isOpen={!!selectedPlayerId}
                onClose={() => setSelectedPlayerId(null)}
            />
        </div>
    );
}
