"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
    Modal,
    ModalContent,
    ModalBody,
    Avatar,
    Button,
    Chip,
} from "@heroui/react";
import { CategoryBadge } from "@/components/ui/category-badge";
import {
    Target,
    Gamepad2,
    Swords,
    Crown,
    Wallet,
    X,
    Loader2,
    Volume2,
    VolumeX,
} from "lucide-react";
import { Spinner } from "@heroui/react";
import type { PlayerDTO } from "@/hooks/use-players";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { UCTransferDialog } from "./uc-transfer-dialog";
import { ClanMembersModal } from "./clan-members-modal";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";

function getDisplayName(
    displayName: string | null,
    username: string
): string {
    return displayName || username;
}

interface PlayerStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    player: PlayerDTO | null;
}

export function PlayerStatsModal({
    isOpen,
    onClose,
    player,
}: PlayerStatsModalProps) {
    const { user } = useAuthUser();
    const router = useRouter();
    const [showUCTransfer, setShowUCTransfer] = useState(false);
    const [showClanMembers, setShowClanMembers] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [videoMuted, setVideoMuted] = useState(true);
    const charVideoRef = useRef<HTMLVideoElement>(null);

    // 🐍 Easter egg audio players
    const EASTER_EGG_AUDIO: Record<string, string> = {
        badsnipe: "/audio/rko.mp3",
        ksscarface: "/audio/619.mp3",
    };
    const easterEggAudio = player?.username ? EASTER_EGG_AUDIO[player.username.toLowerCase()] : undefined;
    const isRkoPlayer = !!easterEggAudio;

    const rkoAudioRef = useRef<HTMLAudioElement | null>(null);
    const [rkoMuted, setRkoMuted] = useState(true);

    useEffect(() => {
        if (isOpen && isRkoPlayer && easterEggAudio) {
            if (!rkoAudioRef.current || rkoAudioRef.current.src !== new URL(easterEggAudio, window.location.origin).href) {
                rkoAudioRef.current = new Audio(easterEggAudio);
                rkoAudioRef.current.loop = false;
                rkoAudioRef.current.onended = () => setRkoMuted(true);
            }
            rkoAudioRef.current.muted = true;
            rkoAudioRef.current.currentTime = 0;
            rkoAudioRef.current.play().catch(() => { });
            setRkoMuted(true);
        } else {
            if (rkoAudioRef.current) {
                rkoAudioRef.current.pause();
                rkoAudioRef.current.currentTime = 0;
            }
        }
        return () => {
            if (rkoAudioRef.current) {
                rkoAudioRef.current.pause();
                rkoAudioRef.current.currentTime = 0;
            }
        };
    }, [isOpen, isRkoPlayer, easterEggAudio]);

    const toggleRkoMute = useCallback(() => {
        if (!rkoAudioRef.current) return;
        const next = !rkoMuted;
        setRkoMuted(next);
        rkoAudioRef.current.muted = next;
        if (!next) {
            rkoAudioRef.current.currentTime = 0;
            rkoAudioRef.current.play().catch(() => { });
        }
    }, [rkoMuted]);

    // Reset image loaded state when player changes
    useEffect(() => {
        setImageLoaded(false);
        setVideoMuted(true);
    }, [player?.id]);

    if (!player) return null;

    const isOwnProfile = user?.player?.id === player.id;
    const name = getDisplayName(player.displayName, player.username);
    const { stats, characterImage } = player;
    const kd = isFinite(stats.kd) ? stats.kd.toFixed(2) : "0.00";

    const statCards = GAME.features.hasBR ? [
        {
            label: "K/D Ratio",
            value: kd,
            icon: Target,
            color: "text-primary",
        },
        {
            label: "Total Kills",
            value: (stats.kills ?? 0).toLocaleString(),
            icon: Swords,
            color: "text-danger",
        },
        {
            label: "Matches",
            value: (stats.matches ?? 0).toLocaleString(),
            icon: Gamepad2,
            color: "text-success",
        },
        {
            label: "Balance",
            value: player.balance.toLocaleString(),
            suffix: <CurrencyIcon size={16} />,
            icon: Wallet,
            color: "text-warning",
        },
    ] : [
        {
            label: "Win Rate",
            value: stats.matches > 0
                ? `${Math.round((stats.wins ?? 0) / stats.matches * 100)}%`
                : "—",
            icon: Target,
            color: "text-primary",
        },
        {
            label: "Wins",
            value: (stats.wins ?? 0).toLocaleString(),
            icon: Swords,
            color: "text-success",
        },
        {
            label: "Matches",
            value: (stats.matches ?? 0).toLocaleString(),
            icon: Gamepad2,
            color: "text-foreground/60",
        },
        {
            label: "Balance",
            value: player.balance.toLocaleString(),
            suffix: <CurrencyIcon size={16} />,
            icon: Wallet,
            color: "text-warning",
        },
    ];

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                size="md"
                placement="center"
                scrollBehavior="outside"
                hideCloseButton
                motionProps={{
                    variants: {
                        enter: {
                            y: 0,
                            opacity: 1,
                            transition: { duration: 0.3, ease: "easeOut" },
                        },
                        exit: {
                            y: 50,
                            opacity: 0,
                            transition: { duration: 0.2, ease: "easeIn" },
                        },
                    },
                    initial: { y: 100, opacity: 0 },
                }}
                classNames={{
                    base: "bg-background border border-divider",
                    backdrop: "bg-black/60 backdrop-blur-sm",
                }}
            >
                <ModalContent
                    className={`!overflow-hidden transition-shadow duration-300 ${isRkoPlayer && !rkoMuted ? 'ring-2 ring-red-500/60 shadow-[0_0_30px_rgba(220,38,38,0.3)]' : ''}`}
                    style={isRkoPlayer && !rkoMuted ? { animation: 'rkoShake 0.15s ease-in-out infinite' } : undefined}
                >
                    {/* Custom close button */}
                    <button
                        onClick={onClose}
                        className="absolute right-3 top-3 z-50 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70 pointer-events-auto"
                    >
                        <X className="h-4 w-4" />
                    </button>

                    {/* Hero section */}
                    <div className="relative aspect-[3/4] w-full overflow-hidden">
                        {characterImage?.url ? (
                            <>
                                {!imageLoaded && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-default-100">
                                        <Spinner size="sm" />
                                        {/* Smooth bottom fade to match the loaded gradient */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                                    </div>
                                )}
                                {characterImage.isVideo ? (
                                    <>
                                        <video
                                            ref={charVideoRef}
                                            src={characterImage.url}
                                            autoPlay
                                            muted
                                            playsInline
                                            loop
                                            preload="auto"
                                            controls={false}
                                            controlsList="nodownload nofullscreen noremoteplayback"
                                            disableRemotePlayback
                                            disablePictureInPicture
                                            className="h-full w-full object-contain bg-default-100 [&::-webkit-media-controls]:!hidden [&::-webkit-media-controls-enclosure]:!hidden"
                                            onLoadedData={() => {
                                                setImageLoaded(true);
                                                if (charVideoRef.current) charVideoRef.current.muted = videoMuted;
                                            }}
                                            onCanPlay={() => setImageLoaded(true)}
                                        />
                                        {/* Sound toggle */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const next = !videoMuted;
                                                setVideoMuted(next);
                                                if (charVideoRef.current) charVideoRef.current.muted = next;
                                            }}
                                            className="absolute left-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 transition-colors"
                                        >
                                            {videoMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                        </button>
                                    </>
                                ) : (
                                    <img
                                        src={characterImage.url}
                                        alt=""
                                        className="h-full w-full object-cover"
                                        onLoad={() => setImageLoaded(true)}
                                    />
                                )}
                            </>
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/60 to-primary/30">
                                <span className="text-6xl font-bold text-white/20">
                                    {name.charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background via-background/60 to-transparent" />

                        {/* Player info overlay */}
                        <div className="absolute bottom-4 left-4 flex items-end gap-3">
                            <Avatar
                                src={player.imageUrl || undefined}
                                name={name}
                                className="h-14 w-14 ring-2 ring-background"
                            />
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2
                                        className="text-lg font-bold text-white"
                                        style={{
                                            textShadow:
                                                "0 1px 8px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.6)",
                                        }}
                                    >
                                        {name}
                                    </h2>
                                    {player.hasRoyalPass && (
                                        <Crown className="h-4 w-4 text-yellow-400" />
                                    )}
                                    {isRkoPlayer && (
                                        <button
                                            onClick={toggleRkoMute}
                                            className="ml-0.5 p-0.5 rounded-full hover:bg-white/20 transition-colors"
                                            title={rkoMuted ? "Unmute RKO" : "Mute RKO"}
                                        >
                                            {rkoMuted ? (
                                                <VolumeX className="w-4 h-4 text-foreground/50" />
                                            ) : (
                                                <Volume2 className="w-4 h-4 text-red-500 animate-pulse" />
                                            )}
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <CategoryBadge
                                        category={player.category}
                                        size="sm"
                                    />
                                </div>
                                {player.bio && (
                                    <p className="mt-0.5 text-[10px] italic text-foreground/60">
                                        &ldquo;{player.bio}&rdquo;
                                    </p>
                                )}
                                {player.clan && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowClanMembers(true);
                                        }}
                                        className="mt-1 inline-flex items-center gap-1.5 cursor-pointer"
                                    >
                                        {player.clan.logoUrl && (
                                            <img
                                                src={player.clan.logoUrl}
                                                alt={player.clan.tag}
                                                className="h-4 w-4 rounded-full object-cover"
                                            />
                                        )}
                                        <Chip
                                            size="sm"
                                            variant="flat"
                                            className="text-[10px] h-4 hover:bg-default-200 transition-colors"
                                        >
                                            [{player.clan.tag}] {player.clan.name}
                                        </Chip>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <ModalBody className="space-y-4 px-4 pb-6 pt-0">
                        {/* Stats grid */}
                        <div className="grid grid-cols-2 gap-3">
                            {statCards.map((stat, i) => (
                                <motion.div
                                    key={stat.label}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={isRkoPlayer && !rkoMuted ? {
                                        opacity: 1, y: [0, (-3 + i * 2), (4 - i), 0],
                                        x: [0, (2 - i), (-3 + i), 0],
                                        rotate: [0, (-2 + i), (3 - i * 0.5), 0],
                                    } : { opacity: 1, y: 0, x: 0, rotate: 0 }}
                                    transition={isRkoPlayer && !rkoMuted
                                        ? { duration: 0.3 + i * 0.05, repeat: Infinity, ease: "easeInOut" }
                                        : { delay: 0.1 }
                                    }
                                    className="rounded-xl border border-divider bg-default-100 p-3"
                                >
                                    <div className="flex items-center gap-2">
                                        <stat.icon
                                            className={`h-4 w-4 ${stat.color}`}
                                        />
                                        <span className="text-xs text-foreground/50">
                                            {stat.label}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xl font-bold inline-flex items-center gap-1">
                                        {stat.value}
                                        {(stat as any).suffix}
                                    </p>
                                </motion.div>
                            ))}
                        </div>

                        {/* Action button — becomes RKO equalizer when music is playing */}
                        {isRkoPlayer && !rkoMuted ? (
                            <button
                                onClick={toggleRkoMute}
                                className="flex items-end justify-evenly w-full h-10 px-2 rounded-xl border cursor-pointer border-red-500/50 bg-red-50 dark:bg-red-950/30 shadow-[0_0_12px_rgba(220,38,38,0.2)]"
                                title="Mute"
                            >
                                {Array.from({ length: 24 }, (_, i) => {
                                    const barVariant = (i % 5) + 1;
                                    const delayMs = (i * 50) % 300;
                                    return (
                                        <div
                                            key={i}
                                            className="w-[2px] sm:w-[3px] rounded-full bg-red-500"
                                            style={{
                                                animation: `rkoBar${barVariant} 0.4s ease-in-out ${delayMs}ms infinite alternate`,
                                            }}
                                        />
                                    );
                                })}
                            </button>
                        ) : isOwnProfile ? (
                            <Button
                                color="primary"
                                variant="flat"
                                fullWidth
                                onPress={() => {
                                    onClose();
                                    router.push("/profile");
                                }}
                                className="font-medium"
                            >
                                View Profile
                            </Button>
                        ) : (
                            <Button
                                color="primary"
                                variant="flat"
                                fullWidth
                                onPress={() => setShowUCTransfer(true)}
                                className="font-medium"
                            >
                                {player.isAdmin ? `Send ${GAME.hasDualCurrency ? GAME.entryCurrency : GAME.currency}` : `Send / Request ${GAME.hasDualCurrency ? GAME.entryCurrency : GAME.currency}`}
                            </Button>
                        )}
                    </ModalBody>
                </ModalContent>
            </Modal>

            {/* UC Transfer Dialog */}
            {!isOwnProfile && (
                <UCTransferDialog
                    isOpen={showUCTransfer}
                    onClose={() => setShowUCTransfer(false)}
                    toPlayerId={player.id}
                    toPlayerName={name}
                    sendOnly={player.isAdmin}
                />
            )}

            {/* Clan Members Modal */}
            {player.clan && (
                <ClanMembersModal
                    isOpen={showClanMembers}
                    onClose={() => setShowClanMembers(false)}
                    clanId={player.clan.id}
                    clanName={player.clan.name}
                    clanTag={player.clan.tag}
                />
            )}
        </>
    );
}
