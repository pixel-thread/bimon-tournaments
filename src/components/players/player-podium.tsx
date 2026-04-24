"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Crown } from "lucide-react";
import { Avatar } from "@heroui/react";
import type { PlayerDTO } from "@/hooks/use-players";
import { GAME } from "@/lib/game-config";
import { ImagePreview } from "@/components/common/image-preview";

const positionConfig = {
    1: {
        size: "w-28 sm:w-36 aspect-[3/4]",
        ring: "ring-2 ring-yellow-400/60",
        glow: "shadow-[0_0_30px_rgba(250,204,21,0.25)]",
        gradient: "from-yellow-500/20 via-yellow-600/10 to-transparent",
        accent: "text-yellow-400",
        badgeBg: "bg-gradient-to-br from-yellow-400 to-amber-500",
        badgeText: "text-black",
        order: "order-2",
        mt: "mt-0",
        label: "1st",
    },
    2: {
        size: "w-22 sm:w-28 aspect-[3/4]",
        ring: "ring-2 ring-slate-400/40",
        glow: "shadow-[0_0_20px_rgba(148,163,184,0.15)]",
        gradient: "from-slate-400/15 via-slate-500/5 to-transparent",
        accent: "text-slate-300",
        badgeBg: "bg-gradient-to-br from-slate-300 to-slate-400",
        badgeText: "text-slate-800",
        order: "order-1",
        mt: "mt-8 sm:mt-10",
        label: "2nd",
    },
    3: {
        size: "w-22 sm:w-28 aspect-[3/4]",
        ring: "ring-2 ring-amber-600/40",
        glow: "shadow-[0_0_20px_rgba(217,119,6,0.15)]",
        gradient: "from-amber-600/15 via-amber-700/5 to-transparent",
        accent: "text-amber-500",
        badgeBg: "bg-gradient-to-br from-amber-500 to-amber-600",
        badgeText: "text-amber-950",
        order: "order-3",
        mt: "mt-8 sm:mt-10",
        label: "3rd",
    },
} as const;

function getDisplayName(
    displayName: string | null,
    username: string
): string {
    return displayName || username;
}

function getSortMetric(player: PlayerDTO, sortBy: string): { label: string; value: string } {
    switch (sortBy) {
        case "balance":
            return { label: GAME.currency, value: player.balance.toLocaleString() };
        case "kills":
            return { label: "Kills", value: player.stats.kills.toLocaleString() };
        case "matches":
            return { label: "Matches", value: player.stats.matches.toLocaleString() };
        case "wins":
            return { label: "Wins", value: (player.stats.wins ?? 0).toLocaleString() };
        case "winRate": {
            const wr = player.stats.matches > 0
                ? Math.round((player.stats.wins ?? 0) / player.stats.matches * 100)
                : 0;
            return { label: "Win%", value: `${wr}%` };
        }
        case "kd":
        default: {
            if (!GAME.features.hasBR) {
                const wr = player.stats.matches > 0
                    ? Math.round((player.stats.wins ?? 0) / player.stats.matches * 100)
                    : 0;
                return { label: "Win%", value: `${wr}%` };
            }
            const kd = player.stats.kd;
            return { label: "KD", value: isFinite(kd) ? kd.toFixed(2) : "0.00" };
        }
    }
}

interface PodiumCardProps {
    player: PlayerDTO;
    position: 1 | 2 | 3;
    onPlayerClick: (id: string) => void;
    sortBy?: string;
}

/**
 * A single podium card — sleek glassmorphism design.
 * Memoized to prevent video/GIF re-renders.
 */
