"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Chip,
    Spinner,
    Input,
} from "@heroui/react";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { Shield, Plus, Users, Crown, Check, Clock, X, Trash2, UserPlus, LogIn, ChevronDown, ChevronRight, Search, MoreVertical, Swords, Share2, CheckCheck, Copy, AlertTriangle, Phone, Ghost, Zap, RefreshCw, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
    useSquads,
    useCancelSquad,
    useRespondToInvite,
    useRequestJoin,
    useRespondToRequest,
    useRemoveMember,
    useLeaveSquad,
    useInvitePlayer,
    useSearchPlayers,
    useRenameSquad,
    usePreviousRoster,
    useCreateSquad,
    useImportRoster,
    type SquadDTO,
} from "@/hooks/use-squads";
import { CreateSquadModal } from "./create-squad-modal";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import type { PollTheme } from "./pollTheme";

/* ─── Share Button with Auto-Tooltip ──────────────────────── */

function ShareButtonWithTooltip({ squad }: { squad: SquadDTO }) {
    const [showTip, setShowTip] = useState(false);

    useEffect(() => {
        const showTimer = setTimeout(() => setShowTip(true), 2000);
        const hideTimer = setTimeout(() => setShowTip(false), 7000);
        return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
    }, []);

    return (
        <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setShowTip(false);
                    const url = `${window.location.origin}/invite/${squad.id}`;
                    const text = `Join my team "${squad.name}"!\n${url}`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                }}
                className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center hover:bg-emerald-500/25 transition-colors"
            >
                <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
            </button>
            <AnimatePresence>
                {showTip && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute right-0 bottom-full mb-1.5 z-50 whitespace-nowrap px-2.5 py-1.5 rounded-lg bg-foreground text-background text-[11px] font-medium shadow-lg"
                    >
                        Share to teammates on WhatsApp
                        <div className="absolute -bottom-1 right-3 w-2 h-2 bg-foreground rotate-45" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ─── Types ─────────────────────────────────────────────────── */

interface InVoter {
    playerId: string;
    displayName: string;
    imageUrl: string;
    createdAt: string;
}

interface RandomTeam {
    id: string;
    name: string;
    members: InVoter[];
    formedAt: string; // createdAt of the last (squadSize-th) voter
}

interface SquadCenterProps {
    isOpen: boolean;
    onClose: () => void;
    pollId: string;
    tournamentName: string;
    entryFee: number;
    currentPlayerId: string;
    theme?: PollTheme | null;
    hasVotedIn?: boolean;
    inVoters?: InVoter[];
    whatsappGroupLink?: string | null;
    scheduledDate?: string | null;
    initialSquadCount?: number;
}

/* ─── Status Badge ──────────────────────────────────────────── */

function StatusBadge({ status, initiatedBy }: { status: string; initiatedBy?: string }) {
    if (status === "PENDING" && initiatedBy === "PLAYER") {
        return (
            <Chip size="sm" variant="flat" className="bg-blue-500/15 text-blue-600 dark:text-blue-400" startContent={<LogIn className="w-3 h-3" />}>
                Requested
            </Chip>
        );
    }
    switch (status) {
        case "ACCEPTED":
            return (
                <Chip size="sm" variant="flat" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" startContent={<Check className="w-3 h-3" />}>
                    Joined
                </Chip>
            );
        case "PENDING":
            return (
                <Chip size="sm" variant="flat" className="bg-amber-500/15 text-amber-600 dark:text-amber-400" startContent={<Clock className="w-3 h-3" />}>
                    Pending
                </Chip>
            );
        case "DECLINED":
            return (
                <Chip size="sm" variant="flat" className="bg-red-500/15 text-red-600 dark:text-red-400" startContent={<X className="w-3 h-3" />}>
                    Declined
                </Chip>
            );
        default:
            return null;
    }
}

/* ─── Member Actions (three-dot dropdown) ───────────────────── */

import type { SquadMember } from "@/hooks/use-squads";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function MemberActions({
    member,
    onRemove,
    isRemoving,
}: {
    member: SquadMember;
    onRemove: () => void;
    isRemoving: boolean;
}) {
    const queryClient = useQueryClient();
    const toggleSub = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/squads/toggle-sub", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inviteId: member.inviteId }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.message || "Failed to toggle sub");
            }
            return res.json();
        },
        onSuccess: (data) => {
            toast.success(data.message || "Updated");
            queryClient.invalidateQueries({ queryKey: ["squads"] });
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed");
        },
    });

    return (
        <Dropdown placement="bottom-end">
            <DropdownTrigger>
                <Button
                    size="sm"
                    variant="light"
                    isIconOnly
                    isLoading={isRemoving || toggleSub.isPending}
                    className="min-w-6 w-6 h-6"
                >
                    <MoreVertical className="w-3.5 h-3.5" />
                </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Member actions">
                <DropdownItem
                    key="remove"
                    className="text-danger"
                    color="danger"
                    startContent={<Trash2 className="w-3.5 h-3.5" />}
                    onPress={onRemove}
                >
                    Remove
                </DropdownItem>
            </DropdownMenu>
        </Dropdown>
    );
}


