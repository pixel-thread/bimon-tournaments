"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Chip, Avatar, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
import { Users, ChevronRight, ChevronDown, ArrowLeft, Plus, Minus, Shield, Clock, Heart, Info } from "lucide-react";
import { SlotText } from "@/components/common/slot-text";
import { motion, AnimatePresence } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import type { PollDTO } from "@/hooks/use-polls";
import { getPollTheme, getLuckyWinnerTheme, type PollTheme } from "./pollTheme";
import { getPrizeDistribution, getTeamSize, type OrgCutMode } from "@/lib/logic/prizeDistribution";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";
import { SquadCenter } from "./squad-center";
import { CreateSquadModal } from "./create-squad-modal";
import { DonateModal } from "./donate-modal";
import { DonorsModal } from "./donors-modal";
import { useSquads } from "@/hooks/use-squads";
import { useLocale } from "@/components/common/locale-provider";

/* ─── Types ─────────────────────────────────────────────────── */

interface PollCardProps {
    poll: PollDTO;
    onVote: (pollId: string, vote: "IN" | "OUT" | "SOLO") => void;
    /** The poll currently being voted on (undefined if idle) */
    votingPollId?: string;
    /** The vote option being submitted */
    votingVote?: "IN" | "OUT" | "SOLO";
    currentPlayerId?: string;
    onRefetch?: () => void;
    /** Multi-entry: add/remove extra entries (PES) */
    onEntryChange?: (pollId: string, action: "ADD_ENTRY" | "REMOVE_ENTRY") => void;
    entryPending?: boolean;
    isCouponVerifier?: boolean;
}

/* ─── Animated Counter ──────────────────────────────────────── */

function AnimatedCounter({ value }: { value: number }) {
    return (
        <motion.span
            key={value}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
            {value.toLocaleString()}
        </motion.span>
    );
}

/* ─── Prize Breakdown Tooltip ───────────────────────────────── */

function PrizeBreakdownTooltip({
    prizePool,
    entryFee,
    teamSize,
    theme,
    orgPercent,
    orgCutMode,
    onDoubleTap,
}: {
    prizePool: number;
    entryFee: number;
    teamSize: number;
    theme: PollTheme;
    orgPercent: number;
    orgCutMode?: OrgCutMode;
    onDoubleTap?: () => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const lastTapRef = useRef<number>(0);

    const handleTap = useCallback(() => {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
            onDoubleTap?.();
            lastTapRef.current = 0;
        } else {
            lastTapRef.current = now;
            setIsOpen((o) => !o);
        }
    }, [onDoubleTap]);

    return (
        <div
            className="absolute bottom-2 right-3"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            <AnimatePresence mode="wait">
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className={`absolute bottom-0 right-full mr-2 z-50 rounded-lg px-4 py-2 text-sm shadow-2xl bg-gradient-to-br ${theme.header} max-h-48 overflow-y-auto`}
                    >
                        <div className="absolute inset-0 bg-black/10 rounded-lg" />
                        <div className="relative space-y-0.5 whitespace-nowrap text-white">
                            {(() => {
                                const distribution = getPrizeDistribution(prizePool, entryFee, teamSize, orgPercent, orgCutMode);
                                const medals = ["🥇", "🥈", "🥉", "🏅", "🎖️"];
                                return Array.from(distribution.prizes.entries())
                                    .sort(([a], [b]) => a - b)
                                    .map(([position, prize]) => {
                                        const medal = medals[position - 1] || "🏅";
                                        const ordinal =
                                            position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th";
                                        return (
                                            <div key={position} className="flex items-center justify-between gap-4">
                                                <span>
                                                    {medal} {position}{ordinal}
                                                </span>
                                                <span className="font-semibold">
                                                    {prize.amount.toLocaleString()} <CurrencyIcon size={14} />
                                                </span>
                                            </div>
                                        );
                                    });
                            })()}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <button
                type="button"
                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/25 hover:bg-black/40 active:bg-black/50 text-white text-xs font-bold cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md hover:scale-110 backdrop-blur-sm border border-white/20"
                aria-label="View prize breakdown (double-tap to refresh)"
                onClick={handleTap}
            >
                ?
            </button>
        </div>
    );
}

/* ─── Wave SVG Background (crossfade between themes) ──────── */

