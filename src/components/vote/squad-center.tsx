"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Avatar,
    Chip,
    Spinner,
    Input,
} from "@heroui/react";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { Shield, Plus, Users, Crown, Check, Clock, X, Trash2, UserPlus, LogIn, ChevronDown, ChevronRight, Search, MoreVertical, Swords, Share2, CheckCheck, Copy, AlertTriangle } from "lucide-react";
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
    type SquadDTO,
} from "@/hooks/use-squads";
import { CreateSquadModal } from "./create-squad-modal";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";
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
                <Share2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </button>
            <AnimatePresence>
                {showTip && (
                    <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        className="absolute right-0 top-full mt-1.5 z-50 whitespace-nowrap px-2.5 py-1.5 rounded-lg bg-foreground text-background text-[11px] font-medium shadow-lg"
                    >
                        Share to teammates on WhatsApp
                        <div className="absolute -top-1 right-3 w-2 h-2 bg-foreground rotate-45" />
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
                    key="toggle-sub"
                    startContent={member.isSub ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                    onPress={() => toggleSub.mutate()}
                >
                    {member.isSub ? "Move to Active" : "Mark as Sub"}
                </DropdownItem>
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
    const [discordSkipped, setDiscordSkipped] = useState(() => {
        if (typeof window !== "undefined") return sessionStorage.getItem("discord_member_skipped") === "true";
        return false;
    });
    const [discordLinked, setDiscordLinked] = useState(() => {
        if (typeof window !== "undefined") return sessionStorage.getItem("discord_linked") === "true";
        return false;
    });
    const cardRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const proxyInputRef = useRef<HTMLInputElement>(null);
    const isCaptain = squad.captain.id === currentPlayerId;

    // Invite hooks (only active when captain opens invite)
    const { data: searchResults, isLoading: isSearching } = useSearchPlayers(
        showInvite ? inviteSearch : "", pollId
    );
    const inviteMutation = useInvitePlayer();
    const [invitingPlayerId, setInvitingPlayerId] = useState<string | null>(null);
    const emptySlots = squad.totalSlots - squad.members.length;

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
            className={`rounded-xl overflow-hidden ${
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
                    <h4 className={`font-semibold text-sm truncate ${squad.isDefendingChampion ? 'text-amber-900 dark:text-amber-100' : ''}`}>{squad.name}</h4>
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
                    {isCaptain && !squad.isFull && squad.status === "FORMING" && pollIsActive && (
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
                        {/* Members */}
                        <div className="px-4 py-3 space-y-2 border-t border-divider/50">
                            {squad.members.map((member) => {
                                const isMemberCaptain = member.playerId === squad.captain.id;
                                const showRemove = isCaptain && !isMemberCaptain && pollIsActive &&
                                    (member.status === "ACCEPTED" || (member.status === "PENDING" && member.initiatedBy === "CAPTAIN"));
                                const canToggleSub = squad.acceptedCount > GAME.squadSize;
                                return (
                                    <div key={member.inviteId} className="flex items-center gap-3">
                                        <Avatar
                                            src={member.imageUrl}
                                            name={member.displayName}
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
                                                {member.isSub && member.status === "ACCEPTED" && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-500 dark:text-blue-400 shrink-0 whitespace-nowrap">SUB</span>
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


                        {/* Captain: Invite Players */}
                        {isCaptain && !squad.isFull && squad.status === "FORMING" && pollIsActive && (
                            <div className="px-4 py-3 border-t border-divider/50">
                                <Button
                                    size="sm"
                                    variant="flat"
                                    color="primary"
                                    className="w-full font-medium"
                                    startContent={<UserPlus className="w-3.5 h-3.5" />}
                                    onPress={() => setShowInvite(true)}
                                >
                                    Invite Players
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
                                            <Avatar
                                                src={req.imageUrl}
                                                name={req.displayName}
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

                        {/* Member: Discord join/skip prompt (non-captain, accepted) */}
                        {!isCaptain && myInvite?.status === "ACCEPTED" && !discordLinked && !discordSkipped && (
                            <div className="px-4 py-3 border-t border-divider/50 space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-[#5865F2]/15 flex items-center justify-center shrink-0">
                                        <svg className="w-4 h-4 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-[#5865F2]">Join our Discord</p>
                                        <p className="text-[10px] text-foreground/40">Get room ID & match updates directly</p>
                                    </div>
                                </div>
                                <a
                                    href={process.env.NEXT_PUBLIC_DISCORD_INVITE_LINK || "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => {
                                        setDiscordLinked(true);
                                        sessionStorage.setItem("discord_linked", "true");
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-xs transition-all bg-[#5865F2] hover:bg-[#4752C4] text-white"
                                >
                                    Join Discord Server
                                </a>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDiscordSkipped(true);
                                        sessionStorage.setItem("discord_member_skipped", "true");
                                    }}
                                    className="w-full text-center text-[11px] text-foreground/35 hover:text-foreground/50 transition-colors py-1 cursor-pointer"
                                >
                                    Skip — I'll get the room ID from my leader
                                </button>
                            </div>
                        )}

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




                        {/* Cancel squad (captain only) */}
                        {isCaptain && squad.status === "FORMING" && (
                            <div className="px-4 py-2 border-t border-divider/50">
                                <Button
                                    size="sm"
                                    variant="light"
                                    color="danger"
                                    className="w-full"
                                    isLoading={isCancelling}
                                    onPress={() => onCancel(squad.id)}
                                    startContent={!isCancelling && <Trash2 className="w-3.5 h-3.5" />}
                                >
                                    Cancel Squad
                                </Button>
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
                            <span className="text-xs font-normal text-foreground/50">{squad.name}</span>
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
                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors mb-3"
                        >
                            <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Share invite on WhatsApp</p>
                                <p className="text-[11px] text-emerald-600/60 dark:text-emerald-400/60">Send link to your teammates</p>
                            </div>
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

                        {/* Results */}
                        <div className="mt-3 space-y-1">
                            {isSearching && (
                                <div className="flex justify-center py-6">
                                    <Spinner size="sm" />
                                </div>
                            )}
                            {searchResults && searchResults.length > 0 && (
                                <div className="space-y-0.5">
                                    {searchResults
                                        .filter(p => !squad.members.some(m => m.playerId === p.id))
                                        .map((player) => (
                                        <div key={player.id} className="flex items-center gap-3 py-2.5 px-1">
                                            <Avatar
                                                src={player.imageUrl}
                                                name={player.displayName}
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
                            {searchResults && searchResults.filter(p => !squad.members.some(m => m.playerId === p.id)).length >= 10 && (
                                <p className="text-xs text-foreground/40 text-center py-2">Player not found? Type more</p>
                            )}
                            {inviteSearch.length >= 2 && !isSearching && searchResults?.filter(p => !squad.members.some(m => m.playerId === p.id)).length === 0 && (
                                <p className="text-xs text-foreground/40 text-center py-4">Player not found? Type more</p>
                            )}
                            {!inviteSearch && !isSearching && (
                                <p className="text-sm text-foreground/30 text-center py-8">Type a name to search players</p>
                            )}
                        </div>
                    </ModalBody>
                </ModalContent>
            </Modal>
        </>
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
                                    <Avatar
                                        src={voter.imageUrl}
                                        name={voter.displayName}
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
}: SquadCenterProps) {
    const [showCreate, setShowCreate] = useState(false);
    const [showVoteWarning, setShowVoteWarning] = useState<{ action: "create" | "join"; squadId?: string } | null>(null);
    const [cancelConfirm, setCancelConfirm] = useState<{ squadId: string; isSameDay: boolean } | null>(null);
    const { data: squadsResult, isLoading, refetch } = useSquads(pollId);
    const squads = squadsResult?.squads;
    const maxSquads = squadsResult?.maxSquads ?? GAME.maxSquadTeams;
    // Gap to next confirmation threshold: 16→20 = 4 slots, 20+→ always 2 (even groups)
    const maxWaitlistSlots = maxSquads < 20 ? (20 - maxSquads) : 2;
    const [showWaitlist, setShowWaitlist] = useState(false);

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

    // Compute confirmed squad IDs (first maxSquads by creation order)
    const confirmedIds = useMemo(() => {
        if (!squads) return new Set<string>();
        const allSquadsSorted = [...squads].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        return new Set(allSquadsSorted.slice(0, maxSquads).map(s => s.id));
    }, [squads, maxSquads]);

    // Split into confirmed and waitlisted
    const { confirmedList, waitlistedList } = useMemo(() => {
        if (!squads) return { confirmedList: unifiedList, waitlistedList: [] as ListItem[] };
        const confirmed: ListItem[] = [];
        const waitlisted: ListItem[] = [];
        for (const item of unifiedList) {
            const id = item.data.id;
            if (item.type === "random" || confirmedIds.has(id)) {
                confirmed.push(item);
            } else {
                waitlisted.push(item);
            }
        }
        return { confirmedList: confirmed, waitlistedList: waitlisted };
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
                                {squads && squads.length > 0 && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-foreground/10 text-foreground/50">
                                        {squads.length + randomTeams.length} squad{(squads.length + randomTeams.length) !== 1 ? "s" : ""}
                                    </span>
                                )}
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
                                    {/* Your Squad — only if CONFIRMED */}
                                    {mySquad && confirmedIds.has(mySquad.id) && (
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
                        <ModalFooter>
                            {isGuest ? (
                                <Button
                                    className={`w-full font-semibold text-white ${theme ? `bg-gradient-to-r ${theme.header}` : ''}`}
                                    color={theme ? undefined : "primary"}
                                    startContent={<LogIn className="w-4 h-4" />}
                                    onPress={() => { window.location.href = "/sign-in"; }}
                                >
                                    Sign in to Create Team
                                </Button>
                            ) : (
                                <Button
                                    className={`w-full font-semibold text-white ${theme ? `bg-gradient-to-r ${theme.header}` : ''}`}
                                    color={theme ? undefined : "primary"}
                                    startContent={<Plus className="w-4 h-4" />}
                                    onPress={() => {
                                        if (hasVotedIn) {
                                            setShowVoteWarning({ action: "create" });
                                        } else {
                                            setShowCreate(true);
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
            />

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
        </>
    );
}