function SquadCard({
    squad,
    currentPlayerId,
    pollIsActive,
    pollId,
    onCancel,
    onAccept,
    onDecline,
    onRequestJoin,
    onAcceptRequest,
    onDeclineRequest,
    onRemoveMember,
    onLeave,
    isCancelling,
    isResponding,
    respondingAction,
    isRequesting,
    isRespondingRequest,
    respondingRequestAction,
    isRemoving,
    isLeaving,
    defaultExpanded,
    recentlyRequestedSquadId,
    isRanked,
}: {
    squad: SquadDTO;
    currentPlayerId: string;
    pollIsActive: boolean;
    pollId: string;
    onCancel: (id: string) => void;
    onAccept: (inviteId: string) => void;
    onDecline: (inviteId: string) => void;
    onRequestJoin: (squadId: string) => void;
    onAcceptRequest: (inviteId: string) => void;
    onDeclineRequest: (inviteId: string) => void;
    onRemoveMember: (inviteId: string) => void;
    onLeave: (squadId: string) => void;
    isCancelling: boolean;
    isResponding: boolean;
    respondingAction: "accept" | "decline" | null;
    isRequesting: boolean;
    isRespondingRequest: boolean;
    respondingRequestAction: "accept" | "decline" | null;
    isRemoving: boolean;
    isLeaving: boolean;
    defaultExpanded?: boolean;
    recentlyRequestedSquadId?: string | null;
    isRanked?: boolean;
}) {
    const myInvite = squad.myInvite;
    const hasPendingInvite = myInvite?.status === "PENDING" && myInvite?.initiatedBy === "CAPTAIN";
    const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? hasPendingInvite ?? false);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteSearch, setInviteSearch] = useState("");
    // Ghost member add state
    const [showGhostAdd, setShowGhostAdd] = useState(false);
    const [ghostAdding, setGhostAdding] = useState<number | null>(null); // which slot index is adding
    const [ghostConfirm, setGhostConfirm] = useState<{ id: string; displayName: string; imageUrl?: string; phone?: string; email?: string; slotIndex: number } | null>(null);
    const [ghostConfirming, setGhostConfirming] = useState(false);
    // Per-slot state for roster form
    const [slotNames, setSlotNames] = useState<Record<number, string>>({});
    const [slotContacts, setSlotContacts] = useState<Record<number, { phone: string; email: string; expanded: boolean }>>({});
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    // Discord state (disabled — using WhatsApp now, kept for future use)
    // const [discordSkipped, setDiscordSkipped] = useState(() => {
    //     if (typeof window !== "undefined") return sessionStorage.getItem("discord_member_skipped") === "true";
    //     return false;
    // });
    // const [discordLinked, setDiscordLinked] = useState(() => {
    //     if (typeof window !== "undefined") return sessionStorage.getItem("discord_linked") === "true";
    //     return false;
    // });
    const cardRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const proxyInputRef = useRef<HTMLInputElement>(null);
    const isCaptain = squad.isCaptain || (squad.captain.id ? squad.captain.id === currentPlayerId : false);

    const isCreating = squad.id.startsWith("temp-");

    // Rename state
    const [showRename, setShowRename] = useState(false);
    const [renameTag, setRenameTag] = useState(squad.name);
    const [renameFullName, setRenameFullName] = useState(squad.fullName || "");
    const renameMutation = useRenameSquad();



    // Invite hooks (only active when captain opens invite)
    const {
        data: searchData,
        isLoading: isSearching,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useSearchPlayers(showInvite ? inviteSearch : "", pollId);
    const searchResults = searchData?.pages.flatMap((p) => p.data) ?? [];
    const inviteMutation = useInvitePlayer();
    const ghostQueryClient = useQueryClient();
    const [invitingPlayerId, setInvitingPlayerId] = useState<string | null>(null);
    const emptySlots = squad.totalSlots - squad.members.length;

    // Auto-accept clan members (for invite modal + quick-add modal)
    const { data: autoAcceptMembers = [], refetch: refetchAutoAccept } = useQuery<{ id: string; displayName: string; imageUrl: string; alreadyInSquad: boolean; existingTeamName: string | null }[]>({
        queryKey: ["auto-accept-members", squad.id],
        queryFn: async () => {
            const res = await fetch(`/api/squads/auto-accept-members?squadId=${squad.id}`);
            if (!res.ok) return [];
            const json = await res.json();
            return json.data ?? [];
        },
        enabled: (showInvite || showQuickAdd) && isCaptain && !!squad.clanTag,
        staleTime: 15_000,
    });

    // Can player request to join?
    const isGuest = !currentPlayerId;
    const isInThisSquad = isCaptain || myInvite?.status === "ACCEPTED" || myInvite?.status === "PENDING";
    const isSquadActive = squad.status === "FORMING" || squad.status === "FULL";
    const canRequestJoin = !isInThisSquad && !squad.isFull && isSquadActive && pollIsActive;

    // Pending join requests (player-initiated, for captain view)
    const pendingRequests = squad.members.filter(
        (m) => m.status === "PENDING" && m.initiatedBy === "PLAYER"
    );

    return (
        <>
        <motion.div
            ref={cardRef}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl ${
                squad.isDefendingChampion
                    ? 'relative'
                    : 'border border-divider bg-default-50 dark:bg-default-100/50'
            }`}
        >
            {/* Animated gradient border for defending champion */}
            {squad.isDefendingChampion && (
                <>
                    <div
                        className="absolute inset-0 rounded-xl champion-border-glow"
                        style={{
                            background: 'linear-gradient(var(--champion-angle, 0deg), #f59e0b, #eab308, #f97316, #d97706, #fbbf24, #f59e0b)',
                            padding: '2px',
                        }}
                    />
                    <div className="absolute inset-0 rounded-xl champion-border-glow" style={{
                        background: 'linear-gradient(var(--champion-angle, 0deg), rgba(245,158,11,0.35), rgba(249,115,22,0.2), rgba(234,179,8,0.35), rgba(245,158,11,0.2))',
                        filter: 'blur(10px)',
                    }} />
                    <style>{`
                        @property --champion-angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
                        @keyframes champion-spin { to { --champion-angle: 360deg; } }
                        .champion-border-glow { animation: champion-spin 4s linear 1 forwards; }
                        @keyframes champion-bg-shift {
                            0% { background-position: 0% 50%; }
                            50% { background-position: 100% 50%; }
                            100% { background-position: 0% 50%; }
                        }
                        .champion-inner-bg {
                            background: linear-gradient(270deg, #fffbeb, #fef3c7, #fde68a, #fef3c7, #fffbeb);
                            background-size: 300% 100%;
                            animation: champion-bg-shift 6s ease-in-out 1 forwards;
                        }
                        .dark .champion-inner-bg {
                            background: linear-gradient(270deg, #1c1917, #292524, #44403c, #292524, #1c1917);
                            background-size: 300% 100%;
                            animation: champion-bg-shift 6s ease-in-out 1 forwards;
                        }
                    `}
                    </style>
                </>
            )}
            <div className={`relative rounded-xl ${
                squad.isDefendingChampion
                    ? 'champion-inner-bg m-[2px]'
                    : ''
            }`}>
            {/* Champion badge */}
            {squad.isDefendingChampion && (
                <div className="flex items-center justify-center gap-1.5 py-1.5 border-b border-amber-500/30" style={{ background: 'linear-gradient(90deg, rgba(245,158,11,0.08), rgba(234,179,8,0.15), rgba(245,158,11,0.08))' }}>
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">🏆 Champion</span>
                </div>
            )}
            {/* Header — always visible, tap to expand */}
            <button
                type="button"
                onClick={() => {
                    const next = !isExpanded;
                    setIsExpanded(next);
                    if (next) {
                        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 350);
                    }
                }}
                className={`w-full flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                    squad.isDefendingChampion ? 'hover:bg-amber-500/10' : 'hover:bg-default-100/50'
                }`}
            >
                <div className="flex items-center gap-2 min-w-0">
                    {squad.clanLogo ? (
                        <img src={squad.clanLogo} alt={squad.clanTag || ""} className="w-5 h-5 rounded-full object-cover shrink-0" />
                    ) : (
                        <Shield className={`w-4 h-4 shrink-0 ${squad.isDefendingChampion ? 'text-amber-700 dark:text-amber-400' : 'text-primary'}`} />
                    )}
                    <h4 className={`font-semibold text-sm truncate ${squad.isDefendingChampion ? 'text-amber-900 dark:text-amber-100' : ''}`}>{squad.fullName || squad.name}</h4>
                    {isCaptain && (
                        <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {hasPendingInvite && (
                        <span className="h-2.5 w-2.5 rounded-full bg-danger animate-pulse" />
                    )}
                    {pendingRequests.length > 0 && isCaptain && (
                        <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-bold text-blue-500">
                            {pendingRequests.length} req
                        </span>
                    )}
                    {squad.isFull ? (
                        <Chip size="sm" variant="flat" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            {squad.acceptedCount}/{squad.totalSlots}
                        </Chip>
                    ) : (
                        <Chip size="sm" variant="flat" className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            {squad.acceptedCount}/{squad.totalSlots}
                        </Chip>
                    )}
                    {isCaptain && !squad.isFull && ['FORMING', 'FULL'].includes(squad.status) && pollIsActive && !isCreating && (
                        <ShareButtonWithTooltip squad={squad} />
                    )}
                    <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <ChevronDown className="w-4 h-4 text-foreground/40" />
                    </motion.div>
                </div>
            </button>

            {/* Expandable content */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        {/* Captain-only payment banner with refresh */}
                        {squad.needsPayment && isCaptain && (
                            <PaymentBanner pollId={pollId} entryFee={squad.entryFee} />
                        )}

                        {/* Members */}
                        <div className="px-4 py-3 space-y-2 border-t border-divider/50">
                            {squad.members.map((member) => {
                                const isMemberCaptain = member.playerId === squad.captain.id;
                                const showRemove = isCaptain && !isMemberCaptain && pollIsActive &&
                                    (member.status === "ACCEPTED" || (member.status === "PENDING" && member.initiatedBy === "CAPTAIN"));
                                const canToggleSub = squad.acceptedCount > GAME.squadSize;
                                return (
                                    <div key={member.inviteId} className="flex items-center gap-3">
                                        <PlayerAvatar
                                            src={member.imageUrl}
                                            playerId={member.playerId}
                                            playerName={member.displayName}
                                            size="sm"
                                            className="w-8 h-8 shrink-0"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className={`flex items-center gap-1.5 min-w-0 ${isMemberCaptain ? 'flex-wrap' : ''}`}>
                                                <span className={`text-sm font-medium ${isMemberCaptain ? 'break-all' : 'truncate'}`}>{member.displayName}</span>
                                                {member.hasRoyalPass && (
                                                    <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                )}
                                                {isMemberCaptain && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0 whitespace-nowrap">Leader</span>
                                                )}

                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {isCaptain && <StatusBadge status={member.status} initiatedBy={member.initiatedBy} />}
                                            {/* Show "Waiting" to the requesting player themselves */}
                                            {!isCaptain && member.playerId === currentPlayerId && member.status === "PENDING" && member.initiatedBy === "PLAYER" && (
                                                <Chip size="sm" variant="flat" className="bg-amber-500/15 text-amber-600 dark:text-amber-400" startContent={<Clock className="w-3 h-3" />}>
                                                    Waiting
                                                </Chip>
                                            )}
                                            {showRemove && (
                                                canToggleSub ? (
                                                    <MemberActions
                                                        member={member}
                                                        onRemove={() => onRemoveMember(member.inviteId)}
                                                        isRemoving={isRemoving}
                                                    />
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="light"
                                                        color="danger"
                                                        isIconOnly
                                                        isLoading={isRemoving}
                                                        onPress={() => onRemoveMember(member.inviteId)}
                                                        className="min-w-6 w-6 h-6"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </Button>
                                                )
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Empty slots */}
                            {emptySlots > 0 && Array.from({ length: emptySlots }).map((_, i) => {
                                const wasJustRequested = squad.id === recentlyRequestedSquadId;
                                const isJoinSlot = i === 0 && canRequestJoin && !wasJustRequested;
                                const isRequestedSlot = i === 0 && wasJustRequested;
                                return isRequestedSlot ? (
                                    <div key={`empty-${i}`} className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full border-2 border-dashed border-amber-500/50 flex items-center justify-center">
                                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                                        </div>
                                        <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                                            Requested ✓
                                        </span>
                                    </div>
                                ) : isJoinSlot ? (
                                    <button
                                        key={`empty-${i}`}
                                        className="flex items-center gap-3 w-full text-left rounded-lg py-1.5 -mx-1 px-1 transition-colors hover:bg-primary/10 active:bg-primary/20"
                                        onClick={() => isGuest ? (window.location.href = "/sign-in") : onRequestJoin(squad.id)}
                                        disabled={isRequesting}
                                    >
                                        <div className="w-8 h-8 rounded-full border-2 border-dashed border-primary/50 flex items-center justify-center">
                                            <UserPlus className="w-3.5 h-3.5 text-primary" />
                                        </div>
                                        <span className="text-sm font-medium text-primary">
                                            {isRequesting ? "Requesting…" : "Tap to join"}
                                        </span>
                                    </button>
                                ) : isCaptain && pollIsActive && !isCreating ? (
                                    <button
                                        key={`empty-${i}`}
                                        className="flex items-center gap-3 w-full text-left rounded-lg py-1.5 -mx-1 px-1 transition-colors hover:bg-purple-500/10 active:bg-purple-500/20"
                                        onClick={() => setShowGhostAdd(true)}
                                    >
                                        <div className="w-8 h-8 rounded-full border-2 border-dashed border-purple-400/50 bg-purple-500/10 flex items-center justify-center">
                                            <Ghost className="w-3.5 h-3.5 text-purple-400" />
                                        </div>
                                        <span className="text-sm font-medium text-purple-500 dark:text-purple-400">Add player</span>
                                    </button>
                                ) : (
                                    <div key={`empty-${i}`} className="flex items-center gap-3 opacity-40">
                                        <div className="w-8 h-8 rounded-full border-2 border-dashed border-foreground/20 flex items-center justify-center">
                                            <Plus className="w-3 h-3" />
                                        </div>
                                        <span className="text-sm text-foreground/40">Open slot</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Captain: Invite Players + Quick Add + Add Ghost */}
                        {isCaptain && !squad.isFull && ['FORMING', 'FULL'].includes(squad.status) && pollIsActive && (
                            <div className="px-4 py-3 border-t border-divider/50 flex gap-2 flex-wrap">
                                <Button
                                    size="sm"
                                    variant="flat"
                                    color="primary"
                                    className="flex-1 font-medium min-w-[90px]"
                                    startContent={<UserPlus className="w-3.5 h-3.5" />}
                                    isDisabled={isCreating}
                                    onPress={() => setShowInvite(true)}
                                >
                                    Invite
                                </Button>
                                <Button
                                    size="sm"
                                    variant="flat"
                                    className="flex-1 font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 min-w-[90px]"
                                    startContent={<Zap className="w-3.5 h-3.5" />}
                                    isDisabled={isCreating}
                                    onPress={() => setShowQuickAdd(true)}
                                >
                                    Quick Add
                                </Button>
                                <Button
                                    size="sm"
                                    variant="flat"
                                    className="flex-1 font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 min-w-[90px]"
                                    startContent={<Ghost className="w-3.5 h-3.5" />}
                                    isDisabled={isCreating}
                                    onPress={() => setShowGhostAdd(true)}
                                >
                                    Add Player
                                </Button>
                            </div>
                        )}

                        {/* Captain: Pending join requests */}
                        {isCaptain && pendingRequests.length > 0 && (
                            <div className="px-4 py-3 border-t border-divider/50 bg-blue-500/5">
                                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">
                                    📩 Join Requests ({pendingRequests.length})
                                </p>
                                <div className="space-y-2">
                                    {pendingRequests.map((req) => (
                                        <div key={req.inviteId} className="flex items-center gap-3">
                                            <PlayerAvatar
                                                src={req.imageUrl}
                                                playerId={req.playerId}
                                                playerName={req.displayName}
                                                size="sm"
                                                className="w-8 h-8 shrink-0"
                                            />
                                            <span className="text-sm font-medium truncate flex-1">{req.displayName}</span>
                                            <div className="flex gap-1.5 shrink-0">
                                                <Button
                                                    size="sm"
                                                    color="primary"
                                                    variant="flat"
                                                    isLoading={isRespondingRequest && respondingRequestAction === "accept"}
                                                    isDisabled={isRespondingRequest && respondingRequestAction === "decline"}
                                                    onPress={() => onAcceptRequest(req.inviteId)}
                                                    className="min-w-0 px-2 h-7"
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    color="danger"
                                                    variant="flat"
                                                    isLoading={isRespondingRequest && respondingRequestAction === "decline"}
                                                    isDisabled={isRespondingRequest && respondingRequestAction === "accept"}
                                                    onPress={() => onDeclineRequest(req.inviteId)}
                                                    className="min-w-0 px-2 h-7"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Player: Pending captain invite */}
                        {hasPendingInvite && myInvite && (
                            <div className="px-4 py-3 border-t border-divider/50 bg-primary/5">
                                <p className="text-xs text-foreground/60 mb-2">
                                    {squad.captain.displayName} invited you • Free to join
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        color="primary"
                                        className="flex-1 font-semibold"
                                        isLoading={isResponding && respondingAction === "accept"}
                                        onPress={() => onAccept(myInvite.id)}
                                        startContent={!(isResponding && respondingAction === "accept") && <Check className="w-3.5 h-3.5" />}
                                    >
                                        Accept & Join
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="flat"
                                        color="danger"
                                        isLoading={isResponding && respondingAction === "decline"}
                                        isDisabled={isResponding && respondingAction === "accept"}
                                        onPress={() => onDecline(myInvite.id)}
                                        isIconOnly
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Player: Cancel own pending request */}
                        {myInvite?.status === "PENDING" && myInvite?.initiatedBy === "PLAYER" && (
                            <div className="px-4 py-3 border-t border-divider/50">
                                <Button
                                    size="sm"
                                    variant="flat"
                                    color="danger"
                                    className="w-full font-semibold"
                                    isLoading={isResponding}
                                    onPress={() => onDecline(myInvite.id)}
                                    startContent={!isResponding && <X className="w-3.5 h-3.5" />}
                                >
                                    Cancel Request
                                </Button>
                            </div>
                        )}

                        {/* Member: Discord join/skip prompt — DISABLED (using WhatsApp now) */}
                        {/* Discord prompt code kept as comment for future re-enablement
                        {!isCaptain && myInvite?.status === "ACCEPTED" && !discordLinked && !discordSkipped && (
                            <div className="px-4 py-3 border-t border-divider/50 space-y-2">
                                <button type="button" onClick={() => { ... }} className="...">Link Discord Account</button>
                                <button type="button" onClick={() => { setDiscordSkipped(true); sessionStorage.setItem("discord_member_skipped", "true"); }} className="...">Skip</button>
                            </div>
                        )}
                        */}

                        {/* Member: Leave squad (accepted, non-captain) */}
                        {!isCaptain && myInvite?.status === "ACCEPTED" && pollIsActive && (
                            <div className="px-4 py-3 border-t border-divider/50">
                                <Button
                                    size="sm"
                                    variant="flat"
                                    color="danger"
                                    className="w-full font-semibold"
                                    isLoading={isLeaving}
                                    onPress={() => onLeave(squad.id)}
                                    startContent={!isLeaving && <LogIn className="w-3.5 h-3.5 rotate-180" />}
                                >
                                    Leave Squad
                                </Button>
                            </div>
                        )}




                        {/* Rename + Cancel squad */}
                        {isCaptain && ['FORMING', 'FULL'].includes(squad.status) && (
                            <div className="px-4 py-2 border-t border-divider/50">
                                {isCreating ? (
                                    <Button
                                        size="sm"
                                        variant="light"
                                        className="w-full text-foreground/50"
                                        isLoading
                                        isDisabled
                                    >
                                        Creating…
                                    </Button>
                                ) : (
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="flat"
                                            className="flex-1 font-medium"
                                            onPress={() => {
                                                setRenameTag(squad.name);
                                                setRenameFullName(squad.fullName || "");
                                                setShowRename(true);
                                            }}
                                            startContent={<Pencil className="w-3.5 h-3.5" />}
                                        >
                                            Rename
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="light"
                                            color={isCancelling ? "default" : "danger"}
                                            className={`flex-1 ${isCancelling ? "text-foreground/50" : ""}`}
                                            isLoading={isCancelling}
                                            isDisabled={isCancelling}
                                            onPress={() => onCancel(squad.id)}
                                            startContent={!isCancelling && <Trash2 className="w-3.5 h-3.5" />}
                                        >
                                            {isCancelling ? "Cancelling…" : "Cancel"}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </motion.div>
                )}
            </AnimatePresence>
            </div>
        </motion.div>

            {/* ── Full-screen Invite Modal ── */}
            <Modal
                isOpen={showInvite}
                onClose={() => { setShowInvite(false); setInviteSearch(""); }}
                placement="center"
                size="full"
                scrollBehavior="inside"
                classNames={{
                    wrapper: "z-[60]",
                    body: "px-4 py-0",
                }}
            >
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2 text-base pb-2">
                        <UserPlus className="w-4 h-4 text-primary" />
                        <div className="flex-1 min-w-0">
                            <span className="truncate block">Invite Players</span>
                            <span className="text-xs font-normal text-foreground/50">{squad.fullName || squad.name}</span>
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        {/* Share link */}
                        <button
                            type="button"
                            onClick={() => {
                                const url = `${window.location.origin}/invite/${squad.id}`;
                                const text = `Join my team "${squad.name}"!\n${url}`;
                                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors mb-3 cursor-pointer"
                        >
                            <div className="w-9 h-9 rounded-full bg-[#25D366]/20 flex items-center justify-center shrink-0">
                                <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Share invite on WhatsApp</p>
                                <p className="text-[11px] text-emerald-600/60 dark:text-emerald-400/60">Send link to your teammates</p>
                            </div>
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-lg bg-emerald-500/15 shrink-0">Share</span>
                        </button>

                        {/* Search input */}
                        <Input
                            ref={(el: HTMLDivElement | null) => {
                                if (el) {
                                    setTimeout(() => {
                                        const input = el.querySelector("input");
                                        input?.focus();
                                    }, 300);
                                }
                            }}
                            placeholder="Search player name..."
                            value={inviteSearch}
                            onValueChange={setInviteSearch}
                            size="lg"
                            startContent={<Search className="w-4 h-4 text-default-400" />}
                            endContent={inviteSearch ? (
                                <button type="button" onClick={() => setInviteSearch("")} className="p-0.5">
                                    <X className="w-3.5 h-3.5 text-default-400" />
                                </button>
                            ) : undefined}
                            classNames={{ input: "text-base" }}
                        />

                        {/* Auto-accept clan members — shown above search results */}
                        {autoAcceptMembers.length > 0 && !inviteSearch && (
                            <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                                <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1.5">
                                    <CheckCheck className="w-3.5 h-3.5" />
                                    Auto-Join Enabled ({autoAcceptMembers.length})
                                </p>
                                <p className="text-[10px] text-foreground/40 mb-2">
                                    These clan members will be instantly added — no accept needed
                                </p>
                                <div className="space-y-0.5">
                                    {autoAcceptMembers
                                        .filter(p => !squad.members.some(m => m.playerId === p.id))
                                        .map((player) => (
                                        <div key={player.id} className="flex items-center gap-3 py-2 px-1">
                                            <PlayerAvatar
                                                src={player.imageUrl}
                                                playerId={player.id}
                                                playerName={player.displayName}
                                                size="sm"
                                                className="w-8 h-8 shrink-0"
                                            />
                                            <span className="text-sm font-medium truncate flex-1">{player.displayName}</span>
                                            <Button
                                                size="sm"
                                                color="primary"
                                                className="min-w-0 px-4 h-8 font-semibold"
                                                isLoading={inviteMutation.isPending && invitingPlayerId === player.id}
                                                isDisabled={inviteMutation.isPending && invitingPlayerId !== player.id}
                                                onPress={() => {
                                                    setInvitingPlayerId(player.id);
                                                    inviteMutation.mutate(
                                                        { squadId: squad.id, playerId: player.id },
                                                        { onSuccess: () => refetchAutoAccept() },
                                                    );
                                                }}
                                                startContent={!(inviteMutation.isPending && invitingPlayerId === player.id) && <Plus className="w-3.5 h-3.5" />}
                                            >
                                                Add
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Results — infinite scroll */}
                        <div className="mt-3 space-y-1">
                            {isSearching && searchResults.length === 0 && (
                                <div className="flex justify-center py-6">
                                    <Spinner size="sm" />
                                </div>
                            )}
                            {searchResults.length > 0 && (
                                <div className="space-y-0.5">
                                    {searchResults
                                        .filter(p => !squad.members.some(m => m.playerId === p.id))
                                        .map((player) => (
                                        <div key={player.id} className="flex items-center gap-3 py-2.5 px-1">
                                            <PlayerAvatar
                                                src={player.imageUrl}
                                                playerId={player.id}
                                                playerName={player.displayName}
                                                size="sm"
                                                className="w-8 h-8 shrink-0"
                                            />
                                            <span className="text-sm font-medium truncate flex-1">{player.displayName}</span>
                                            <Button
                                                size="sm"
                                                color="primary"
                                                variant="flat"
                                                className="min-w-0 px-4 h-8"
                                                isLoading={inviteMutation.isPending && invitingPlayerId === player.id}
                                                isDisabled={inviteMutation.isPending && invitingPlayerId !== player.id}
                                                onPress={() => {
                                                    setInvitingPlayerId(player.id);
                                                    inviteMutation.mutate({ squadId: squad.id, playerId: player.id });
                                                }}






                                            >
                                                Invite
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* Scroll-to-load sentinel */}
                            <div
                                ref={(el) => {
                                    if (!el) return;
                                    const observer = new IntersectionObserver(
                                        ([entry]) => {
                                            if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
                                                fetchNextPage();
                                            }
                                        },
                                        { rootMargin: "200px" }
                                    );
                                    observer.observe(el);
                                    return () => observer.disconnect();
                                }}
                                className="flex justify-center py-4 min-h-[60px]"
                            >
                                {isFetchingNextPage ? (
                                    <>
                                        {/* @ts-expect-error – dotlottie-wc is a web component */}
                                        <dotlottie-wc
                                            src="https://lottie.host/1e87a411-568e-4c3c-9636-d83afd6d26f4/WELgDwxSwC.lottie"
                                            style={{ width: "120px", height: "120px" }}
                                            autoplay
                                            loop
                                        />
                                    </>
                                ) : !hasNextPage && searchResults.length > 0 ? (
                                    <p className="text-xs text-foreground/30 py-2">
                                        End of list • {searchResults.filter(p => !squad.members.some(m => m.playerId === p.id)).length} players
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    </ModalBody>
                </ModalContent>
            </Modal>

            {/* ── Ghost Member Add Modal ── */}
            <Modal
                isOpen={showGhostAdd}
                onClose={() => {
                    setShowGhostAdd(false);
                    setSlotNames({});
                    setSlotContacts({});
                    setGhostConfirm(null);
                }}
                placement="center"
                size="full"
                scrollBehavior="inside"
                classNames={{
                    wrapper: "z-[60]",
                    body: "px-4 py-0",
                }}
            >
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2 text-base pb-2">
                        <Ghost className="w-4 h-4 text-purple-500" />
                        <div className="flex-1 min-w-0">
                            <span className="truncate block">Add Players</span>
                            <span className="text-xs font-normal text-foreground/50">{squad.fullName || squad.name}</span>
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        <p className="text-xs text-foreground/50 mb-3">
                            Fill empty slots with player names. Tap ••• to add phone/email.
                        </p>

                        {/* Roster slots */}
                        <div className="space-y-2">
                            {(() => {
                                const totalSlots = GAME.maxSquadSize - 1; // minus captain
                                const acceptedMembers = squad.members.filter(m => m.status === "ACCEPTED" && m.playerId !== squad.captain.id);
                                const slots: React.ReactNode[] = [];

                                for (let i = 0; i < totalSlots; i++) {
                                    const member = acceptedMembers[i];
                                    const slotLabel = `Player ${i + 2}`;
                                    const isAdding = ghostAdding === i;
                                    const contact = slotContacts[i] || { phone: "", email: "", expanded: false };

                                    if (member) {
                                        // ─── Filled slot (disabled) ───
                                        slots.push(
                                            <div key={`slot-${i}`} className="flex items-center gap-3 rounded-xl bg-foreground/5 px-3 py-2.5 opacity-60">
                                                <div className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground/40 shrink-0">
                                                    {i + 2}
                                                </div>
                                                <PlayerAvatar src={member.imageUrl} playerId={member.playerId} playerName={member.displayName} size="sm" className="w-8 h-8 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{member.displayName}</p>
                                                    <p className="text-[10px] text-foreground/40">Slot {i + 2}</p>
                                                </div>
                                                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                            </div>
                                        );
                                    } else {
                                        // ─── Empty slot (input) ───
                                        const emptyIndex = i;
                                        const slotRef = React.createRef<HTMLDivElement>();
                                        slots.push(
                                            <div key={`slot-${i}`} ref={slotRef} className="rounded-xl border border-dashed border-foreground/15 px-3 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-purple-500/15 flex items-center justify-center text-[10px] font-bold text-purple-500 shrink-0">
                                                        {i + 2}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder={slotLabel}
                                                        value={slotNames[emptyIndex] || ""}
                                                        onChange={(e) => setSlotNames(prev => ({ ...prev, [emptyIndex]: e.target.value }))}
                                                        maxLength={20}
                                                        className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-foreground/30"
                                                        disabled={isAdding}
                                                        onFocus={() => {
                                                            // Scroll the slot into view so it's not hidden above the keyboard
                                                            setTimeout(() => {
                                                                slotRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                                                            }, 300);
                                                        }}
                                                    />
                                                    {/* Three-dot menu for contact */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setSlotContacts(prev => ({
                                                            ...prev,
                                                            [emptyIndex]: { ...contact, expanded: !contact.expanded },
                                                        }))}
                                                        className="w-7 h-7 rounded-full hover:bg-foreground/10 flex items-center justify-center shrink-0 transition-colors"
                                                        title="Add phone/email"
                                                    >
                                                        <MoreVertical className="w-3.5 h-3.5 text-foreground/40" />
                                                    </button>
                                                    {/* Add button */}
                                                    <Button
                                                        size="sm"
                                                        color="primary"
                                                        variant="flat"
                                                        className="min-w-0 px-3 h-7 font-semibold text-xs"
                                                        isLoading={isAdding}
                                                        isDisabled={!slotNames[emptyIndex]?.trim() || ghostAdding !== null}
                                                        onPress={async () => {
                                                            setGhostAdding(emptyIndex);
                                                            const memberName = slotNames[emptyIndex]!.trim();
                                                            try {
                                                                const res = await fetch(`/api/squads/${squad.id}/add-member`, {
                                                                    method: "POST",
                                                                    headers: { "Content-Type": "application/json" },
                                                                    body: JSON.stringify({
                                                                        phone: contact.phone || undefined,
                                                                        email: contact.email || undefined,
                                                                        name: memberName,
                                                                    }),
                                                                });
                                                                const json = await res.json();
                                                                if (!res.ok) {
                                                                    const { toast } = await import("sonner");
                                                                    toast.error(json.message || "Failed to add");
                                                                    return;
                                                                }
                                                                if (json.data?.matched) {
                                                                    setGhostConfirm({ ...json.data.player, slotIndex: emptyIndex });
                                                                    return;
                                                                }
                                                                const { toast } = await import("sonner");
                                                                toast.success(json.message || "Player added!");
                                                                setSlotNames(prev => { const n = { ...prev }; delete n[emptyIndex]; return n; });
                                                                setSlotContacts(prev => { const n = { ...prev }; delete n[emptyIndex]; return n; });
                                                                // Optimistic update — add the new member to the squad immediately
                                                                const newMember = json.data?.member;
                                                                ghostQueryClient.setQueryData(["squads", pollId], (old: any) => {
                                                                    if (!old?.squads) return old;
                                                                    return {
                                                                        ...old,
                                                                        squads: old.squads.map((s: any) => {
                                                                            if (s.id !== squad.id) return s;
                                                                            const optimisticMember = newMember || {
                                                                                inviteId: `temp-${Date.now()}`,
                                                                                playerId: `ghost-${Date.now()}`,
                                                                                displayName: memberName,
                                                                                imageUrl: "",
                                                                                hasRoyalPass: false,
                                                                                hasDiscord: false,
                                                                                isGhost: true,
                                                                                status: "ACCEPTED" as const,
                                                                                initiatedBy: "CAPTAIN" as const,
                                                                                isSub: false,
                                                                            };
                                                                            const updatedMembers = [...s.members, optimisticMember];
                                                                            const acceptedCount = updatedMembers.filter((m: any) => m.status === "ACCEPTED").length;
                                                                            return {
                                                                                ...s,
                                                                                members: updatedMembers,
                                                                                acceptedCount,
                                                                                activeCount: acceptedCount,
                                                                                isFull: acceptedCount >= s.totalSlots,
                                                                                status: acceptedCount >= GAME.maxSquadSize ? "FULL" : s.status,
                                                                            };
                                                                        }),
                                                                    };
                                                                });
                                                                // Background refetch to sync with server
                                                                ghostQueryClient.invalidateQueries({ queryKey: ["squads"] });
                                                            } catch {
                                                                const { toast } = await import("sonner");
                                                                toast.error("Failed to add member");
                                                            } finally {
                                                                setGhostAdding(null);
                                                            }
                                                        }}
                                                    >
                                                        Add
                                                    </Button>
                                                </div>
                                                {/* Expandable contact fields */}
                                                {contact.expanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.15 }}
                                                        className="mt-2 pl-8 space-y-2"
                                                    >
                                                        <input
                                                            type="tel"
                                                            placeholder="Phone (optional)"
                                                            value={contact.phone}
                                                            onChange={(e) => setSlotContacts(prev => ({
                                                                ...prev,
                                                                [emptyIndex]: { ...contact, phone: e.target.value },
                                                            }))}
                                                            maxLength={10}
                                                            className="w-full text-xs bg-foreground/5 rounded-lg px-3 py-2 outline-none placeholder:text-foreground/30"
                                                        />
                                                        <input
                                                            type="email"
                                                            placeholder="Email (optional)"
                                                            value={contact.email}
                                                            onChange={(e) => setSlotContacts(prev => ({
                                                                ...prev,
                                                                [emptyIndex]: { ...contact, email: e.target.value },
                                                            }))}
                                                            className="w-full text-xs bg-foreground/5 rounded-lg px-3 py-2 outline-none placeholder:text-foreground/30"
                                                        />
                                                    </motion.div>
                                                )}
                                            </div>
                                        );
                                    }
                                }
                                return slots;
                            })()}
                        </div>

                        {/* Confirmation for real player match */}
                        {ghostConfirm && (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
                            >
                                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-3">
                                    Found an existing player!
                                </p>
                                <div className="flex items-center gap-3 mb-3">
                                    <PlayerAvatar
                                        src={ghostConfirm.imageUrl}
                                        playerId={ghostConfirm.id}
                                        playerName={ghostConfirm.displayName}
                                        size="md"
                                        className="shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate">{ghostConfirm.displayName}</p>
                                        {ghostConfirm.phone && (
                                            <p className="text-xs text-foreground/50">📱 {ghostConfirm.phone}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        color="primary"
                                        className="flex-1 font-semibold"
                                        isLoading={ghostConfirming}
                                        onPress={async () => {
                                            setGhostConfirming(true);
                                            try {
                                                const res = await fetch(`/api/squads/${squad.id}/add-member/confirm`, {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ playerId: ghostConfirm.id }),
                                                });
                                                const json = await res.json();
                                                if (!res.ok) {
                                                    const { toast } = await import("sonner");
                                                    toast.error(json.message || "Failed");
                                                    return;
                                                }
                                                const { toast } = await import("sonner");
                                                toast.success(json.message || "Added!");
                                                setGhostConfirm(null);
                                                const idx = ghostConfirm.slotIndex;
                                                setSlotNames(prev => { const n = { ...prev }; delete n[idx]; return n; });
                                                setSlotContacts(prev => { const n = { ...prev }; delete n[idx]; return n; });
                                                // Optimistic update — add the confirmed player to the squad immediately
                                                const newMember = json.data?.member;
                                                ghostQueryClient.setQueryData(["squads", pollId], (old: any) => {
                                                    if (!old?.squads) return old;
                                                    return {
                                                        ...old,
                                                        squads: old.squads.map((s: any) => {
                                                            if (s.id !== squad.id) return s;
                                                            const optimisticMember = newMember || {
                                                                inviteId: `temp-${Date.now()}`,
                                                                playerId: ghostConfirm.id,
                                                                displayName: ghostConfirm.displayName,
                                                                imageUrl: ghostConfirm.imageUrl || "",
                                                                hasRoyalPass: false,
                                                                hasDiscord: false,
                                                                isGhost: false,
                                                                status: "ACCEPTED" as const,
                                                                initiatedBy: "CAPTAIN" as const,
                                                                isSub: false,
                                                            };
                                                            const updatedMembers = [...s.members, optimisticMember];
                                                            const acceptedCount = updatedMembers.filter((m: any) => m.status === "ACCEPTED").length;
                                                            return {
                                                                ...s,
                                                                members: updatedMembers,
                                                                acceptedCount,
                                                                activeCount: acceptedCount,
                                                                isFull: acceptedCount >= s.totalSlots,
                                                                status: acceptedCount >= GAME.maxSquadSize ? "FULL" : s.status,
                                                            };
                                                        }),
                                                    };
                                                });
                                                // Background refetch to sync
                                                ghostQueryClient.invalidateQueries({ queryKey: ["squads"] });
                                            } catch {
                                                const { toast } = await import("sonner");
                                                toast.error("Failed");
                                            } finally {
                                                setGhostConfirming(false);
                                            }
                                        }}
                                    >
                                        Yes, add them
                                    </Button>
                                    <Button
                                        variant="flat"
                                        className="font-medium"
                                        onPress={() => setGhostConfirm(null)}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {/* Previous players quick-add */}
                        <PreviousGhostsSection squadId={squad.id} showGhostAdd={showGhostAdd} />
                    </ModalBody>
                </ModalContent>
            </Modal>

            {/* ── Quick Add Subscribers Modal ── */}
            <Modal
                isOpen={showQuickAdd}
                onClose={() => setShowQuickAdd(false)}
                placement="center"
                size="full"
                scrollBehavior="inside"
                classNames={{
                    wrapper: "z-[60]",
                    body: "px-4 py-0",
                }}
            >
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2 text-base pb-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <div className="flex-1 min-w-0">
                            <span className="truncate block">Quick Add</span>
                            <span className="text-xs font-normal text-foreground/50">{squad.fullName || squad.name}</span>
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        <p className="text-xs text-foreground/50 mb-3">
                            Clan members & subscribers — add them instantly with one tap.
                        </p>

                        <QuickAddSubscribersList
                            squadId={squad.id}
                            pollId={pollId}
                            showQuickAdd={showQuickAdd}
                            inviteMutation={inviteMutation}
                            invitingPlayerId={invitingPlayerId}
                            setInvitingPlayerId={setInvitingPlayerId}
                        />
                    </ModalBody>
                </ModalContent>
            </Modal>

            {/* ── Rename Squad Modal ── */}
            <Modal
                isOpen={showRename}
                onClose={() => setShowRename(false)}
                placement="center"
                size="sm"
                classNames={{ wrapper: "z-[70]" }}
            >
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2 text-base">
                        <Pencil className="w-4 h-4 text-primary" />
                        Rename Team
                    </ModalHeader>
                    <ModalBody className="pt-0 space-y-3">
                        <Input
                            label="Team Tag"
                            placeholder="e.g. ALPHA"
                            value={renameTag}
                            onValueChange={(v) => setRenameTag(v.slice(0, 7))}
                            maxLength={7}
                            size="sm"
                            isRequired
                            autoFocus
                            description={`${renameTag.length}/7 • shown in standings`}
                        />
                        {renameFullName ? (
                            <Input
                                label="Full Name (optional)"
                                placeholder="e.g. Alpha Warriors"
                                value={renameFullName}
                                onValueChange={(v) => setRenameFullName(v.slice(0, 30))}
                                maxLength={30}
                                size="sm"
                                description="Shown in slot views"
                                endContent={
                                    <button
                                        type="button"
                                        className="p-0.5 rounded hover:bg-foreground/10 transition-colors cursor-pointer"
                                        onClick={() => setRenameFullName("")}
                                    >
                                        <X className="w-3.5 h-3.5 text-foreground/40" />
                                    </button>
                                }
                            />
                        ) : (
                            <button
                                type="button"
                                className="text-xs text-primary font-medium hover:underline cursor-pointer text-left"
                                onClick={() => setRenameFullName(" ")}
                            >
                                + Add full team name (optional)
                            </button>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button size="sm" variant="flat" onPress={() => setShowRename(false)}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            color="primary"
                            isDisabled={!renameTag.trim()}
                            isLoading={renameMutation.isPending}
                            onPress={() => {
                                renameMutation.mutate(
                                    { squadId: squad.id, name: renameTag.trim(), fullName: renameFullName.trim() || undefined },
                                    { onSuccess: () => setShowRename(false) }
                                );
                            }}
                        >
                            Save
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

        </>
    );
}

/* ─── Quick Add Subscribers List ───────────────────────────── */

interface Subscriber {
    id: string;
    displayName: string;
    imageUrl: string;
    isClanMember: boolean;
    alreadyInSquad: boolean;
    existingTeamName: string | null;
}

function QuickAddSubscribersList({
    squadId,
    pollId,
    showQuickAdd,
    inviteMutation,
    invitingPlayerId,
    setInvitingPlayerId,
}: {
    squadId: string;
    pollId: string;
    showQuickAdd: boolean;
    inviteMutation: ReturnType<typeof useInvitePlayer>;
    invitingPlayerId: string | null;
    setInvitingPlayerId: (id: string | null) => void;
}) {
    const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
    const queryClient = useQueryClient();

    const { data: subscribers = [], isLoading } = useQuery<Subscriber[]>({
        queryKey: ["recent-teammates-full", pollId],
        queryFn: async () => {
            const res = await fetch(`/api/squads/recent-teammates?pollId=${pollId}`);
            if (!res.ok) return [];
            const json = await res.json();
            return json.data ?? [];
        },
        enabled: showQuickAdd,
        staleTime: 15_000,
    });

    if (isLoading) {
        return (
            <div className="flex justify-center py-8">
                <Spinner size="sm" />
            </div>
        );
    }

    if (subscribers.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 rounded-xl bg-default-100 py-8 text-center">
                <Zap className="w-8 h-8 text-foreground/20" />
                <p className="text-sm text-foreground/50">No subscribers yet</p>
                <p className="text-xs text-foreground/30">Players can subscribe to you from your profile</p>
            </div>
        );
    }

    return (
        <div className="space-y-0.5">
            {subscribers.map((player) => {
                const isAdded = addedIds.has(player.id) || player.alreadyInSquad;
                const isOnOtherTeam = !!player.existingTeamName;
                const canAdd = !isAdded && !isOnOtherTeam;

                return (
                    <div
                        key={player.id}
                        className={`flex items-center gap-3 py-2.5 px-1 rounded-lg ${isOnOtherTeam ? "opacity-50" : ""}`}
                    >
                        <PlayerAvatar
                            src={player.imageUrl}
                            playerId={player.id}
                            playerName={player.displayName}
                            size="sm"
                            className="w-8 h-8 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium truncate">{player.displayName}</span>
                                {player.isClanMember && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary leading-none shrink-0">
                                        Clan
                                    </span>
                                )}
                            </div>
                            {isOnOtherTeam && (
                                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                                    Already in {player.existingTeamName}
                                </p>
                            )}
                        </div>
                        {isAdded ? (
                            <span className="text-xs font-semibold text-success px-3">Added ✓</span>
                        ) : isOnOtherTeam ? (
                            <span className="text-[10px] text-foreground/30 px-2">Unavailable</span>
                        ) : (
                            <Button
                                size="sm"
                                color="primary"
                                className="min-w-0 px-4 h-8 font-semibold"
                                isLoading={inviteMutation.isPending && invitingPlayerId === player.id}
                                isDisabled={inviteMutation.isPending && invitingPlayerId !== player.id}
                                onPress={() => {
                                    setInvitingPlayerId(player.id);
                                    inviteMutation.mutate(
                                        { squadId, playerId: player.id },
                                        {
                                            onSuccess: () => {
                                                setAddedIds((prev) => new Set(prev).add(player.id));
                                                queryClient.invalidateQueries({ queryKey: ["squads"] });
                                            },
                                        },
                                    );
                                }}
                                startContent={!(inviteMutation.isPending && invitingPlayerId === player.id) && <Plus className="w-3.5 h-3.5" />}
                            >
                                Add
                            </Button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* ─── Previous Ghosts Quick-Add Section ────────────────────── */

function PreviousGhostsSection({ squadId, showGhostAdd }: { squadId: string; showGhostAdd: boolean }) {
    const [addingId, setAddingId] = useState<string | null>(null);
    const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
    const queryClient = useQueryClient();

    const { data: previousGhosts = [] } = useQuery<{ id: string; displayName: string; phone: string | null }[]>({
        queryKey: ["previous-ghosts", squadId],
        queryFn: async () => {
            const res = await fetch(`/api/squads/${squadId}/previous-ghosts`);
            if (!res.ok) return [];
            const json = await res.json();
            return json.data ?? [];
        },
        enabled: showGhostAdd,
        staleTime: 15_000,
    });

    if (previousGhosts.length === 0) return null;

    return (
        <div className="mt-4 rounded-xl border border-purple-500/20 bg-purple-500/5 p-3">
            <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-1.5">
                <Ghost className="w-3.5 h-3.5" />
                Previous Players — tap to re-add
            </p>
            <div className="space-y-1">
                {previousGhosts.map((ghost) => {
                    const isAdded = addedIds.has(ghost.id);
                    const isAdding = addingId === ghost.id;
                    return (
                        <div key={ghost.id} className="flex items-center gap-3 py-2 px-1">
                            <div className="w-8 h-8 rounded-full border-2 border-dashed border-purple-400/50 bg-purple-500/10 flex items-center justify-center shrink-0">
                                <Ghost className="w-4 h-4 text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{ghost.displayName}</p>
                                {ghost.phone && (
                                    <p className="text-[10px] text-foreground/40">{ghost.phone}</p>
                                )}
                            </div>
                            <Button
                                size="sm"
                                color={isAdded ? "success" : "secondary"}
                                variant={isAdded ? "light" : "flat"}
                                className="min-w-0 px-3 h-7"
                                isLoading={isAdding}
                                isDisabled={isAdded}
                                onPress={async () => {
                                    setAddingId(ghost.id);
                                    try {
                                        const res = await fetch(`/api/squads/${squadId}/add-member/confirm`, {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ playerId: ghost.id }),
                                        });
                                        const json = await res.json();
                                        if (!res.ok) {
                                            const { toast } = await import("sonner");
                                            toast.error(json.message || "Failed");
                                            return;
                                        }
                                        const { toast } = await import("sonner");
                                        toast.success(json.message || "Added!");
                                        setAddedIds((prev) => new Set(prev).add(ghost.id));
                                        queryClient.invalidateQueries({ queryKey: ["squads"] });
                                    } catch {
                                        const { toast } = await import("sonner");
                                        toast.error("Failed to add");
                                    } finally {
                                        setAddingId(null);
                                    }
                                }}
                            >
                                {isAdded ? "Added ✓" : "+ Add"}
                            </Button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ─── Random Team Card (collapsible, amber accent) ──────────── */

function RandomTeamCard({ team, defaultExpanded = false }: { team: RandomTeam; defaultExpanded?: boolean }) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-amber-500/25 bg-amber-500/5 dark:bg-amber-500/10 overflow-hidden"
        >
            {/* Header — tap to expand */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-amber-500/10 transition-colors"
            >
                <div className="flex items-center gap-2 min-w-0">
                    <Swords className="w-4 h-4 text-amber-500 shrink-0" />
                    <h4 className="font-semibold text-sm truncate">{team.name}</h4>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Chip size="sm" variant="flat" className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        {team.members.length}/{GAME.squadSize}
                    </Chip>
                    <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <ChevronDown className="w-4 h-4 text-foreground/40" />
                    </motion.div>
                </div>
            </button>

            {/* Expandable members */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 py-3 space-y-2 border-t border-amber-500/15">
                            {team.members.map((voter) => (
                                <div key={voter.playerId} className="flex items-center gap-3">
                                    <PlayerAvatar
                                        src={voter.imageUrl}
                                        playerId={voter.playerId}
                                        playerName={voter.displayName}
                                        size="sm"
                                        className="w-8 h-8 shrink-0"
                                    />
                                    <span className="text-sm font-medium truncate">{voter.displayName}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
/* ─── Main Squad Center ─────────────────────────────────────── */

export function SquadCenter({
    isOpen,
    onClose,
    pollId,
    tournamentName,
    entryFee,
    currentPlayerId,
    theme,
    hasVotedIn,
    inVoters = [],
    whatsappGroupLink,
    scheduledDate,
    initialSquadCount,
}: SquadCenterProps) {
    const [showCreate, setShowCreate] = useState(false);
    const [showVoteWarning, setShowVoteWarning] = useState<{ action: "create" | "join"; squadId?: string } | null>(null);
    const [cancelConfirm, setCancelConfirm] = useState<{ squadId: string; isSameDay: boolean } | null>(null);
    const [showCreateChooser, setShowCreateChooser] = useState(false);
    const { data: squadsResult, isLoading, refetch } = useSquads(pollId);
    const squads = squadsResult?.squads;
    const maxSquads = squadsResult?.maxSquads ?? GAME.maxSquadTeams;
    const isMangoScrim = squadsResult?.isMangoScrim ?? false;
    // Mango Scrim: flat 18 cap, no waitlist. Regular: gap to championship threshold.
    const maxWaitlistSlots = isMangoScrim ? 0 : (maxSquads < 20 ? (20 - maxSquads) : 2);
    const [showWaitlist, setShowWaitlist] = useState(false);
    const [showUnconfirmed, setShowUnconfirmed] = useState(true);

    // Always refetch when the squad center opens to prevent stale data
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { refetch(); }, []);
    const cancelMutation = useCancelSquad();
    const respondMutation = useRespondToInvite();
    const requestJoinMutation = useRequestJoin();
    const respondRequestMutation = useRespondToRequest();
    const removeMemberMutation = useRemoveMember();
    const leaveMutation = useLeaveSquad();

    const mySquad = squads?.find(
        (s) => s.isCaptain || s.myInvite?.status === "ACCEPTED" || s.myInvite?.status === "PENDING"
    );
    const otherSquads = squads?.filter((s) => s.id !== mySquad?.id) ?? [];
    const isGuest = !currentPlayerId;
    const canCreateSquad = !mySquad && !isLoading && !!squads;

    // Pre-fetch previous roster for "Use Past Team" button
    const { data: previousRoster } = usePreviousRoster(pollId, canCreateSquad && !isGuest);
    const hasPreviousRoster = !!previousRoster && previousRoster.members.length > 0;
    const [importMode, setImportMode] = useState(false);
    const [quickCreating, setQuickCreating] = useState(false);
    const createMutation = useCreateSquad();
    const importRosterMutation = useImportRoster();
    const [showGuestCreate, setShowGuestCreate] = useState(false);

    // One-click "Use This Team" handler
    async function handleQuickCreate() {
        if (!previousRoster || quickCreating) return;
        setQuickCreating(true);
        try {
            const result = await createMutation.mutateAsync({
                pollId,
                name: previousRoster.squadName,
                fullName: previousRoster.fullName || undefined,
                useClan: !!previousRoster.clanId,
            });
            const newSquadId = result.data?.id;
            if (!newSquadId) throw new Error("Failed to create squad");

            const availableIds = previousRoster.members.filter(m => m.available).map(m => m.playerId);
            if (availableIds.length > 0) {
                await importRosterMutation.mutateAsync({
                    squadId: newSquadId,
                    memberIds: availableIds,
                    autoAcceptAll: true,
                });
            }

            setShowCreateChooser(false);
            refetch();
        } catch (err: any) {
            const toast = (await import("sonner")).toast;
            toast.error(err?.message || "Failed to create team");
        } finally {
            setQuickCreating(false);
        }
    }

    const [respondAction, setRespondAction] = useState<"accept" | "decline" | null>(null);
    const [respondRequestAction, setRespondRequestAction] = useState<"accept" | "decline" | null>(null);
    const [recentlyRequestedSquadId, setRecentlyRequestedSquadId] = useState<string | null>(null);

    // Clear recentlyRequestedSquadId once the data refetch shows the player in the squad
    useEffect(() => {
        if (!recentlyRequestedSquadId) return;
        const found = squads?.find(
            (s) => s.id === recentlyRequestedSquadId && (s.myInvite?.status === "PENDING" || s.myInvite?.status === "ACCEPTED")
        );
        if (found) setRecentlyRequestedSquadId(null);
    }, [squads, recentlyRequestedSquadId]);

    function handleCancel(squadId: string) {
        // Check if same-day cancellation
        let isSameDay = false;
        if (scheduledDate && entryFee > 0) {
            const matchDay = new Date(scheduledDate);
            const today = new Date();
            isSameDay = matchDay.toDateString() === today.toDateString();
        }
        if (isSameDay) {
            setCancelConfirm({ squadId, isSameDay: true });
        } else {
            cancelMutation.mutate(squadId);
        }
    }

    function handleAccept(inviteId: string) {
        setRespondAction("accept");
        respondMutation.mutate({ inviteId, action: "ACCEPT" });
    }

    function handleDecline(inviteId: string) {
        setRespondAction("decline");
        respondMutation.mutate({ inviteId, action: "DECLINE" });
    }

    function handleRequestJoin(squadId: string) {
        if (hasVotedIn) {
            setShowVoteWarning({ action: "join", squadId });
            return;
        }
        requestJoinMutation.mutate(squadId, {
            onSuccess: () => setRecentlyRequestedSquadId(squadId),
        });
    }

    function handleAcceptRequest(inviteId: string) {
        setRespondRequestAction("accept");
        respondRequestMutation.mutate({ inviteId, action: "ACCEPT" });
    }

    function handleDeclineRequest(inviteId: string) {
        setRespondRequestAction("decline");
        respondRequestMutation.mutate({ inviteId, action: "DECLINE" });
    }

    function handleRemoveMember(inviteId: string) {
        removeMemberMutation.mutate(inviteId);
    }

    function handleLeave(squadId: string) {
        leaveMutation.mutate(squadId);
    }

    // Check if the poll is active — we can infer from the first squad's data
    // or we pass it as prop. For now we'll consider squads are always viewable
    const pollIsActive = true; // Squads already filter by poll status in APIs

    // Random teams: IN voters not in any squad, grouped into teams of squadSize
    const randomTeams = useMemo((): RandomTeam[] => {
        if (!squads || inVoters.length === 0) return [];
        // Collect all player IDs that are in a squad (accepted or pending)
        const squadPlayerIds = new Set<string>();
        for (const s of squads) {
            for (const m of s.members) {
                squadPlayerIds.add(m.playerId);
            }
            squadPlayerIds.add(s.captain.id);
        }
        // Filter to voters NOT in any squad, sorted by vote time
        const randomVoters = inVoters
            .filter(v => !squadPlayerIds.has(v.playerId))
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        // Group into teams of squadSize
        const teams: RandomTeam[] = [];
        let teamNum = 1;
        for (let i = 0; i < randomVoters.length; i += GAME.squadSize) {
            const chunk = randomVoters.slice(i, i + GAME.squadSize);
            if (chunk.length === GAME.squadSize) {
                teams.push({
                    id: `random-team-${teamNum}`,
                    name: `${GAME.name} Team ${teamNum}`,
                    members: chunk,
                    formedAt: chunk[chunk.length - 1].createdAt, // last voter's time
                });
                teamNum++;
            }
        }
        return teams;
    }, [squads, inVoters]);

    // Find if the current user is in a random team
    const myRandomTeam = useMemo(() => {
        if (!currentPlayerId) return null;
        return randomTeams.find(t => t.members.some(m => m.playerId === currentPlayerId)) ?? null;
    }, [randomTeams, currentPlayerId]);

    // Merge squads + random teams into a single sorted list (newest first)
    // Exclude the user's own random team (shown separately at top)
    type ListItem = { type: "squad"; data: SquadDTO } | { type: "random"; data: RandomTeam };
    const unifiedList = useMemo((): ListItem[] => {
        const items: ListItem[] = [];
        for (const s of otherSquads) {
            items.push({ type: "squad", data: s });
        }
        for (const t of randomTeams) {
            if (myRandomTeam && t.id === myRandomTeam.id) continue; // shown at top
            items.push({ type: "random", data: t });
        }
        // Sort by creation date descending (newest first, matching squad ordering)
        items.sort((a, b) => {
            const dateA = a.type === "squad" ? new Date(a.data.createdAt).getTime() : new Date(a.data.formedAt).getTime();
            const dateB = b.type === "squad" ? new Date(b.data.createdAt).getTime() : new Date(b.data.formedAt).getTime();
            return dateB - dateA;
        });
        return items;
    }, [otherSquads, randomTeams, myRandomTeam]);

    // Compute confirmed squad IDs (first maxSquads by confirmedAt order)
    // confirmedAt = when captain first had enough balance; falls back to createdAt for legacy
    const confirmedIds = useMemo(() => {
        if (!squads) return new Set<string>();
        const confirmedSquads = squads.filter(s => !s.needsPayment);
        const sorted = [...confirmedSquads].sort((a, b) => {
            const aTime = new Date(a.confirmedAt ?? a.createdAt).getTime();
            const bTime = new Date(b.confirmedAt ?? b.createdAt).getTime();
            return aTime - bTime;
        });
        return new Set(sorted.slice(0, maxSquads).map(s => s.id));
    }, [squads, maxSquads]);

    // Split into confirmed, waitlisted, and unconfirmed (needs payment)
    const { confirmedList, waitlistedList, unconfirmedList } = useMemo(() => {
        if (!squads) return { confirmedList: unifiedList, waitlistedList: [] as ListItem[], unconfirmedList: [] as ListItem[] };
        const confirmed: ListItem[] = [];
        const waitlisted: ListItem[] = [];
        const unconfirmed: ListItem[] = [];
        for (const item of unifiedList) {
            const id = item.data.id;
            if (item.type === "squad" && item.data.needsPayment) {
                unconfirmed.push(item);
            } else if (item.type === "random" || confirmedIds.has(id)) {
                confirmed.push(item);
            } else {
                waitlisted.push(item);
            }
        }
        return { confirmedList: confirmed, waitlistedList: waitlisted, unconfirmedList: unconfirmed };
    }, [unifiedList, squads, confirmedIds]);

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                placement="center"
                size="md"
                scrollBehavior="inside"
                classNames={{
                    body: "px-4 py-3 max-h-[75dvh] overflow-y-auto",
                    wrapper: "z-50",
                }}
            >
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2 text-base pb-1">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${theme ? `bg-gradient-to-r ${theme.header}` : 'bg-primary'}`}>
                            <Shield className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="truncate block">{tournamentName}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-normal text-foreground/50">Squad Center</span>
                                {(() => {
                                    // Show count immediately from poll data, refined once squads load
                                    if (squads && squads.length > 0) {
                                        const confirmedCount = squads.filter(s => !s.needsPayment).length;
                                        const totalDisplay = confirmedCount + randomTeams.length;
                                        return (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-foreground/10 text-foreground/50">
                                                {totalDisplay} squad{totalDisplay !== 1 ? "s" : ""}
                                            </span>
                                        );
                                    }
                                    if (initialSquadCount != null && initialSquadCount > 0) {
                                        return (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-foreground/10 text-foreground/50">
                                                {initialSquadCount} squad{initialSquadCount !== 1 ? "s" : ""}
                                            </span>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        </div>
                    </ModalHeader>


                    <ModalBody>
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Spinner size="lg" />
                            </div>
                        ) : (
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key="squad-list"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="space-y-4"
                                >
                                    {/* Your Squad — always shown at top when you're in one */}
                                    {mySquad && (
                                        <div>
                                            <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-2">
                                                Your Squad
                                            </p>
                                            <SquadCard
                                                squad={mySquad}
                                                currentPlayerId={currentPlayerId}
                                                pollIsActive={pollIsActive}
                                                pollId={pollId}
                                                onCancel={handleCancel}
                                                onAccept={handleAccept}
                                                onDecline={handleDecline}
                                                onRequestJoin={handleRequestJoin}
                                                onAcceptRequest={handleAcceptRequest}
                                                onDeclineRequest={handleDeclineRequest}
                                                onRemoveMember={handleRemoveMember}
                                                onLeave={handleLeave}
                                                isCancelling={cancelMutation.isPending}
                                                isResponding={respondMutation.isPending}
                                                respondingAction={respondMutation.isPending ? respondAction : null}
                                                isRequesting={requestJoinMutation.isPending}
                                                isRespondingRequest={respondRequestMutation.isPending}
                                                respondingRequestAction={respondRequestMutation.isPending ? respondRequestAction : null}
                                                isRemoving={removeMemberMutation.isPending}
                                                isLeaving={leaveMutation.isPending}
                                                recentlyRequestedSquadId={recentlyRequestedSquadId}
                                                defaultExpanded
                                                isRanked

                                            />
                                        </div>
                                    )}
                                    {!mySquad && myRandomTeam && (
                                        <div>
                                            <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-2">
                                                Your Squad
                                            </p>
                                            <RandomTeamCard team={myRandomTeam} defaultExpanded />
                                        </div>
                                    )}

                                    {/* Waitlisted Squads — collapsible, includes own squad if waitlisted */}
                                    {(() => {
                                        const isMySquadWaitlisted = mySquad && !confirmedIds.has(mySquad.id);
                                        const totalWaitlisted = waitlistedList.length + (isMySquadWaitlisted ? 1 : 0);
                                        if (totalWaitlisted === 0) return null;
                                        return (
                                            <div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowWaitlist(!showWaitlist)}
                                                    className="flex items-center gap-2 w-full text-left mb-2 cursor-pointer"
                                                >
                                                    <ChevronRight className={`w-3.5 h-3.5 text-amber-500 transition-transform ${showWaitlist ? "rotate-90" : ""}`} />
                                                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
                                                        Waitlist
                                                    </p>
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
                                                        {totalWaitlisted}/{maxWaitlistSlots}
                                                    </span>
                                                </button>
                                                {showWaitlist && (
                                                    <div className="space-y-3 border-l-2 border-amber-500/20 pl-3">
                                                        {/* My squad first if waitlisted */}
                                                        {isMySquadWaitlisted && (
                                                            <div>
                                                                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1.5">Your Squad</p>
                                                                <SquadCard
                                                                    squad={mySquad}
                                                                    currentPlayerId={currentPlayerId}
                                                                    pollIsActive={pollIsActive}
                                                                    pollId={pollId}
                                                                    onCancel={handleCancel}
                                                                    onAccept={handleAccept}
                                                                    onDecline={handleDecline}
                                                                    onRequestJoin={handleRequestJoin}
                                                                    onAcceptRequest={handleAcceptRequest}
                                                                    onDeclineRequest={handleDeclineRequest}
                                                                    onRemoveMember={handleRemoveMember}
                                                                    onLeave={handleLeave}
                                                                    isCancelling={cancelMutation.isPending}
                                                                    isResponding={respondMutation.isPending}
                                                                    respondingAction={respondMutation.isPending ? respondAction : null}
                                                                    isRequesting={requestJoinMutation.isPending}
                                                                    isRespondingRequest={respondRequestMutation.isPending}
                                                                    respondingRequestAction={respondRequestMutation.isPending ? respondRequestAction : null}
                                                                    isRemoving={removeMemberMutation.isPending}
                                                                    isLeaving={leaveMutation.isPending}
                                                                    recentlyRequestedSquadId={recentlyRequestedSquadId}
                                                                    defaultExpanded
                                                                    isRanked
                    
                                                                />
                                                            </div>
                                                        )}
                                                        {waitlistedList.map((item) => {
                                                            if (item.type === "squad") {
                                                                return (
                                                                    <SquadCard
                                                                        key={item.data.id}
                                                                        squad={item.data}
                                                                        currentPlayerId={currentPlayerId}
                                                                        pollIsActive={pollIsActive}
                                                                        pollId={pollId}
                                                                        onCancel={handleCancel}
                                                                        onAccept={handleAccept}
                                                                        onDecline={handleDecline}
                                                                        onRequestJoin={handleRequestJoin}
                                                                        onAcceptRequest={handleAcceptRequest}
                                                                        onDeclineRequest={handleDeclineRequest}
                                                                        onRemoveMember={handleRemoveMember}
                                                                        onLeave={handleLeave}
                                                                        isCancelling={cancelMutation.isPending}
                                                                        isResponding={respondMutation.isPending}
                                                                        respondingAction={respondMutation.isPending ? respondAction : null}
                                                                        isRequesting={requestJoinMutation.isPending}
                                                                        isRespondingRequest={respondRequestMutation.isPending}
                                                                        respondingRequestAction={respondRequestMutation.isPending ? respondRequestAction : null}
                                                                        isRemoving={removeMemberMutation.isPending}
                                                                        isLeaving={leaveMutation.isPending}
                                                                        recentlyRequestedSquadId={recentlyRequestedSquadId}
                                                                        isRanked
                        
                                                                    />
                                                                );
                                                            }
                                                            return (
                                                                <RandomTeamCard
                                                                    key={item.data.id}
                                                                    team={item.data}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Unconfirmed Squads — collapsible, before confirmed squads */}
                                    {(() => {
                                        // Exclude mySquad from unconfirmed section (it's in "Your Squad" already)
                                        const otherUnconfirmed = unconfirmedList.filter(
                                            (item) => item.type === "squad" && item.data.id !== mySquad?.id
                                        );
                                        if (otherUnconfirmed.length === 0) return null;
                                        return (
                                            <div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowUnconfirmed(!showUnconfirmed)}
                                                    className="flex items-center gap-2 w-full text-left mb-2 cursor-pointer"
                                                >
                                                    <ChevronRight className={`w-3.5 h-3.5 text-red-500 transition-transform ${showUnconfirmed ? "rotate-90" : ""}`} />
                                                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
                                                        Unconfirmed
                                                    </p>
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                                                        {otherUnconfirmed.length}
                                                    </span>
                                                </button>
                                                {showUnconfirmed && (
                                                    <div className="space-y-3 border-l-2 border-red-500/20 pl-3">
                                                        {otherUnconfirmed.map((item) => {
                                                            const sq = item.data as SquadDTO;
                                                            const isMyUnconfirmed = sq.members?.some(m => m.playerId === currentPlayerId);
                                                            return (
                                                                <SquadCard
                                                                    key={sq.id}
                                                                    squad={sq}
                                                                    currentPlayerId={currentPlayerId}
                                                                    pollIsActive={pollIsActive}
                                                                    pollId={pollId}
                                                                    onCancel={handleCancel}
                                                                    onAccept={handleAccept}
                                                                    onDecline={handleDecline}
                                                                    onRequestJoin={handleRequestJoin}
                                                                    onAcceptRequest={handleAcceptRequest}
                                                                    onDeclineRequest={handleDeclineRequest}
                                                                    onRemoveMember={handleRemoveMember}
                                                                    onLeave={handleLeave}
                                                                    isCancelling={cancelMutation.isPending}
                                                                    isResponding={respondMutation.isPending}
                                                                    respondingAction={respondMutation.isPending ? respondAction : null}
                                                                    isRequesting={requestJoinMutation.isPending}
                                                                    isRespondingRequest={respondRequestMutation.isPending}
                                                                    respondingRequestAction={respondRequestMutation.isPending ? respondRequestAction : null}
                                                                    isRemoving={removeMemberMutation.isPending}
                                                                    isLeaving={leaveMutation.isPending}
                                                                    recentlyRequestedSquadId={recentlyRequestedSquadId}
                                                                    defaultExpanded={isMyUnconfirmed}
                                                                    isRanked
                    
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Other Squads + Random Teams — confirmed */}
                                    {confirmedList.length > 0 && (
                                        <div>
                                            <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-2">
                                                {(mySquad || myRandomTeam) ? "Other Squads" : "Squads"}
                                            </p>
                                            <div className="space-y-3">
                                                {confirmedList.map((item) => {
                                                    if (item.type === "squad") {
                                                        return (
                                                            <SquadCard
                                                                key={item.data.id}
                                                                squad={item.data}
                                                                currentPlayerId={currentPlayerId}
                                                                pollIsActive={pollIsActive}
                                                                pollId={pollId}
                                                                onCancel={handleCancel}
                                                                onAccept={handleAccept}
                                                                onDecline={handleDecline}
                                                                onRequestJoin={handleRequestJoin}
                                                                onAcceptRequest={handleAcceptRequest}
                                                                onDeclineRequest={handleDeclineRequest}
                                                                onRemoveMember={handleRemoveMember}
                                                                onLeave={handleLeave}
                                                                isCancelling={cancelMutation.isPending}
                                                                isResponding={respondMutation.isPending}
                                                                respondingAction={respondMutation.isPending ? respondAction : null}
                                                                isRequesting={requestJoinMutation.isPending}
                                                                isRespondingRequest={respondRequestMutation.isPending}
                                                                respondingRequestAction={respondRequestMutation.isPending ? respondRequestAction : null}
                                                                isRemoving={removeMemberMutation.isPending}
                                                                isLeaving={leaveMutation.isPending}
                                                                recentlyRequestedSquadId={recentlyRequestedSquadId}
                                                                isRanked
                
                                                            />
                                                        );
                                                    }
                                                    return (
                                                        <RandomTeamCard
                                                            key={item.data.id}
                                                            team={item.data}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}


                                    {/* Empty state */}
                                    {(!squads || squads.length === 0) && (
                                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                                            <div className="w-14 h-14 rounded-full bg-default-100 flex items-center justify-center">
                                                <Users className="w-6 h-6 text-foreground/25" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-foreground/60">No squads yet</p>
                                                <p className="text-sm text-foreground/40">
                                                    Be the first to create a team!
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        )}
                    </ModalBody>

                    {canCreateSquad && (
                        <ModalFooter className={hasPreviousRoster ? "flex-col gap-2" : ""}>
                            {isGuest ? (
                                <Button
                                    className={`w-full font-semibold text-white ${theme ? `bg-gradient-to-r ${theme.header}` : ''}`}
                                    color={theme ? undefined : "primary"}
                                    startContent={<Plus className="w-4 h-4" />}
                                    onPress={() => setShowGuestCreate(true)}
                                >
                                    Create Team
                                </Button>
                            ) : (
                                <Button
                                    className={`w-full font-semibold text-white ${theme ? `bg-gradient-to-r ${theme.header}` : ''}`}
                                    color={theme ? undefined : "primary"}
                                    startContent={<Plus className="w-4 h-4" />}
                                    onPress={() => {
                                        // Show chooser only if past roster available
                                        if (!hasPreviousRoster) {
                                            if (hasVotedIn) {
                                                setShowVoteWarning({ action: "create" });
                                            } else {
                                                setImportMode(false);
                                                setShowCreate(true);
                                            }
                                        } else {
                                            setShowCreateChooser(true);
                                        }
                                    }}
                                >
                                    Create Team
                                </Button>
                            )}
                        </ModalFooter>
                    )}
                </ModalContent>
            </Modal>

            {/* Create Squad Modal */}
            <CreateSquadModal
                isOpen={showCreate}
                onClose={() => {
                    setShowCreate(false);
                    refetch();
                }}
                pollId={pollId}
                tournamentName={tournamentName}
                entryFee={entryFee}
                whatsappGroupLink={whatsappGroupLink}
                hasVotedIn={hasVotedIn}
                isRanked
                captainInfo={inVoters.find(v => v.playerId === currentPlayerId) ? {
                    id: currentPlayerId,
                    displayName: inVoters.find(v => v.playerId === currentPlayerId)!.displayName,
                    imageUrl: inVoters.find(v => v.playerId === currentPlayerId)!.imageUrl,
                } : { id: currentPlayerId, displayName: "You", imageUrl: "" }}
                importRoster={importMode ? previousRoster ?? undefined : undefined}
            />

            {/* Past Roster Preview / Create Chooser Modal */}
            <Modal
                isOpen={showCreateChooser}
                onClose={() => setShowCreateChooser(false)}
                placement="center"
                size="md"
                classNames={{
                    base: "bg-background border border-divider",
                    backdrop: "bg-black/60 backdrop-blur-sm",
                    wrapper: "z-[60]",
                }}
            >
                <ModalContent>
                    <ModalHeader className="text-base pb-1 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-emerald-500" />
                        Your Previous Team
                    </ModalHeader>
                    <ModalBody className="pb-2 space-y-3">
                        {/* Past team name */}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                            <Shield className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="text-sm font-bold text-emerald-400 truncate">{previousRoster?.squadName}</span>
                            {previousRoster?.fullName && (
                                <span className="text-xs text-foreground/40 truncate">({previousRoster.fullName})</span>
                            )}
                        </div>

                        {/* Members list */}
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-foreground/50 px-1">Roster ({previousRoster?.members.filter(m => m.available).length ?? 0} available)</p>
                            <div className="space-y-1.5 max-h-52 overflow-y-auto">
                                {previousRoster?.members.map((m) => (
                                    <div
                                        key={m.playerId}
                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                                            m.available
                                                ? 'bg-foreground/[0.03] border border-foreground/5'
                                                : 'opacity-40 line-through'
                                        }`}
                                    >
                                        <PlayerAvatar src={m.imageUrl} playerId={m.playerId} playerName={m.displayName} size="sm" className="w-7 h-7 shrink-0" />
                                        <span className="text-sm font-medium flex-1 truncate">{m.displayName}</span>
                                        {m.available ? (
                                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        ) : (
                                            <X className="w-3.5 h-3.5 text-foreground/30 shrink-0" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter className="flex-col gap-2">
                        {/* Use This Team — primary action */}
                        <Button
                            className="w-full font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500"
                            isLoading={quickCreating}
                            startContent={!quickCreating && <CheckCheck className="w-4 h-4" />}
                            onPress={handleQuickCreate}
                        >
                            {(() => {
                                const avail = previousRoster?.members.filter(m => m.available).length ?? 0;
                                return avail > 0
                                    ? `Use This Team · ${avail} member${avail > 1 ? 's' : ''}`
                                    : 'Recreate Team Name';
                            })()}
                        </Button>
                        {/* Create New — secondary */}
                        <Button
                            variant="flat"
                            className="w-full font-semibold"
                            startContent={<Plus className="w-4 h-4" />}
                            isDisabled={quickCreating}
                            onPress={() => {
                                setShowCreateChooser(false);
                                if (hasVotedIn) {
                                    setShowVoteWarning({ action: "create" });
                                } else {
                                    setImportMode(false);
                                    setShowCreate(true);
                                }
                            }}
                        >
                            Create New Team
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Vote conflict warning modal */}
            <Modal
                isOpen={!!showVoteWarning}
                onClose={() => setShowVoteWarning(null)}
                placement="center"
                size="sm"
                classNames={{
                    base: "bg-background border border-divider",
                    backdrop: "bg-black/60 backdrop-blur-sm",
                    wrapper: "z-[60]",
                }}
            >
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2 text-base">
                        <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                        </div>
                        <span>You already voted! 😎</span>
                    </ModalHeader>
                    <ModalBody className="pt-0">
                        <p className="text-sm text-foreground/70">
                            You have an <strong>individual vote</strong> on this tournament.
                            {showVoteWarning?.action === "create"
                                ? " Creating a team will "
                                : " Joining this squad will "
                            }
                            <strong>remove your solo entry</strong> and place you in the squad instead.
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="flat"
                            size="sm"
                            onPress={() => setShowVoteWarning(null)}
                        >
                            Keep Solo Vote
                        </Button>
                        <Button
                            color="primary"
                            size="sm"
                            className="font-semibold"
                            onPress={() => {
                                if (showVoteWarning?.action === "create") {
                                    setShowVoteWarning(null);
                                    setShowCreate(true);
                                } else if (showVoteWarning?.squadId) {
                                    setShowVoteWarning(null);
                                    requestJoinMutation.mutate(showVoteWarning.squadId);
                                }
                            }}
                        >
                            {showVoteWarning?.action === "create" ? "Create Team Instead" : "Join Squad Instead"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Same-day cancel penalty confirmation */}
            <Modal isOpen={!!cancelConfirm} onClose={() => setCancelConfirm(null)} size="sm">
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2 text-warning">
                        <AlertTriangle className="w-5 h-5" />
                        Same-Day Cancellation
                    </ModalHeader>
                    <ModalBody>
                        <p className="text-sm text-foreground/70">
                            Cancelling on match day will result in a <strong className="text-danger">50% penalty</strong>.
                        </p>
                        <div className="flex items-center justify-between rounded-lg bg-danger-50 dark:bg-danger-50/10 p-3 mt-1">
                            <span className="text-sm text-danger font-medium">Penalty</span>
                            <span className="text-sm font-bold text-danger">
                                {Math.floor(entryFee / 2)} {GAME.currency}
                            </span>
                        </div>
                        <p className="text-xs text-foreground/50 mt-1">
                            Only {Math.ceil(entryFee / 2)} {GAME.currency} of your {entryFee} {GAME.currency} entry will be refunded.
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button size="sm" variant="flat" onPress={() => setCancelConfirm(null)}>
                            Keep Squad
                        </Button>
                        <Button
                            size="sm"
                            color="danger"
                            isLoading={cancelMutation.isPending}
                            onPress={() => {
                                if (cancelConfirm) {
                                    cancelMutation.mutate(cancelConfirm.squadId);
                                    setCancelConfirm(null);
                                }
                            }}
                        >
                            Cancel &amp; Pay Penalty
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Guest Squad Creation Modal */}
            {isGuest && (
                <GuestSquadModal
                    isOpen={showGuestCreate}
                    onClose={() => { setShowGuestCreate(false); refetch(); }}
                    pollId={pollId}
                    tournamentName={tournamentName}
                    entryFee={entryFee}
                />
            )}
        </>
    );
}

/* ── Guest Squad Creation Modal ─────────────────────────── */

interface PhoneCheckResult {
    found: boolean;
    displayName?: string;
    imageUrl?: string | null;
    previousRoster?: {
        squadName: string;
        fullName?: string | null;
        members: {
            playerId: string;
            displayName: string;
            imageUrl: string;
            isGhost: boolean;
            isSub: boolean;
            phone: string | null;
            available: boolean;
        }[];
    } | null;
}

function GuestSquadModal({
    isOpen,
    onClose,
    pollId,
    tournamentName,
    entryFee,
}: {
    isOpen: boolean;
    onClose: () => void;
    pollId: string;
    tournamentName: string;
    entryFee: number;
}) {
    const queryClient = useQueryClient();

    // Captain info
    const [captainName, setCaptainName] = useState("");
    const [captainPhone, setCaptainPhone] = useState("");
    const [teamName, setTeamName] = useState("");
    const [teamFullName, setTeamFullName] = useState("");

    // Phone check state
    const [phoneCheckResult, setPhoneCheckResult] = useState<PhoneCheckResult | null>(null);
    const [phoneChecking, setPhoneChecking] = useState(false);
    const [phoneChecked, setPhoneChecked] = useState("");
    const [showIdentityPrompt, setShowIdentityPrompt] = useState(false);
    const [identityConfirmed, setIdentityConfirmed] = useState(false);

    // Teammate slots (index → name)
    const totalSlots = GAME.maxSquadSize - 1;
    const [slotNames, setSlotNames] = useState<Record<number, string>>({});
    const [slotPhones, setSlotPhones] = useState<Record<number, string>>({});

    // Submission
    const [submitting, setSubmitting] = useState(false);

    // Reset on close
    const handleClose = () => {
        setCaptainName("");
        setCaptainPhone("");
        setTeamName("");
        setTeamFullName("");
        setPhoneCheckResult(null);
        setPhoneChecking(false);
        setPhoneChecked("");
        setShowIdentityPrompt(false);
        setIdentityConfirmed(false);
        setSlotNames({});
        setSlotPhones({});
        setSubmitting(false);
        onClose();
    };

    // Background phone check — fires when 10 digits entered
    useEffect(() => {
        const normalized = captainPhone.replace(/\D/g, "");
        if (normalized.length !== 10 || normalized === phoneChecked) return;

        const timer = setTimeout(async () => {
            setPhoneChecking(true);
            try {
                const res = await fetch("/api/auth/check-phone", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ phone: normalized, pollId }),
                });
                const json = await res.json();
                if (res.ok && json.data) {
                    setPhoneCheckResult(json.data);
                    setPhoneChecked(normalized);
                    if (json.data.found) {
                        setShowIdentityPrompt(true);
                    }
                }
            } catch { /* silent */ }
            setPhoneChecking(false);
        }, 400);

        return () => clearTimeout(timer);
    }, [captainPhone, phoneChecked, pollId]);

    // When user confirms identity → prefill roster
    const handleIdentityYes = () => {
        setShowIdentityPrompt(false);
        setIdentityConfirmed(true);
        if (phoneCheckResult?.displayName) {
            setCaptainName(phoneCheckResult.displayName);
        }
        if (phoneCheckResult?.previousRoster) {
            const roster = phoneCheckResult.previousRoster;
            setTeamName(roster.squadName || "");
            if (roster.fullName) setTeamFullName(roster.fullName);
            const newNames: Record<number, string> = {};
            const newPhones: Record<number, string> = {};
            roster.members.filter(m => m.available).forEach((m, i) => {
                if (i < totalSlots) {
                    newNames[i] = m.displayName;
                    if (m.phone) newPhones[i] = m.phone;
                }
            });
            setSlotNames(newNames);
            setSlotPhones(newPhones);
        }
    };

    const handleIdentityNo = () => {
        setShowIdentityPrompt(false);
        setIdentityConfirmed(false);
    };

    // Submit guest squad
    const handleSubmit = async () => {
        if (!captainName.trim() || !captainPhone.trim() || !teamName.trim()) return;
        setSubmitting(true);
        try {
            const members = Object.entries(slotNames)
                .filter(([, name]) => name.trim())
                .map(([idx, name]) => ({
                    name: name.trim(),
                    phone: slotPhones[Number(idx)] || undefined,
                }));

            const res = await fetch("/api/squads/guest-create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pollId,
                    captainName: captainName.trim(),
                    captainPhone: captainPhone.trim(),
                    teamName: teamName.trim(),
                    teamFullName: teamFullName.trim() || undefined,
                    members,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                const { toast } = await import("sonner");
                toast.error(json.message || "Failed to create team");
                return;
            }
            const { toast } = await import("sonner");
            toast.success(json.message || "Team created! 🎉");
            queryClient.invalidateQueries({ queryKey: ["squads"] });
            handleClose();
        } catch {
            const { toast } = await import("sonner");
            toast.error("Failed to create team");
        } finally {
            setSubmitting(false);
        }
    };

    const filledCount = Object.values(slotNames).filter(n => n.trim()).length;
    const canSubmit = captainName.trim() && captainPhone.replace(/\D/g, "").length === 10 && teamName.trim();

    return (
        <>
        <Modal
            isOpen={isOpen && !showIdentityPrompt}
            onClose={handleClose}
            placement="center"
            size="full"
            scrollBehavior="inside"
            classNames={{
                wrapper: "z-[60]",
                body: "px-4 py-0",
            }}
        >
            <ModalContent>
                <ModalHeader className="flex items-center gap-2 text-base pb-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                        <Shield className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <span className="truncate block">Create Team</span>
                        <span className="text-xs font-normal text-foreground/50">{tournamentName}</span>
                    </div>
                </ModalHeader>

                <ModalBody>
                    <div className="space-y-4">
                        {/* Entry fee info */}
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                            <CurrencyIcon size={16} />
                            <div className="text-sm">
                                <span className="font-medium">{entryFee} {GAME.hasDualCurrency ? GAME.entryCurrency : GAME.currency}</span>
                                <span className="text-foreground/60"> per team • {GAME.maxSquadSize} players ({GAME.maxSquadSize - GAME.squadSize} subs)</span>
                            </div>
                        </div>

                        {/* Captain Info */}
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">Your Info (Leader)</p>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Your name"
                                    value={captainName}
                                    onValueChange={(v) => setCaptainName(v.slice(0, 20))}
                                    maxLength={20}
                                    size="sm"
                                    classNames={{ input: "text-sm" }}
                                    startContent={<Users className="w-3.5 h-3.5 text-foreground/40" />}
                                />
                                <Input
                                    placeholder="Phone (10 digits)"
                                    value={captainPhone}
                                    onValueChange={(v) => setCaptainPhone(v.replace(/\D/g, "").slice(0, 10))}
                                    maxLength={10}
                                    type="tel"
                                    size="sm"
                                    classNames={{ input: "text-sm", base: "min-w-[140px]" }}
                                    startContent={<Phone className="w-3.5 h-3.5 text-foreground/40" />}
                                    endContent={phoneChecking ? <Spinner size="sm" /> : null}
                                />
                            </div>
                            {/* Identity match hint */}
                            {identityConfirmed && phoneCheckResult?.found && (
                                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                    {phoneCheckResult.imageUrl && (
                                        <img src={phoneCheckResult.imageUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                            ✅ Playing as {phoneCheckResult.displayName}
                                        </p>
                                        <p className="text-[10px] text-foreground/40">
                                            Sign in to track KD, earn rewards & more
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="flat"
                                        className="min-w-0 px-2.5 h-6 text-[10px] font-semibold bg-primary/10 text-primary"
                                        onPress={() => { window.location.href = "/sign-in"; }}
                                    >
                                        Sign in
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Team Name */}
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">Team</p>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Team tag (e.g. ALPHA)"
                                    value={teamName}
                                    onValueChange={(v) => setTeamName(v.slice(0, 7))}
                                    maxLength={7}
                                    size="sm"
                                    description={`${teamName.length}/7`}
                                    classNames={{ input: "text-sm" }}
                                    startContent={<Shield className="w-3.5 h-3.5 text-foreground/40" />}
                                />
                                <Input
                                    placeholder="Full name (optional)"
                                    value={teamFullName}
                                    onValueChange={(v) => setTeamFullName(v.slice(0, 30))}
                                    maxLength={30}
                                    size="sm"
                                    classNames={{ input: "text-sm" }}
                                />
                            </div>
                        </div>

                        {/* Teammate Slots */}
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">
                                Teammates ({filledCount}/{totalSlots})
                            </p>
                            <div className="space-y-1.5">
                                {Array.from({ length: totalSlots }).map((_, i) => {
                                    const slotLabel = `Player ${i + 2}`;
                                    return (
                                        <div key={`guest-slot-${i}`} className="flex items-center gap-2 rounded-xl border px-3 py-2 border-foreground/15">
                                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 bg-purple-500/10 text-purple-500">
                                                {i + 2}
                                            </div>
                                            <input
                                                type="text"
                                                placeholder={slotLabel}
                                                value={slotNames[i] || ""}
                                                onChange={(e) => setSlotNames(prev => ({ ...prev, [i]: e.target.value }))}
                                                maxLength={20}
                                                className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-foreground/30"
                                            />
                                            <input
                                                type="tel"
                                                placeholder="Phone"
                                                value={slotPhones[i] || ""}
                                                onChange={(e) => setSlotPhones(prev => ({ ...prev, [i]: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                                                maxLength={10}
                                                className="w-24 bg-transparent text-xs text-foreground/50 outline-none placeholder:text-foreground/20 text-right"
                                            />
                                            {slotNames[i]?.trim() && (
                                                <button
                                                    onClick={() => {
                                                        setSlotNames(prev => { const n = { ...prev }; delete n[i]; return n; });
                                                        setSlotPhones(prev => { const n = { ...prev }; delete n[i]; return n; });
                                                    }}
                                                    className="w-5 h-5 rounded-full hover:bg-foreground/10 flex items-center justify-center shrink-0"
                                                >
                                                    <X className="w-3 h-3 text-foreground/30" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Sign-in encouragement */}
                        {!identityConfirmed && (
                            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-foreground/5 border border-divider">
                                <LogIn className="w-4 h-4 text-primary shrink-0" />
                                <p className="text-[11px] text-foreground/50 flex-1">
                                    <button
                                        className="text-primary font-semibold hover:underline"
                                        onClick={() => { window.location.href = "/sign-in"; }}
                                    >
                                        Sign in
                                    </button>
                                    {" "}to track KD, earn rewards, and manage your team
                                </p>
                            </div>
                        )}
                    </div>
                </ModalBody>

                <ModalFooter>
                    <div className="flex gap-2 w-full">
                        <Button variant="flat" className="flex-1" onPress={handleClose}>
                            Cancel
                        </Button>
                        <Button
                            color="primary"
                            className="flex-1 font-semibold"
                            isDisabled={!canSubmit}
                            isLoading={submitting}
                            onPress={handleSubmit}
                            startContent={!submitting && <Shield className="w-4 h-4" />}
                        >
                            Create Team {filledCount > 0 ? `(+${filledCount})` : ""}
                        </Button>
                    </div>
                </ModalFooter>
            </ModalContent>
        </Modal>

        {/* "Are you [Name]?" Identity Confirmation Modal */}
        <Modal
            isOpen={showIdentityPrompt}
            onClose={handleIdentityNo}
            placement="center"
            size="sm"
            classNames={{
                base: "bg-background border border-divider",
                backdrop: "bg-black/60 backdrop-blur-sm",
                wrapper: "z-[70]",
            }}
        >
            <ModalContent>
                <ModalHeader className="flex items-center gap-3 pb-1">
                    {phoneCheckResult?.imageUrl && (
                        <img src={phoneCheckResult.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0 border-2 border-primary/30" />
                    )}
                    <div>
                        <p className="text-base font-bold">Are you {phoneCheckResult?.displayName}?</p>
                        <p className="text-xs font-normal text-foreground/50">We found an account linked to this number</p>
                    </div>
                </ModalHeader>
                <ModalBody className="pt-0">
                    {phoneCheckResult?.previousRoster && phoneCheckResult.previousRoster.members.length > 0 && (
                        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-3 space-y-2">
                            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                🏆 Your last team: {phoneCheckResult.previousRoster.squadName}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {phoneCheckResult.previousRoster.members.filter(m => m.available).map((m) => (
                                    <span key={m.playerId} className="text-[11px] px-2 py-0.5 rounded-full bg-foreground/5 text-foreground/70">
                                        {m.displayName}
                                    </span>
                                ))}
                            </div>
                            <p className="text-[10px] text-foreground/40">
                                Tap Yes to auto-fill your previous roster
                            </p>
                        </div>
                    )}
                    <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 mt-1">
                        <p className="text-xs text-foreground/60">
                            <strong className="text-primary">Tip:</strong> Sign in to track your KD, earn rewards, get auto-invited by captains, and much more!
                        </p>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button
                        variant="flat"
                        size="sm"
                        className="flex-1"
                        onPress={handleIdentityNo}
                    >
                        No, that&apos;s not me
                    </Button>
                    <Button
                        color="primary"
                        size="sm"
                        className="flex-1 font-semibold"
                        onPress={handleIdentityYes}
                    >
                        Yes, that&apos;s me!
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
        </>
    );
}

/* ── Payment Banner ──────────────────────────────────────── */

function PaymentBanner({ pollId, entryFee }: { pollId: string; entryFee: number }) {
    const queryClient = useQueryClient();
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setRefreshing(true);
        await queryClient.invalidateQueries({ queryKey: ["squads", pollId] });
        setRefreshing(false);
    };

    return (
        <div className="mx-4 mt-3 mb-1 rounded-xl border border-amber-400/25 bg-gradient-to-r from-amber-500/8 to-amber-600/5 p-3 space-y-2">
            <div className="flex items-start gap-2.5">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-amber-600 dark:text-amber-400 leading-tight">
                        Team not confirmed
                    </p>
                    <p className="text-[11px] text-foreground/50 mt-0.5">
                        Add {entryFee} {GAME.currency} to secure your spot
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="shrink-0 w-7 h-7 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 flex items-center justify-center transition-colors disabled:opacity-50"
                    title="Re-check balance"
                >
                    <RefreshCw className={`w-3.5 h-3.5 text-amber-500 ${refreshing ? "animate-spin" : ""}`} />
                </button>
            </div>
            <p className="text-[10px] text-foreground/30 leading-tight pl-[30px]">
                Only visible to you · tap ↻ after adding {GAME.currency}
            </p>
        </div>
    );
}