function WaveBackground({ theme }: { theme: PollTheme }) {
    return (
        <>
            {/* Gradient crossfade — old fades out, new fades in simultaneously */}
            <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                    key={theme.header}
                    className={`absolute inset-0 bg-gradient-to-br ${theme.header}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    style={{ zIndex: 1 }}
                />
            </AnimatePresence>
            {/* Waves (fills transition via CSS) */}
            <div className="absolute bottom-0 left-0 right-0 h-12 overflow-hidden" style={{ zIndex: 2 }}>
                <svg
                    className="absolute bottom-0 w-[200%] h-12 animate-[wave_3s_ease-in-out_infinite]"
                    viewBox="0 0 1200 120"
                    preserveAspectRatio="none"
                >
                    <path
                        d="M0,60 C200,100 400,20 600,60 C800,100 1000,20 1200,60 L1200,120 L0,120 Z"
                        fill={theme.wave1}
                        style={{ transition: "fill 800ms ease-in-out" }}
                    />
                </svg>
                <svg
                    className="absolute bottom-0 w-[200%] h-10 animate-[wave_4s_ease-in-out_infinite_reverse]"
                    viewBox="0 0 1200 120"
                    preserveAspectRatio="none"
                >
                    <path
                        d="M0,60 C200,20 400,100 600,60 C800,20 1000,100 1200,60 L1200,120 L0,120 Z"
                        fill={theme.wave2}
                        style={{ transition: "fill 800ms ease-in-out" }}
                    />
                </svg>
            </div>
            {/* Sparkles */}
            <div className="absolute top-3 left-6 w-1 h-1 bg-white rounded-full animate-ping opacity-75" style={{ zIndex: 2 }} />
            <div
                className={`absolute top-4 right-8 w-1.5 h-1.5 ${theme.sparkle} rounded-full animate-ping opacity-60`}
                style={{ animationDelay: "0.5s", zIndex: 2 }}
            />
            <style jsx>{`
                @keyframes wave {
                    0%, 100% { transform: translateX(0); }
                    50% { transform: translateX(-25%); }
                }
            `}</style>
        </>
    );
}

/* ─── Poll Option ───────────────────────────────────────────── */

function PollOptionRow({
    label,
    isSelected,
    isLoading,
    disabled,
    voteCount,
    percentage,
    voters,
    theme,
    currentPlayerId,
    onClick,
    onLongPress,
}: {
    label: string;
    isSelected: boolean;
    isLoading: boolean;
    disabled: boolean;
    voteCount: number;
    percentage: number;
    voters: PollDTO["playersVotes"];
    theme: PollTheme | null;
    currentPlayerId?: string;
    onClick: () => void;
    onLongPress?: () => void;
}) {
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const didLongPress = useRef(false);

    const startPress = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isSelected || !onLongPress) return;
        // Prevent context menu on long-press (mobile)
        e.preventDefault();
        didLongPress.current = false;
        longPressTimer.current = setTimeout(() => {
            didLongPress.current = true;
            // Vibrate feedback if available
            if (navigator.vibrate) navigator.vibrate(50);
            onLongPress();
        }, 3000);
    };
    const cancelPress = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
    const handleClick = () => {
        if (didLongPress.current) { didLongPress.current = false; return; }
        onClick();
    };
    // Put current user first so their avatar always shows
    const displayVoters = useMemo(() => {
        if (!currentPlayerId || voters.length === 0) return voters;
        const me = voters.find((v) => v.playerId === currentPlayerId);
        if (!me) return voters;
        return [me, ...voters.filter((v) => v.playerId !== currentPlayerId)];
    }, [voters, currentPlayerId]);
    return (
        <button
            type="button"
            onClick={handleClick}
            onTouchStart={startPress}
            onTouchEnd={cancelPress}
            onTouchCancel={cancelPress}
            onTouchMove={cancelPress}
            onMouseDown={startPress}
            onMouseUp={cancelPress}
            onMouseLeave={cancelPress}
            onContextMenu={(e) => { if (isSelected && onLongPress) e.preventDefault(); }}
            disabled={isLoading || disabled}
            className={`
                w-full text-left relative overflow-hidden group py-4 px-4 rounded-xl border-2
                transition-all duration-150 transform hover:scale-[1.01] active:scale-[0.99]
                ${isSelected
                    ? theme
                        ? `${theme.optionSelected.border} ${theme.optionSelected.bg} shadow-md`
                        : "shadow-md"
                    : theme
                        ? `${theme.optionUnselected.border} bg-white dark:bg-gray-800 hover:shadow-sm`
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm"
                }
                ${isLoading ? "cursor-wait opacity-80" : "cursor-pointer"}
                ${disabled && !isLoading ? "opacity-60 cursor-not-allowed" : ""}
            `}
            style={{
                ...(isSelected && !theme ? {
                    borderColor: 'var(--game-primary)',
                    backgroundColor: 'color-mix(in srgb, var(--game-primary) 8%, transparent)',
                } : {}),
                ...(isSelected && onLongPress ? {
                    WebkitTouchCallout: 'none',
                    WebkitUserSelect: 'none',
                    touchAction: 'manipulation',
                } as React.CSSProperties : {}),
            }}
        >
            <div className="flex items-center justify-between">
                {/* Radio + Label */}
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div
                        className={`
                            w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 flex-shrink-0
                            ${isSelected
                                ? theme
                                    ? `${theme.optionSelected.radio} shadow-sm`
                                    : "shadow-sm"
                                : theme
                                    ? theme.optionUnselected.radio
                                    : "border-gray-300 dark:border-gray-600"
                            }
                        `}
                        style={isSelected && !theme ? {
                            borderColor: 'var(--game-primary)',
                            backgroundColor: 'var(--game-primary)',
                        } : undefined}
                    >
                        {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                    </div>
                    <span
                        className={`font-medium text-base truncate block ${isSelected
                            ? theme
                                ? theme.optionSelected.text
                                : "game-text"
                            : "text-gray-900 dark:text-white"
                            }`}
                    >
                        {label}
                    </span>
                    {isLoading && (
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    )}
                </div>

                {/* Voter avatars + count */}
                {voteCount > 0 && (
                    <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                        {voters.length > 0 && (
                            <div className="flex -space-x-1.5">
                                {displayVoters.slice(0, 2).map((v) => (
                                    <Avatar
                                        key={v.playerId}
                                        src={v.imageUrl}
                                        name={v.displayName}
                                        size="sm"
                                        className="w-6 h-6 border-2 border-white dark:border-gray-800"
                                    />
                                ))}
                            </div>
                        )}
                        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                            <SlotText value={String(voteCount)} charDelay={0.03} />
                        </span>
                    </div>
                )}
            </div>

            {/* Progress bar */}
            {voteCount > 0 && (
                <div className="mt-3">
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                            className={
                                isSelected
                                    ? theme
                                        ? `h-full rounded-full ${theme.optionSelected.radio}`
                                        : "h-full rounded-full"
                                    : "h-full rounded-full bg-gray-400 dark:bg-gray-500"
                            }
                            style={isSelected && !theme ? { backgroundColor: 'var(--game-primary)' } : undefined}
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                    </div>
                </div>
            )}
        </button>
    );
}

/* ─── Voters Dialog (v1-style) ──────────────────────────────── */

function VotersDialog({
    isOpen,
    onClose,
    poll,
    votersByVote,
    selectedGroup,
    onSelectGroup,
    teamType,
    theme,
}: {
    isOpen: boolean;
    onClose: () => void;
    poll: PollDTO;
    votersByVote: Record<string, PollDTO["playersVotes"]>;
    selectedGroup: "IN" | "OUT" | "SOLO" | null;
    onSelectGroup: (g: "IN" | "OUT" | "SOLO" | null) => void;
    teamType: string;
    theme: PollTheme | null;
}) {
    const { tk } = useLocale();
    const allVoteTypes = GAME.features.hasTeamSizes
        ? (["IN", "OUT", "SOLO"] as const)
        : (["IN", "OUT"] as const);
    const groups = allVoteTypes.map((voteType) => {
        const voters = votersByVote[voteType] ?? [];
        return { voteType, voters, count: voters.length };
    });
    const maxCount = Math.max(...groups.map((g) => g.count), 1);


    const selectedVoters = selectedGroup ? (votersByVote[selectedGroup] ?? []) : [];
    const getLabel = (v: string) => {
        const opt = poll.options?.find((o) => o.vote === v);
        if (opt?.name) return opt.name;
        return v === "IN"
            ? tk("votedIn")
            : v === "OUT"
                ? tk("votedOut")
                : tk("votedSolo");
    };
    const getColor = (v: string) => v === "IN" ? "bg-emerald-500" : v === "OUT" ? "bg-red-500" : "bg-amber-500";

    return (
        <Modal isOpen={isOpen} onClose={onClose} placement="center" size="md" scrollBehavior="inside">
            <ModalContent>
                <ModalHeader className="flex items-center gap-2 text-base pb-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${theme ? `bg-gradient-to-r ${theme.header}` : 'bg-primary'}`}>
                        <Users className="w-3.5 h-3.5 text-white" />
                    </div>
                    {poll.tournament?.name || poll.question}
                </ModalHeader>
                <ModalBody className="px-4 py-3">
                    {!selectedGroup ? (
                        /* ── Overview: vote groups ── */
                        <div className="space-y-3">
                            <p className="text-xs text-foreground/50">
                                {poll.totalVotes} total vote{poll.totalVotes !== 1 ? "s" : ""}
                            </p>
                            {groups.map(({ voteType, voters, count }) => {
                                if (count === 0) return null;
                                const pct = Math.round((count / maxCount) * 100);
                                return (
                                    <div key={voteType} className="rounded-xl border border-divider p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-medium text-sm">{getLabel(voteType)}</h4>
                                            <span className="text-sm text-foreground/50">{count} vote{count !== 1 ? "s" : ""}</span>
                                        </div>
                                        <div className="w-full h-2 bg-default-200 rounded-full overflow-hidden">
                                            <motion.div
                                                className={`h-full rounded-full ${getColor(voteType)}`}
                                                initial={{ width: 0 }}
                                                animate={{ width: `${pct}%` }}
                                                transition={{ duration: 0.5, ease: "easeOut" }}
                                            />
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="flex -space-x-2">
                                                {voters.slice(0, 4).map((v) => (
                                                    <Avatar
                                                        key={v.playerId}
                                                        src={v.imageUrl}
                                                        name={v.displayName}
                                                        size="sm"
                                                        className="w-6 h-6 border-2 border-background"
                                                    />
                                                ))}
                                                {count > 4 && (
                                                    <div className="w-7 h-7 rounded-full bg-default-200 flex items-center justify-center text-[11px] font-bold border-2 border-background z-10">
                                                        +{count - 4}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => onSelectGroup(voteType)}
                                                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
                                            >
                                                <Users className="w-3.5 h-3.5" />
                                                See all {count} voters
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* ── Drill-down: voter list ── */
                        <div className="space-y-2">
                            <p className="text-xs text-foreground/50 mb-2">
                                Voters for &quot;{getLabel(selectedGroup)}&quot;
                            </p>
                            {(() => {
                                const isKnockout = poll.tournament?.type === "BRACKET_1V1";
                                const inSoloVoters = selectedGroup === "IN" || selectedGroup === "SOLO";

                                // ── Calculate cutoff for different modes ──
                                let cutoffSize = 0;
                                let cutoffLabel = "";

                                if (isKnockout && inSoloVoters) {
                                    // Bracket: power-of-2 cutoff
                                    const totalIn = (votersByVote["IN"]?.length ?? 0) + (votersByVote["SOLO"]?.length ?? 0);
                                    let p = 2;
                                    while (p * 2 <= totalIn) p *= 2;
                                    cutoffSize = totalIn >= 2 ? p : 0;
                                    cutoffLabel = `⚔️ Bracket: ${cutoffSize} players`;
                                } else if (inSoloVoters && poll.allowSquads && selectedGroup === "IN") {
                                    // Squad polls: only full teams from randoms
                                    const inCount = votersByVote["IN"]?.length ?? 0;
                                    const sqSize = GAME.squadSize ?? 5;
                                    if (inCount < sqSize) {
                                        // Not enough for even 1 team — all show clock
                                        cutoffSize = 0;
                                    } else {
                                        cutoffSize = Math.floor(inCount / sqSize) * sqSize;
                                        if (cutoffSize < inCount) {
                                            cutoffLabel = `🛡 ${Math.floor(inCount / sqSize)} teams × ${sqSize} players`;
                                        }
                                    }
                                } else if (inSoloVoters && selectedGroup === "IN") {
                                    // BR team modes: perfect multiple cutoff
                                    const inCount = votersByVote["IN"]?.length ?? 0;
                                    const tType = teamType;
                                    const teamSz = tType === "SQUAD" ? 4 : tType === "TRIO" ? 3 : tType === "DUO" ? 2 : 0;
                                    if (teamSz >= 2 && inCount > teamSz) {
                                        cutoffSize = Math.floor(inCount / teamSz) * teamSz;
                                        if (cutoffSize < inCount) {
                                            cutoffLabel = `👥 ${tType}: ${Math.floor(inCount / teamSz)} teams × ${teamSz}`;
                                        }
                                    }
                                }

                                // Sort by createdAt descending (newest on top, earliest at bottom)
                                const sorted = [...selectedVoters].sort((a, b) =>
                                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                                );

                                // Build FCFS list sorted ascending (earliest first) for cutoff check
                                const allInSolo = (isKnockout && inSoloVoters)
                                    ? [...(votersByVote["IN"] ?? []), ...(votersByVote["SOLO"] ?? [])]
                                        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                                    : [...selectedVoters].sort((a, b) =>
                                        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                                    );

                                const hasWaitlist = cutoffSize > 0 && allInSolo.length > cutoffSize;

                                return (
                                    <div className="space-y-1">
                                        {sorted.map((v, i) => {
                                            // Counter: #1 = first voter (reverse the display index)
                                            const voteNumber = sorted.length - i;

                                            // Check if this voter is waitlisted (beyond cutoff in FCFS order)
                                            // For squad polls with cutoffSize=0 (not enough for 1 team), ALL are waitlisted
                                            const allWaitlisted = cutoffSize === 0 && poll.allowSquads && selectedGroup === "IN" && allInSolo.length > 0;
                                            const globalIdx = cutoffSize > 0
                                                ? allInSolo.findIndex(x => x.playerId === v.playerId)
                                                : -1;
                                            const isWaitlisted = allWaitlisted || (cutoffSize > 0 && globalIdx >= cutoffSize);

                                            return (
                                                <div
                                                    key={v.playerId}
                                                    className="flex items-center gap-3 p-2.5 rounded-lg transition-colors bg-default-50 hover:bg-default-100"
                                                >
                                                    <span className="text-[10px] font-mono text-foreground/30 w-4 text-right">
                                                        {voteNumber}
                                                    </span>
                                                    <Avatar
                                                        src={v.imageUrl}
                                                        name={v.displayName}
                                                        size="sm"
                                                        className="w-8 h-8 flex-shrink-0"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate flex items-center gap-1.5">
                                                            {v.displayName}
                                                            {(v.voteCount ?? 1) > 1 && (
                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                                                                    ×{v.voteCount}
                                                                </span>
                                                            )}
                                                            {isWaitlisted && (
                                                                <Clock className="w-3 h-3 text-warning flex-shrink-0" />
                                                            )}
                                                        </p>
                                                        {v.createdAt && (
                                                            <p className="text-[11px] text-foreground/40">
                                                                {new Date(v.createdAt).toLocaleString("en-US", {
                                                                    day: "numeric",
                                                                    month: "short",
                                                                    hour: "numeric",
                                                                    minute: "2-digit",
                                                                    second: "2-digit",
                                                                    hour12: true,
                                                                })}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </ModalBody>
                <ModalFooter>
                    {selectedGroup ? (
                        <Button
                            variant="flat"
                            className="w-full"
                            startContent={<ArrowLeft className="w-4 h-4" />}
                            onPress={() => onSelectGroup(null)}
                        >
                            Back
                        </Button>
                    ) : (
                        <Button variant="flat" className="w-full" onPress={onClose}>
                            Close
                        </Button>
                    )}
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

/* ─── Main Poll Card ────────────────────────────────────────── */

export function PollCard({ poll, onVote, votingPollId, votingVote, currentPlayerId, onRefetch, onEntryChange, entryPending, isCouponVerifier }: PollCardProps) {
    const { tk } = useLocale();
    const isThisPollVoting = votingPollId === poll.id;
    const { tournament } = poll;
    const [showVoters, setShowVoters] = useState(false);
    const [selectedVoteGroup, setSelectedVoteGroup] = useState<"IN" | "OUT" | "SOLO" | null>(null);
    const [showSquads, setShowSquads] = useState(false);
    const [showSquadInfo, setShowSquadInfo] = useState(false);
    const [showCasualInfo, setShowCasualInfo] = useState(false);
    const [showScheduleInfo, setShowScheduleInfo] = useState(false);
    const [showCreateSquad, setShowCreateSquad] = useState(false);
    const [showDonate, setShowDonate] = useState(false);
    const [showDonors, setShowDonors] = useState(false);
    const [squadVoteWarning, setSquadVoteWarning] = useState<{ vote: "IN" | "OUT" | "SOLO"; squadName: string; isCaptain: boolean } | null>(null);

    // Squad data for vote warning (only fetched for squad polls)
    const { data: squadsData } = useSquads(poll.allowSquads ? poll.id : undefined);

    // Secret unvote: 3s long-press on selected option
    const handleUnvote = useCallback(async () => {
        try {
            const res = await fetch("/api/polls/vote", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pollId: poll.id }),
            });
            if (res.ok) {
                onRefetch?.();
            }
        } catch { /* silent */ }
    }, [poll.id, onRefetch]);

    // Check if current player has any pending captain-initiated invite
    const hasPendingSquadInvite = !!(squadsData && currentPlayerId && squadsData.some(s =>
        s.members.some(m => m.playerId === currentPlayerId && m.status === "PENDING" && m.initiatedBy === "CAPTAIN")
    ));

    // Fetch real settings so ? tooltip shows accurate org%
    const { data: publicSettings } = useQuery({
        queryKey: ["public-settings"],
        queryFn: async () => {
            const res = await fetch("/api/settings/public");
            if (!res.ok) return { orgCutFixed: 0, orgCutPercent: 0, orgCutMode: "fixed" };
            const json = await res.json();
            return json.data ?? { orgCutFixed: 0, orgCutPercent: 0, orgCutMode: "fixed" };
        },
        staleTime: 60_000, // Cache for 1 min — settings rarely change
    });
    const orgCutMode = publicSettings?.orgCutMode ?? "fixed";
    const orgCut = orgCutMode === "percent" ? (publicSettings?.orgCutPercent ?? 0) : (publicSettings?.orgCutFixed ?? 0);

    // Marquee for long titles
    const titleRef = useRef<HTMLHeadingElement>(null);
    const [isTitleOverflowing, setIsTitleOverflowing] = useState(false);
    const [titleOverflowPx, setTitleOverflowPx] = useState(0);

    useEffect(() => {
        const el = titleRef.current;
        if (el) {
            const overflow = el.scrollWidth - el.clientWidth;
            setIsTitleOverflowing(overflow > 0);
            setTitleOverflowPx(overflow);
        }
    }, [poll.question, tournament?.name]);

    // Participants = IN + SOLO
    const participantCount = poll.inVotes + poll.soloVotes;
    const entryFee = tournament?.fee ?? 0;
    const donationTotal = poll.donations?.total ?? 0;
    // Squad polls: fee is per-team → squads + estimated random teams from IN voters
    const estimatedTeams = poll.allowSquads && GAME.squadSize > 1
        ? (poll.squadCount ?? 0) + Math.floor(participantCount / GAME.squadSize)
        : participantCount; // Regular: fee × players
    const prizePool = (entryFee * estimatedTeams) + donationTotal;
    const hasPrizePool = prizePool > 0;
    const hasEntryFee = entryFee > 0;
    const showThemedHeader = hasPrizePool || hasEntryFee;

    // Dynamic team type — based on IN votes only (SOLO players play alone)
    const effectiveTeamType = useMemo(() => {
        if (poll.teamType !== "DYNAMIC") return poll.teamType;
        // < 40 = TRIO, ≥ 40 = SQUAD
        return poll.inVotes < 40 ? "TRIO" : "SQUAD";
    }, [poll.teamType, poll.inVotes]);

    // Theme — show themed header if there's a prize pool OR an entry fee (even 0 votes)
    const isLuckyVoter = !!currentPlayerId && poll.luckyVoterId === currentPlayerId;
    // For squad polls, compute theme based on teams × squadSize (not raw IN votes)
    const themeParticipantCount = poll.allowSquads
        ? estimatedTeams * (GAME.squadSize ?? 4)
        : participantCount;
    const theme = isLuckyVoter
        ? getLuckyWinnerTheme()
        : showThemedHeader
            ? (getPollTheme(themeParticipantCount) ?? getPollTheme(1))
            : null;

    // Multi-entry support (PES only)
    const hasMultiEntry = GAME.features.hasMultiEntry;
    const userVoteCount = poll.userVoteCount ?? 1;
    const canAddEntry = poll.hasVoted && poll.userVote === "IN" && hasMultiEntry && poll.isActive;
    const canRemoveEntry = canAddEntry && userVoteCount > 1;

    // Get option names from DB, fall back to defaults
    const getOptionName = (vote: string) => {
        const opt = poll.options?.find((o: { vote: string; name: string }) => o.vote === vote);
        return opt?.name || (vote === "IN"
            ? tk("votedIn")
            : vote === "OUT"
                ? tk("votedOut")
                : tk("votedSolo"));
    };

    // Vote breakdown for each option (percentage relative to max)
    const options: { label: string; vote: "IN" | "OUT" | "SOLO"; count: number }[] = [
        { label: getOptionName("IN"), vote: "IN", count: poll.inVotes },
        { label: getOptionName("OUT"), vote: "OUT", count: poll.outVotes },
        // SOLO only exists for BR games with team sizes — hide for PES/1v1 and squad polls
        ...(GAME.features.hasTeamSizes && !poll.allowSquads
            ? [{ label: getOptionName("SOLO"), vote: "SOLO" as const, count: poll.soloVotes }]
            : []),
    ];
    const maxCount = Math.max(...options.map((o) => o.count), 1);

    // Voters per option
    const votersByVote = useMemo(() => {
        const map: Record<string, typeof poll.playersVotes> = { IN: [], OUT: [], SOLO: [] };
        for (const v of poll.playersVotes) {
            if (map[v.vote]) map[v.vote].push(v);
        }
        return map;
    }, [poll.playersVotes]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="max-w-2xl mx-auto"
        >
            {/* Compact Donation Badge + Donate Button */}
            {theme && (
                <div className="flex items-center justify-center gap-2 mb-[-8px] relative z-10">
                    <AnimatePresence mode="popLayout" initial={false}>
                        {donationTotal > 0 && (() => {
                            // Combine same-player donations into one entry
                            const grouped = new Map<string, typeof poll.donations.donations[0]>();
                            for (const d of poll.donations.donations) {
                                if (d.isAnonymous || !d.playerName) {
                                    grouped.set(`_anon_${grouped.size}`, d);
                                    continue;
                                }
                                const existing = grouped.get(d.playerName);
                                if (existing) {
                                    grouped.set(d.playerName, { ...existing, amount: existing.amount + d.amount });
                                } else {
                                    grouped.set(d.playerName, { ...d });
                                }
                            }
                            const sortedDonations = Array.from(grouped.values()).sort((a, b) => b.amount - a.amount);
                            const topDonor = sortedDonations[0];
                            const extraCount = sortedDonations.length - 1;
                            const donorName = topDonor.isAnonymous ? "Anonymous" : (topDonor.playerName || "Community");
                            return (
                                <motion.button
                                    key="donation-badge"
                                    type="button"
                                    onClick={() => setShowDonors(true)}
                                    className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-sm font-semibold shadow-lg hover:shadow-xl transition-shadow cursor-pointer overflow-hidden relative`}
                                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                >
                                    {/* Crossfading gradient bg */}
                                    <AnimatePresence mode="popLayout" initial={false}>
                                        <motion.div
                                            key={theme.header}
                                            className={`absolute inset-0 bg-gradient-to-r ${theme.header}`}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.6 }}
                                        />
                                    </AnimatePresence>
                                    <span className="relative z-10">
                                        <SlotText value={`${donorName} donated ${topDonor.amount}`} charDelay={0.012} />
                                    </span>
                                    <span className="relative z-10"><CurrencyIcon size={13} /></span>
                                    {extraCount > 0 && (
                                        <span className="relative z-10 bg-white/25 px-1.5 py-0.5 rounded-md text-xs font-bold ml-0.5">
                                            <SlotText value={`+${extraCount}`} charDelay={0.03} />
                                        </span>
                                    )}
                                </motion.button>
                            );
                        })()}
                    </AnimatePresence>
                    {poll.isActive && (
                        <button
                            type="button"
                            onClick={() => setShowDonate(true)}
                            className={`w-7 h-7 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all cursor-pointer border border-white/20 overflow-hidden relative`}
                            title="Donate to prize pool"
                        >
                            <AnimatePresence mode="popLayout" initial={false}>
                                <motion.div
                                    key={theme.header}
                                    className={`absolute inset-0 bg-gradient-to-r ${theme.header}`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.6 }}
                                />
                            </AnimatePresence>
                            <Plus className="w-3.5 h-3.5 text-white relative z-10" />
                        </button>
                    )}

                </div>
            )}
            <div
                className={`relative rounded-xl overflow-hidden transition-all duration-700 ease-in-out ${theme
                    ? theme.card
                    : "bg-white dark:bg-gray-800 shadow-sm border game-card"
                    }`}
            >
                {/* ─── Header with Prize Pool ─── */}
                <div className={showThemedHeader ? "relative overflow-hidden" : ""}>
                    {theme && <WaveBackground theme={theme} />}

                    <div
                        className={`relative z-10 p-6 ${showThemedHeader ? "pb-8" : "border-b border-gray-100 dark:border-gray-700"}`}
                    >
                        {/* Title + Day badge */}
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0 overflow-x-hidden">
                                <div className="overflow-x-hidden overflow-y-visible">
                                    <h3
                                        ref={titleRef}
                                        className={`font-semibold text-lg whitespace-nowrap ${isTitleOverflowing ? "animate-marquee" : ""} ${showThemedHeader ? "text-white drop-shadow-md" : "text-gray-900 dark:text-white"}`}
                                        title={tournament?.name || poll.question}
                                        style={isTitleOverflowing ? { '--marquee-offset': `-${titleOverflowPx + 8}px` } as React.CSSProperties : undefined}
                                    >
                                        <SlotText value={tournament?.name || poll.question} charDelay={0.015} />
                                    </h3>
                                </div>
                                <style jsx>{`
                                    @keyframes marquee {
                                        0%, 15% { transform: translateX(0); }
                                        40%, 60% { transform: translateX(var(--marquee-offset, -20px)); }
                                        85%, 100% { transform: translateX(0); }
                                    }
                                    .animate-marquee {
                                        display: inline-block;
                                        animation: marquee 6s ease-in-out infinite;
                                    }
                                    @media (min-width: 640px) {
                                        .animate-marquee {
                                            animation: none;
                                            overflow: hidden;
                                            text-overflow: ellipsis;
                                            display: block;
                                        }
                                    }
                                `}</style>
                            </div>
                            {poll.days && (() => {
                                const DAY_MAP: Record<string, number> = {
                                    sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2,
                                    wed: 3, wednesday: 3, thu: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
                                };
                                // Find the first recognizable day name in the string
                                const lower = poll.days!.toLowerCase();
                                let dayIdx = -1;
                                for (const [abbr, idx] of Object.entries(DAY_MAP)) {
                                    const pos = lower.indexOf(abbr);
                                    if (pos >= 0 && (pos === 0 || /\W/.test(lower[pos - 1]))) {
                                        dayIdx = idx;
                                        break;
                                    }
                                }
                                if (dayIdx < 0) return <Chip size="sm" variant="flat" className="bg-black/25 text-white backdrop-blur-sm font-semibold">{poll.days}</Chip>;
                                const today = new Date().getDay();
                                const diff = (dayIdx - today + 7) % 7;
                                const label = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : `in ${diff} days`;
                                const isToday = diff === 0;
                                const isTomorrow = diff === 1;
                                return (
                                    <Chip
                                        size="sm"
                                        variant="flat"
                                        className="bg-black/25 text-white backdrop-blur-sm font-semibold"
                                    >
                                        {isToday && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1 animate-pulse" />}
                                        {isTomorrow && <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 mr-1" />}
                                        {label}
                                    </Chip>
                                );
                            })()}
                        </div>

                        {/* Prize Pool */}
                        {theme && (
                            <>
                                <div className="mt-3 flex items-center justify-center gap-3">
                                    <span className="text-3xl">🏆</span>
                                    <div className="text-center">
                                        <p className="text-xs font-medium text-white/80 uppercase tracking-widest">
                                            Prize Pool
                                        </p>
                                        <p className="text-2xl font-black text-white drop-shadow-lg inline-flex items-center">
                                            <AnimatedCounter value={prizePool} />
                                            <span className="ml-1"><CurrencyIcon size={20} /></span>
                                        </p>
                                    </div>
                                </div>
                                {/* Prize breakdown ? button — only for BR games (BGMI tier system) */}
                                {GAME.features.hasBR && <PrizeBreakdownTooltip
                                    prizePool={prizePool}
                                    entryFee={entryFee}
                                    teamSize={poll.allowSquads ? 1 : effectiveTeamType === "SOLO" ? 1 : effectiveTeamType === "DUO" ? 2 : effectiveTeamType === "TRIO" ? 3 : 4}
                                    theme={theme}
                                    orgPercent={orgCut}
                                    orgCutMode={orgCutMode}
                                    onDoubleTap={onRefetch}
                                />}
                                {/* Team type badge — only for BR games with team sizes */}
                                {GAME.features.hasTeamSizes && effectiveTeamType && (
                                    <div className="absolute bottom-2 left-3">
                                        <span
                                            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-black/25 text-white border border-white/20 backdrop-blur-sm overflow-y-visible"
                                        >
                                            <SlotText value={effectiveTeamType} charDelay={0.03} />
                                        </span>
                                    </div>
                                )}
                                {/* TDM / WoW badge */}
                                {(tournament?.isTDM || tournament?.isWoW) && (
                                    <div className={`absolute bottom-2 ${GAME.features.hasTeamSizes && effectiveTeamType ? "left-[90px]" : "left-3"}`}>
                                        <Chip
                                            size="sm"
                                            color={tournament?.isWoW ? "warning" : "danger"}
                                            variant="flat"
                                            className="font-bold bg-black/25 text-white border border-white/20 backdrop-blur-sm"
                                        >
                                            {tournament?.isWoW ? "🌟 WoW" : "⚔️ TDM"}
                                        </Chip>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* ─── Options ─── */}
                {(
                    <div className="relative p-6">
                        {/* Crossfading background */}
                        <AnimatePresence mode="popLayout" initial={false}>
                            <motion.div
                                key={theme?.options ?? "default"}
                                className={`absolute inset-0 ${theme ? theme.options : ""}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.8, ease: "easeInOut" }}
                            />
                        </AnimatePresence>
                        <div className="relative space-y-3">
                        {options.map((opt) => (
                            <PollOptionRow
                                key={opt.vote}
                                label={opt.label}
                                isSelected={poll.userVote === opt.vote}
                                isLoading={isThisPollVoting && votingVote === opt.vote}
                                disabled={!poll.isActive || (isThisPollVoting && votingVote !== opt.vote)}
                                voteCount={opt.count}
                                percentage={Math.round((opt.count / maxCount) * 100)}
                                voters={votersByVote[opt.vote] ?? []}
                                theme={theme}
                                currentPlayerId={currentPlayerId}
                                onClick={() => {
                                    if (poll.userVote !== opt.vote && opt.vote !== "OUT" && poll.allowSquads && currentPlayerId && squadsData) {
                                        // Check if player is in a squad for this poll
                                        const mySquad = squadsData.find(s =>
                                            s.isCaptain || s.members.some(m => m.playerId === currentPlayerId && m.status === "ACCEPTED")
                                        );
                                        if (mySquad) {
                                            setSquadVoteWarning({
                                                vote: opt.vote,
                                                squadName: mySquad.name,
                                                isCaptain: mySquad.isCaptain,
                                            });
                                            return;
                                        }
                                    }
                                    if (poll.userVote !== opt.vote) onVote(poll.id, opt.vote);
                                }}
                                onLongPress={poll.userVote === opt.vote ? handleUnvote : undefined}
                            />
                        ))}

                        {/* ─── Multi-Entry Controls (PES) ─── */}
                        {canAddEntry && (
                            <div className={`mt-3 flex items-center justify-between rounded-xl border px-4 py-3 ${theme ? `${theme.optionSelected.border} ${theme.optionSelected.bg}` : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'}`}>
                                <p className={`text-sm font-semibold ${theme ? theme.optionSelected.text : 'text-blue-700 dark:text-blue-300'}`}>
                                    Rung {userVoteCount + 1} tylli?
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        disabled={!canRemoveEntry || entryPending}
                                        onClick={() => onEntryChange?.(poll.id, "REMOVE_ENTRY")}
                                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border
                                            ${canRemoveEntry && !entryPending
                                                ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-600 hover:bg-red-200 cursor-pointer'
                                                : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                            }`}
                                    >
                                        <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <span className={`text-lg font-bold min-w-[2rem] text-center tabular-nums ${theme ? theme.optionSelected.text : 'text-blue-700 dark:text-blue-300'}`}>
                                        {entryPending ? (
                                            <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        ) : userVoteCount}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={entryPending}
                                        onClick={() => onEntryChange?.(poll.id, "ADD_ENTRY")}
                                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border
                                            ${!entryPending
                                                ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-600 hover:bg-emerald-200 cursor-pointer'
                                                : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                            }`}
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                    </div>
                )}




                {/* ─── Footer ─── */}
                <div className="relative px-6 pb-5">
                    {/* Crossfading background */}
                    <AnimatePresence mode="popLayout" initial={false}>
                        <motion.div
                            key={theme?.footer ?? "default-footer"}
                            className={`absolute inset-0 ${theme ? theme.footer : ""}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.8, ease: "easeInOut" }}
                        />
                    </AnimatePresence>
                    <div className="relative">
                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-3">
                            <span className="flex items-center space-x-1">
                            <Users className="w-4 h-4" />
                            <span>
                                <SlotText
                                    value={poll.allowSquads
                                        ? `${estimatedTeams} team${estimatedTeams !== 1 ? "s" : ""}`
                                        : `${poll.totalVotes} vote${poll.totalVotes !== 1 ? "s" : ""}`
                                    }
                                    charDelay={0.02}
                                />
                            </span>
                        </span>
                        <span className="text-xs">
                            {isLuckyVoter && entryFee > 0 ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                    🎉 FREE ENTRY:{" "}
                                    <span className="line-through opacity-60">{entryFee}</span> 0
                                    {GAME.hasDualCurrency ? ` ${GAME.entryCurrency}` : GAME.currency}
                                </span>
                            ) : entryFee > 0 ? (
                                <span className="inline-flex items-center gap-1">
                                    <SlotText value={`Entry: ${entryFee}`} charDelay={0.02} /> {GAME.hasDualCurrency ? GAME.entryCurrency : <CurrencyIcon size={12} />}
                                </span>
                            ) : (
                                <SlotText value="Free Entry" charDelay={0.02} />
                            )}
                        </span>
                    </div>

                    {poll.totalVotes > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowVoters(true)}
                            className={`w-full text-center font-medium py-2.5 px-4 rounded-xl transition-all border shadow-sm cursor-pointer hover:shadow-md ${
                                theme
                                    ? `${theme.optionSelected.border} ${theme.optionSelected.bg} ${theme.optionSelected.text}`
                                    : ''
                            }`}
                            style={!theme ? { color: 'var(--game-primary)', backgroundColor: 'color-mix(in srgb, var(--game-primary) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--game-primary) 20%, transparent)' } : undefined}
                        >
                            <span className="flex items-center justify-center gap-2">
                                <Users className="w-4 h-4" />
                                View all votes
                            </span>
                        </button>
                    )}

                    {/* Squad buttons — only for polls with allowSquads */}
                    {poll.allowSquads && (
                        <div className="space-y-2 mt-2">
                            <div className="relative">
                                {/* Rotating border glow for pending invite */}
                                {hasPendingSquadInvite && (() => {
                                    // Use theme's wave color for glow, fallback to game primary
                                    const glowColor = theme?.wave1
                                        ? theme.wave1.replace(/[\d.]+\)$/, '0.9)')
                                        : 'var(--game-primary)';
                                    return (
                                        <>
                                            <div className="absolute -inset-[2px] rounded-xl overflow-hidden">
                                                <div
                                                    className="absolute inset-0 animate-spin-slow"
                                                    style={{
                                                        background: `conic-gradient(from 0deg, transparent 0%, transparent 25%, ${glowColor} 40%, ${glowColor} 60%, transparent 75%, transparent 100%)`,
                                                    }}
                                                />
                                            </div>
                                            <div className="absolute inset-[1px] rounded-[10px] bg-background z-[1]" />
                                        </>
                                    );
                                })()}
                                <button
                                    type="button"
                                    onClick={() => setShowSquads(true)}
                                    className={`relative z-[2] w-full text-center font-semibold py-3 px-4 rounded-xl transition-all border shadow-sm cursor-pointer hover:shadow-md ${
                                        theme
                                            ? `${theme.optionSelected.border} ${theme.optionSelected.bg} ${theme.optionSelected.text}`
                                            : 'text-primary bg-primary/5 border-primary/20 hover:bg-primary/10'
                                    } ${hasPendingSquadInvite ? 'border-transparent' : ''}`}
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        🛡 View Teams
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Info row — squad/casual info + schedule side by side */}
                    <div className="flex items-center justify-center gap-3 mt-2">
                        {poll.allowSquads && (
                            <button
                                type="button"
                                onClick={() => { setShowSquadInfo(!showSquadInfo); setShowScheduleInfo(false); }}
                                className="flex items-center gap-1 text-[11px] text-foreground/40 hover:text-foreground/60 transition-colors py-1"
                            >
                                <Info className="w-3 h-3" />
                                Squad info
                                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showSquadInfo ? 'rotate-180' : ''}`} />
                            </button>
                        )}
                        {!poll.allowSquads && GAME.features.hasTeamSizes && (
                            <button
                                type="button"
                                onClick={() => { setShowCasualInfo(!showCasualInfo); setShowScheduleInfo(false); }}
                                className="flex items-center gap-1 text-[11px] text-foreground/40 hover:text-foreground/60 transition-colors py-1"
                            >
                                <Info className="w-3 h-3" />
                                Voting info
                                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showCasualInfo ? 'rotate-180' : ''}`} />
                            </button>
                        )}
                        {poll.days && (
                            <>
                                {(poll.allowSquads || (!poll.allowSquads && GAME.features.hasTeamSizes)) && (
                                    <span className="h-3 w-px bg-foreground/15" />
                                )}
                                <button
                                    type="button"
                                    onClick={() => { setShowScheduleInfo(!showScheduleInfo); setShowSquadInfo(false); setShowCasualInfo(false); }}
                                    className="flex items-center gap-1 text-[11px] text-foreground/40 hover:text-foreground/60 transition-colors py-1"
                                >
                                    📅 Schedule
                                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showScheduleInfo ? 'rotate-180' : ''}`} />
                                </button>
                            </>
                        )}
                    </div>

                    {/* Expanded info panels */}
                    {showSquadInfo && poll.allowSquads && (
                        <p className="text-[11px] text-foreground/40 text-center px-4 pb-1 animate-in fade-in duration-200">
                            Players who vote &quot;{poll.options?.find(o => o.vote === "IN")?.name || tk("votedIn")}&quot; without joining a squad will be placed in randomly assigned teams.
                        </p>
                    )}
                    {showCasualInfo && !poll.allowSquads && (
                        <p className="text-[11px] text-foreground/40 text-center px-4 pb-1 animate-in fade-in duration-200">
                            Players who vote &quot;{poll.options?.find(o => o.vote === "IN")?.name || tk("votedIn")}&quot; will be placed in randomly assigned teams based on tier balance.{GAME.features.hasTeamSizes && ` Vote "${poll.options?.find(o => o.vote === "SOLO")?.name || tk("votedSolo")}" to play solo.`}
                        </p>
                    )}
                    {showScheduleInfo && poll.days && (() => {
                        const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                        // Check if it's a single full day name (auto-append next day)
                        const singleIdx = FULL_DAYS.findIndex(d => d.toLowerCase() === poll.days?.toLowerCase());
                        const displayDays = singleIdx >= 0
                            ? `${FULL_DAYS[singleIdx]} & ${FULL_DAYS[(singleIdx + 1) % 7]}`
                            : poll.days;
                        return (
                            <div className="text-[11px] text-foreground/40 text-center px-4 pb-1 animate-in fade-in duration-200 space-y-0.5">
                                <p>📅 Match days: <span className="text-foreground/60 font-medium">{displayDays}</span></p>
                                <p>⏰ Start time: <span className="text-foreground/60 font-medium">8:00 PM IST</span></p>
                            </div>
                        );
                    })()}
                    </div>
                </div>

                {/* ─── Voters Dialog ─── */}
                <VotersDialog
                    isOpen={showVoters}
                    onClose={() => { setShowVoters(false); setSelectedVoteGroup(null); }}
                    poll={poll}
                    votersByVote={votersByVote}
                    selectedGroup={selectedVoteGroup}
                    onSelectGroup={setSelectedVoteGroup}
                    teamType={effectiveTeamType}
                    theme={theme}
                />

                {/* Squad Center Modal */}
                {poll.allowSquads && (
                    <>
                        <SquadCenter
                            isOpen={showSquads}
                            onClose={() => setShowSquads(false)}
                            pollId={poll.id}
                            tournamentName={tournament?.name || poll.question}
                            entryFee={entryFee}
                            currentPlayerId={currentPlayerId ?? ""}
                            theme={theme}
                            hasVotedIn={poll.userVote === "IN" || poll.userVote === "SOLO"}
                        />
                        <CreateSquadModal
                            isOpen={showCreateSquad}
                            onClose={() => setShowCreateSquad(false)}
                            pollId={poll.id}
                            tournamentName={tournament?.name || poll.question}
                            entryFee={entryFee}
                        />
                    </>
                )}

                {/* Donate Modal */}
                {tournament && (
                    <DonateModal
                        isOpen={showDonate}
                        onClose={() => setShowDonate(false)}
                        tournamentId={tournament.id}
                        tournamentName={tournament.name || poll.question}
                        playerName={poll.playersVotes.find(v => v.playerId === currentPlayerId)?.displayName}
                        pollId={poll.id}
                        allowSquads={poll.allowSquads}
                        isCouponVerifier={isCouponVerifier}
                        hasCoupon={!!poll.sponsorCoupon}
                    />
                )}

                {/* Donors List Modal */}
                <DonorsModal
                    isOpen={showDonors}
                    onClose={() => setShowDonors(false)}
                    donations={poll.donations.donations}
                    total={donationTotal}
                    tournamentName={tournament?.name || poll.question}
                    sponsorCoupon={poll.sponsorCoupon}
                />

                {/* Squad Vote Warning Modal */}
                <Modal
                    isOpen={!!squadVoteWarning}
                    onClose={() => setSquadVoteWarning(null)}
                    size="sm"
                    placement="center"
                >
                    <ModalContent>
                        <ModalHeader className="flex items-center gap-2 pb-2">
                            <Shield className="h-5 w-5 text-warning" />
                            {squadVoteWarning?.isCaptain ? "You're the Squad Leader" : "Leave Squad?"}
                        </ModalHeader>
                        <ModalBody className="pb-2">
                            {squadVoteWarning?.isCaptain ? (
                                <p className="text-sm text-foreground/70">
                                    You&apos;re the leader of <strong>&ldquo;{squadVoteWarning.squadName}&rdquo;</strong>.
                                    Cancel your squad from the Squad Center first to vote individually.
                                </p>
                            ) : (
                                <p className="text-sm text-foreground/70">
                                    Voting individually will remove you from <strong>&ldquo;{squadVoteWarning?.squadName}&rdquo;</strong>.
                                    Are you sure you want to leave?
                                </p>
                            )}
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="flat" size="sm" onPress={() => setSquadVoteWarning(null)}>
                                Cancel
                            </Button>
                            {squadVoteWarning?.isCaptain ? (
                                <Button
                                    color="primary"
                                    size="sm"
                                    onPress={() => {
                                        setSquadVoteWarning(null);
                                        setShowSquads(true);
                                    }}
                                >
                                    Open Squad Center
                                </Button>
                            ) : (
                                <Button
                                    color="warning"
                                    size="sm"
                                    className="text-white"
                                    onPress={() => {
                                        if (squadVoteWarning) onVote(poll.id, squadVoteWarning.vote);
                                        setSquadVoteWarning(null);
                                    }}
                                >
                                    Leave & Vote
                                </Button>
                            )}
                        </ModalFooter>
                    </ModalContent>
                </Modal>
            </div>
        </motion.div>
    );
}