export const PodiumCard = memo(function PodiumCard({
    player,
    position,
    onPlayerClick,
    sortBy = "matches",
}: PodiumCardProps) {
    const config = positionConfig[position];
    const metric = getSortMetric(player, sortBy);
    const videoRef = useRef<HTMLVideoElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const [mediaLoaded, setMediaLoaded] = useState(false);
    const [inView, setInView] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const name = getDisplayName(player.displayName, player.username);

    // Lazy-load video only when card scrolls into view
    useEffect(() => {
        const el = cardRef.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
            { rootMargin: "200px" }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    // Autoplay video once it's loaded and in view
    useEffect(() => {
        if (inView && mediaLoaded && videoRef.current?.paused) {
            videoRef.current.play().catch(() => {});
        }
    }, [inView, mediaLoaded]);

    const handleMouseEnter = useCallback(() => {
        if (videoRef.current?.paused) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(() => { });
        }
    }, []);

    const charImg = player.characterImage;
    const isVideo = charImg?.isVideo ?? false;
    const isAnimated = charImg?.isAnimated ?? false;
    const mediaUrl = charImg?.url;
    const thumbnailUrl = charImg?.thumbnailUrl;

    return (
        <div ref={cardRef} className={`${config.mt} ${config.order} flex flex-col items-center gap-2.5`}>
            {/* Crown for #1 */}
            {position === 1 && (
                <Crown className="h-5 w-5 text-yellow-400 animate-pulse" />
            )}

            {/* Card */}
            <div
                onClick={() => onPlayerClick(player.id)}
                onMouseEnter={isVideo ? handleMouseEnter : undefined}
                className={`
                    ${config.size} relative cursor-pointer group
                    rounded-2xl ${config.ring} ${config.glow}
                    bg-foreground/[0.04] backdrop-blur-sm
                    overflow-hidden transition-all duration-300
                    hover:scale-[1.04] active:scale-[0.98]
                `}
            >
                {/* Gradient overlay */}
                <div className={`absolute inset-0 bg-gradient-to-b ${config.gradient} pointer-events-none z-[1]`} />

                {/* Character image / video / GIF */}
                {charImg?.url ? (
                    isVideo && mediaUrl ? (
                        <>
                            {/* Show thumbnail/initial while video loads */}
                            {thumbnailUrl ? (
                                <img
                                    src={thumbnailUrl}
                                    alt=""
                                    loading="lazy"
                                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${mediaLoaded ? "opacity-0" : "opacity-90"}`}
                                />
                            ) : !mediaLoaded && (
                                <div className="absolute inset-0 flex items-center justify-center bg-foreground/[0.03]">
                                    <span className="text-3xl font-bold text-foreground/10">
                                        {name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <video
                                ref={videoRef}
                                src={inView ? mediaUrl : undefined}
                                autoPlay
                                muted
                                playsInline
                                loop
                                preload="none"
                                controls={false}
                                controlsList="nodownload nofullscreen noremoteplayback"
                                disableRemotePlayback
                                disablePictureInPicture
                                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 [&::-webkit-media-controls]:!hidden [&::-webkit-media-controls-enclosure]:!hidden ${mediaLoaded ? "opacity-90" : "opacity-0"
                                    }`}
                                onCanPlay={() => setMediaLoaded(true)}
                            />
                        </>
                    ) : isAnimated && mediaUrl ? (
                        <>
                            {thumbnailUrl && (
                                <img
                                    src={thumbnailUrl}
                                    alt=""
                                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${mediaLoaded ? "opacity-0" : "opacity-90"
                                        }`}
                                />
                            )}
                            <img
                                src={mediaUrl}
                                alt=""
                                loading="lazy"
                                onLoad={() => setMediaLoaded(true)}
                                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${mediaLoaded ? "opacity-90" : "opacity-0"
                                    }`}
                            />
                        </>
                    ) : (
                        <img
                            src={charImg.url}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="absolute inset-0 h-full w-full object-cover opacity-90"
                        />
                    )
                ) : (
                    /* No image — clean gradient with initial */
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-foreground/[0.06] to-foreground/[0.02]">
                        <span className={`text-4xl font-black ${config.accent} opacity-30`}>
                            {name.charAt(0).toUpperCase()}
                        </span>
                    </div>
                )}

                {/* Bottom gradient for readability */}
                <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent pointer-events-none z-[1]" />

                {/* Position badge */}
                <div className={`absolute top-2 left-2 z-[2] ${config.badgeBg} rounded-full w-6 h-6 flex items-center justify-center shadow-lg`}>
                    <span className={`text-[11px] font-black ${config.badgeText}`}>{position}</span>
                </div>

                {/* Metric overlay at bottom */}
                <div className="absolute bottom-2 inset-x-0 z-[2] flex flex-col items-center">
                    <span className={`text-base sm:text-lg font-black ${config.accent} drop-shadow-lg`}>
                        {metric.value}
                    </span>
                    <span className="text-[9px] font-medium text-white/50 uppercase tracking-wider">
                        {metric.label}
                    </span>
                </div>
            </div>

            {/* Player info — below the card */}
            <div
                className="flex flex-col items-center gap-1 cursor-pointer"
                onClick={() => onPlayerClick(player.id)}
            >
                <div
                    onClick={(e) => {
                        if (player.imageUrl) {
                            e.stopPropagation();
                            setPreviewOpen(true);
                        }
                    }}
                >
                    <Avatar
                        src={player.imageUrl || undefined}
                        name={name}
                        size="sm"
                        className={`h-7 w-7 ring-2 ring-background ${player.imageUrl ? "cursor-zoom-in" : ""}`}
                    />
                </div>
                <p className="max-w-[100px] truncate text-[11px] font-semibold text-foreground sm:text-xs">
                    {name}
                </p>
            </div>

            <ImagePreview
                src={player.imageUrl ?? null}
                alt={name}
                isOpen={previewOpen}
                onClose={() => setPreviewOpen(false)}
            />
        </div>
    );
});

/**
 * Top-3 podium display with centered first place.
 */
export function PlayerPodium({
    players,
    onPlayerClick,
    sortBy = "matches",
}: {
    players: PlayerDTO[];
    onPlayerClick: (id: string) => void;
    sortBy?: string;
}) {
    if (players.length < 3) return null;

    return (
        <div className="flex items-end justify-center gap-4 py-4 sm:gap-8 sm:py-6">
            {[2, 1, 3].map((pos) => (
                <PodiumCard
                    key={players[pos - 1].id}
                    player={players[pos - 1]}
                    position={pos as 1 | 2 | 3}
                    onPlayerClick={onPlayerClick}
                    sortBy={sortBy}
                />
            ))}
        </div>
    );
}
