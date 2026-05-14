"use client";

import { Avatar, Chip } from "@heroui/react";
import { CategoryBadge } from "@/components/ui/category-badge";
import { Crown, Ban } from "lucide-react";
import Script from "next/script";
import type { PlayerDTO, PlayersMeta } from "@/hooks/use-players";
import { useAuthUser } from "@/hooks/use-auth-user";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";
import { AdSlot } from "@/components/common/AdSlot";
import { useRef, useEffect, useState } from "react";
import { ImagePreview } from "@/components/common/image-preview";

function getDisplayName(
    displayName: string | null,
    username: string
): string {
    return displayName || username;
}

interface PlayerTableProps {
    players: PlayerDTO[];
    meta?: PlayersMeta;
    startIndex?: number;
    onPlayerClick: (id: string) => void;
    fetchNextPage: () => void;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    sortBy?: string;
    totalCount?: number;
}

export function PlayerTable({
    players,
    meta,
    startIndex = 0,
    onPlayerClick,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    sortBy = "kd",
    totalCount,
}: PlayerTableProps) {
    const { isAdmin } = useAuthUser();
    const sentinelRef = useRef<HTMLDivElement>(null);
    const [previewImage, setPreviewImage] = useState<{ src: string; name: string } | null>(null);

    // Auto-fetch next page when sentinel enters viewport
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                    fetchNextPage();
                }
            },
            { rootMargin: "200px" }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    return (
        <div className="space-y-2">
            {/* Table header - desktop only */}
            <div className="hidden items-center gap-3 rounded-lg bg-default-100 dark:bg-[var(--game-surface)] px-4 py-2 text-xs font-semibold text-foreground/50 sm:flex">
                <span className="w-8 text-center">#</span>
                <span className="flex-1">Player</span>
                <span className="w-14 text-center">Tier</span>
                {GAME.features.hasBR ? (
                    <>
                        <span className="w-16 text-right">K/D</span>
                        <span className="w-16 text-right">Kills</span>
                    </>
                ) : (
                    <>
                        <span className="w-16 text-right">Win%</span>
                        <span className="w-16 text-right">Wins</span>
                    </>
                )}
                <span className="w-16 text-right">Matches</span>
                {isAdmin && <span className="w-20 text-right">Balance</span>}
            </div>

            {/* Player rows */}
            <div className="space-y-1">
                {players.map((player, i) => {
                    const rank = startIndex + i + 1;
                    const kd = player.stats.kd;
                    const displayKd = isFinite(kd) ? kd.toFixed(2) : "0.00";
                    // Show ad after 5th row (non-intrusive, collapses if no ad loads)
                    const showAdAfter = (i + 1) % 5 === 0;

                    return (
                        <div key={player.id}>
                        <div
                            onClick={() => onPlayerClick(player.id)}
                            className={`group flex cursor-pointer items-center gap-3 rounded-lg px-4 py-2.5 transition-colors ${player.isBanned
                                ? "opacity-50 bg-danger/5 hover:bg-danger/10"
                                : player.hasRoyalPass
                                ? "bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/25"
                                : "hover:bg-default-200 active:bg-default-300"
                                }`}
                        >
                            {/* Rank */}
                            <span className="w-8 text-center text-xs font-medium text-foreground/40">
                                {rank}
                            </span>

                            {/* Avatar + Name */}
                            <div className="flex flex-1 items-center gap-3 overflow-hidden">
                                <div
                                    className="relative shrink-0"
                                    onClick={(e) => {
                                        if (player.imageUrl) {
                                            e.stopPropagation();
                                            setPreviewImage({ src: player.imageUrl, name: getDisplayName(player.displayName, player.username) });
                                        }
                                    }}
                                >
                                    <Avatar
                                        src={player.imageUrl || undefined}
                                        name={getDisplayName(player.displayName, player.username)}
                                        size="sm"
                                        className={`h-9 w-9 ${player.imageUrl ? "cursor-zoom-in" : ""}`}
                                    />
                                </div>
                                <div className="min-w-0">
                                    <p className="flex items-center gap-1 truncate text-sm font-medium">
                                        <span className={player.isBanned ? "line-through text-foreground/40" : ""}>
                                            {getDisplayName(player.displayName, player.username)}
                                        </span>
                                        {player.isBanned && (
                                            <Chip size="sm" color="danger" variant="flat" className="h-4 px-1 text-[10px] font-bold gap-0.5" startContent={<Ban className="h-2.5 w-2.5" />}>BAN</Chip>
                                        )}
                                        {!player.isBanned && player.hasRoyalPass && (
                                            <Crown className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
                                        )}
                                    </p>
                                    <span className="sm:hidden">
                                        <CategoryBadge category={player.category} size="sm" />
                                    </span>
                                </div>
                            </div>

                            {/* Tier chip */}
                            <span className="hidden sm:inline-flex">
                                <CategoryBadge category={player.category} size="sm" />
                            </span>

                            {/* Stats - desktop */}
                            {GAME.features.hasBR ? (
                                <>
                                    <div className="hidden w-16 text-right sm:block">
                                        <span className="text-sm font-semibold">{displayKd}</span>
                                    </div>
                                    <div className="hidden w-16 text-right sm:block">
                                        <span className="text-sm text-foreground/60">{player.stats.kills}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="hidden w-16 text-right sm:block">
                                        <span className="text-sm font-semibold">
                                            {player.stats.matches > 0
                                                ? `${Math.round((player.stats.wins ?? 0) / player.stats.matches * 100)}%`
                                                : "—"}
                                        </span>
                                    </div>
                                    <div className="hidden w-16 text-right sm:block">
                                        <span className="text-sm text-foreground/60">{player.stats.wins ?? 0}</span>
                                    </div>
                                </>
                            )}
                            <div className="hidden w-16 text-right sm:block">
                                <span className="text-sm text-foreground/60">
                                    {player.stats.matches}
                                </span>
                            </div>

                            {/* Balance - admin only */}
                            {isAdmin && (
                                <div className="hidden w-20 text-right sm:block">
                                    <span
                                        className={`text-sm font-medium ${player.balance < 0
                                            ? "text-danger"
                                            : player.balance > 0
                                                ? "text-success"
                                                : "text-foreground/40"
                                            }`}
                                    >
                                        {player.balance}
                                    </span>
                                </div>
                            )}

                            {/* Mobile stat badge — shows current sort metric */}
                            <span className="text-sm font-semibold text-foreground/70 sm:hidden">
                                {sortBy === "balance" ? (
                                    <span className={player.balance < 0 ? "text-danger" : player.balance > 0 ? "text-success" : ""}>
                                        {player.balance.toLocaleString()} <CurrencyIcon size={12} />
                                    </span>
                                ) : sortBy === "wins" || (!GAME.features.hasBR && sortBy === "kd") ? (
                                    `${player.stats.wins ?? 0} W`
                                ) : sortBy === "kills" ? (
                                    `${player.stats.kills} K`
                                ) : sortBy === "matches" ? (
                                    `${player.stats.matches} M`
                                ) : GAME.features.hasBR ? (
                                    displayKd
                                ) : (
                                    player.stats.matches > 0
                                        ? `${Math.round((player.stats.wins ?? 0) / player.stats.matches * 100)}%`
                                        : "—"
                                )}
                            </span>
                        </div>
                        {showAdAfter && <AdSlot format="in-feed" className="my-1 rounded-lg" />}
                        </div>
                    );
                })}
            </div>

            {/* Load lottie script once for the page */}
            <Script
                src="https://unpkg.com/@lottiefiles/dotlottie-wc@0.9.3/dist/dotlottie-wc.js"
                type="module"
                strategy="lazyOnload"
            />

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="flex justify-center py-4 min-h-[60px]">
                {isFetchingNextPage ? (
                    <>
                        {/* @ts-expect-error – dotlottie-wc is a web component */}
                        <dotlottie-wc
                            src="https://lottie.host/1e87a411-568e-4c3c-9636-d83afd6d26f4/WELgDwxSwC.lottie"
                            style={{ width: "150px", height: "150px" }}
                            autoplay
                            loop
                        />
                    </>
                ) : !hasNextPage && players.length > 0 ? (
                    <p className="text-xs text-foreground/30 py-2">
                        End of list • {totalCount ?? (players.length + (startIndex ?? 0))} players
                    </p>
                ) : null}
            </div>

            {/* Fullscreen image preview */}
            <ImagePreview
                src={previewImage?.src ?? null}
                alt={previewImage?.name}
                isOpen={!!previewImage}
                onClose={() => setPreviewImage(null)}
            />
        </div>
    );
}
