"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthUser } from "@/hooks/use-auth-user";
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
import { Shield, Plus, Users, Crown, Check, Clock, X, Trash2, UserPlus, LogIn, ChevronDown, ChevronRight, Search, MoreVertical, Swords, Share2, CheckCheck, Copy, AlertTriangle, Phone, Ghost, Zap } from "lucide-react";
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
    isAdmin: isAdminProp,
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
    isAdmin?: boolean;
}) {
    const myInvite = squad.myInvite;
    const hasPendingInvite = myInvite?.status === "PENDING" && myInvite?.initiatedBy === "CAPTAIN";
    const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? hasPendingInvite ?? false);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteSearch, setInviteSearch] = useState("");
    // Ghost member add state
    const [showGhostAdd, setShowGhostAdd] = useState(false);
    const [ghostPhone, setGhostPhone] = useState("");
    const [ghostEmail, setGhostEmail] = useState("");
    const [ghostName, setGhostName] = useState("");
    const [ghostAdding, setGhostAdding] = useState(false);
    const [ghostConfirm, setGhostConfirm] = useState<{ id: string; displayName: string; imageUrl?: string; phone?: string; email?: string } | null>(null);
    const [ghostConfirming, setGhostConfirming] = useState(false);
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
    const canManage = isCaptain || !!isAdminProp;
    const isCreating = squad.id.startsWith("temp-");

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
        enabled: (showInvite || showQuickAdd) && canManage && !!squad.clanTag,
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
                    {canManage && (
                        <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {hasPendingInvite && (
                        <span className="h-2.5 w-2.5 rounded-full bg-danger animate-pulse" />
                    )}
                    {pendingRequests.length > 0 && canManage && (
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
                    {canManage && !squad.isFull && squad.status === "FORMING" && pollIsActive && !isCreating && (
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
                                const showRemove = canManage && !isMemberCaptain && pollIsActive &&
                                    (member.status === "ACCEPTED" || (member.status === "PENDING" && member.initiatedBy === "CAPTAIN"));
                                const canToggleSub = squad.acceptedCount > GAME.squadSize;
                                return (
                                    <div key={member.inviteId} className={`flex items-center gap-3 ${member.isGhost ? 'opacity-70' : ''}`}>
                                        {member.isGhost ? (
                                            <div className="w-8 h-8 rounded-full border-2 border-dashed border-purple-400/50 bg-purple-500/10 flex items-center justify-center shrink-0">
                                                <span className="text-sm">👻</span>
                                            </div>
                                        ) : (
                                            <Avatar
                                                src={member.imageUrl}
                                                name={member.displayName}
                                                size="sm"
                                                className="w-8 h-8 shrink-0"
                                            />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className={`flex items-center gap-1.5 min-w-0 ${isMemberCaptain ? 'flex-wrap' : ''}`}>
                                                <span className={`text-sm font-medium ${isMemberCaptain ? 'break-all' : 'truncate'}`}>{member.displayName}</span>
                                                {member.hasRoyalPass && (
                                                    <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                )}
                                                <svg
                                                    className={`w-3.5 h-3.5 shrink-0 ${member.hasDiscord ? 'text-[#5865F2]' : 'text-foreground/20'}`}
                                                    viewBox="0 0 24 24"
                                                    fill="currentColor"
                                                    aria-label={member.hasDiscord ? "Discord linked" : "Discord not linked"}
                                                >
                                                    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
                                                </svg>
                                                {isMemberCaptain && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0 whitespace-nowrap">Leader</span>
                                                )}
                                                {member.isSub && member.status === "ACCEPTED" && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-500 dark:text-blue-400 shrink-0 whitespace-nowrap">SUB</span>
                                                )}
                                                {member.isGhost && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-500 dark:text-purple-400 shrink-0 whitespace-nowrap">Ghost</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {canManage && <StatusBadge status={member.status} initiatedBy={member.initiatedBy} />}
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


                        {/* Captain: Invite Players + Quick Add + Add Ghost */}
                        {canManage && !squad.isFull && squad.status === "FORMING" && pollIsActive && (
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
                                    endContent={<span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500 text-white leading-none">NEW</span>}
                                    isDisabled={isCreating}
                                    onPress={() => setShowGhostAdd(true)}
                                >
                                    Ghost
                                </Button>
                            </div>
                        )}

                        {/* Captain: Pending join requests */}
                        {canManage && pendingRequests.length > 0 && (
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




                        {/* Cancel squad / Creating indicator */}
                        {canManage && squad.status === "FORMING" && (
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
                                    <Button
                                        size="sm"
                                        variant="light"
                                        color={isCancelling ? "default" : "danger"}
                                        className={`w-full ${isCancelling ? "text-foreground/50" : ""}`}
                                        isLoading={isCancelling}
                                        isDisabled={isCancelling}
                                        onPress={() => onCancel(squad.id)}
                                        startContent={!isCancelling && <Trash2 className="w-3.5 h-3.5" />}
                                    >
                                        {isCancelling ? "Cancelling…" : "Cancel Squad"}
                                    </Button>
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
                    setGhostPhone("");
                    setGhostEmail("");
                    setGhostName("");
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
                            <span className="truncate block">Add Ghost Member</span>
                            <span className="text-xs font-normal text-foreground/50">{squad.fullName || squad.name}</span>
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        <p className="text-xs text-foreground/50 mb-3">
                            Add a teammate who doesn&apos;t have an account yet. Enter their name and phone or email.
                        </p>

                        {/* Ghost form */}
                        <div className="space-y-3">
                            <Input
                                label="Phone Number"
                                placeholder="10-digit phone number"
                                value={ghostPhone}
                                onValueChange={setGhostPhone}
                                size="lg"
                                startContent={<Phone className="w-4 h-4 text-default-400" />}
                                classNames={{ input: "text-base" }}
                                type="tel"
                                maxLength={10}
                            />
                            <Input
                                label="Email"
                                description="At least phone or email is required"
                                placeholder="teammate@email.com"
                                value={ghostEmail}
                                onValueChange={setGhostEmail}
                                size="lg"
                                type="email"
                                classNames={{ input: "text-base" }}
                            />
                            <Input
                                label="Player Name"
                                placeholder="Enter their in-game name"
                                value={ghostName}
                                onValueChange={setGhostName}
                                size="lg"
                                classNames={{ input: "text-base" }}
                                maxLength={20}
                            />
                            <Button
                                color="primary"
                                className="w-full font-semibold"
                                size="lg"
                                isLoading={ghostAdding}
                                isDisabled={!ghostName.trim() || (!ghostPhone && !ghostEmail)}
                                startContent={!ghostAdding && <Ghost className="w-4 h-4" />}
                                onPress={async () => {
                                    setGhostAdding(true);
                                    try {
                                        const res = await fetch(`/api/squads/${squad.id}/add-member`, {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({
                                                phone: ghostPhone || undefined,
                                                email: ghostEmail || undefined,
                                                name: ghostName.trim(),
                                            }),
                                        });
                                        const json = await res.json();
                                        if (!res.ok) {
                                            const { toast } = await import("sonner");
                                            toast.error(json.message || "Failed to add");
                                            return;
                                        }
                                        // If matched a real player, show confirmation
                                        if (json.data?.matched) {
                                            setGhostConfirm(json.data.player);
                                            return;
                                        }
                                        // Ghost added successfully
                                        const { toast } = await import("sonner");
                                        toast.success(json.message || "Ghost added!");
                                        setGhostPhone("");
                                        setGhostEmail("");
                                        setGhostName("");
                                        ghostQueryClient.invalidateQueries({ queryKey: ["squads"] });
                                    } catch {
                                        const { toast } = await import("sonner");
                                        toast.error("Failed to add member");
                                    } finally {
                                        setGhostAdding(false);
                                    }
                                }}
                            >
                                Add Ghost Member
                            </Button>
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
                                    <Avatar
                                        src={ghostConfirm.imageUrl}
                                        name={ghostConfirm.displayName}
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
                                                setGhostPhone("");
                                                setGhostEmail("");
                                                setGhostName("");
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

                        {/* Previous ghosts quick-add */}
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
                        <Avatar
                            src={player.imageUrl}
                            name={player.displayName}
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
                Previous Ghosts — tap to re-add
            </p>
            <div className="space-y-1">
                {previousGhosts.map((ghost) => {
                    const isAdded = addedIds.has(ghost.id);
                    const isAdding = addingId === ghost.id;
                    return (
                        <div key={ghost.id} className="flex items-center gap-3 py-2 px-1">
                            <div className="w-8 h-8 rounded-full border-2 border-dashed border-purple-400/50 bg-purple-500/10 flex items-center justify-center shrink-0">
                                <span className="text-sm">👻</span>
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
    const { isAdmin } = useAuthUser();
    const [showVoteWarning, setShowVoteWarning] = useState<{ action: "create" | "join"; squadId?: string } | null>(null);
    const [cancelConfirm, setCancelConfirm] = useState<{ squadId: string; isSameDay: boolean } | null>(null);
    const { data: squadsResult, isLoading, refetch } = useSquads(pollId);
    const squads = squadsResult?.squads;
    const maxSquads = squadsResult?.maxSquads ?? GAME.maxSquadTeams;
    const isMangoScrim = squadsResult?.isMangoScrim ?? false;
    // Mango Scrim: flat 20 cap, no waitlist. Regular: gap to championship threshold.
    const maxWaitlistSlots = isMangoScrim ? 0 : (maxSquads < 20 ? (20 - maxSquads) : 2);
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
                                                isAdmin={isAdmin}
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
                                                                    isAdmin={isAdmin}
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
                                                                        isAdmin={isAdmin}
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
                                                                isAdmin={isAdmin}
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
                captainInfo={inVoters.find(v => v.playerId === currentPlayerId) ? {
                    id: currentPlayerId,
                    displayName: inVoters.find(v => v.playerId === currentPlayerId)!.displayName,
                    imageUrl: inVoters.find(v => v.playerId === currentPlayerId)!.imageUrl,
                } : { id: currentPlayerId, displayName: "You", imageUrl: "" }}
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
