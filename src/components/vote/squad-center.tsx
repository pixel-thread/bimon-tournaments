"use client";

import { useState } from "react";
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
} from "@heroui/react";
import { Shield, Plus, Users, Crown, Check, Clock, X, Trash2, UserPlus, LogIn, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
    useSquads,
    useCancelSquad,
    useRespondToInvite,
    useRequestJoin,
    useRespondToRequest,
    useRemoveMember,
    type SquadDTO,
} from "@/hooks/use-squads";
import { CreateSquadModal } from "./create-squad-modal";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";

/* ─── Types ─────────────────────────────────────────────────── */

interface SquadCenterProps {
    isOpen: boolean;
    onClose: () => void;
    pollId: string;
    tournamentName: string;
    entryFee: number;
    currentPlayerId: string;
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

/* ─── Squad Card ────────────────────────────────────────────── */

function SquadCard({
    squad,
    currentPlayerId,
    pollIsActive,
    onCancel,
    onAccept,
    onDecline,
    onRequestJoin,
    onAcceptRequest,
    onDeclineRequest,
    onRemoveMember,
    isCancelling,
    isResponding,
    isRequesting,
    isRespondingRequest,
    isRemoving,
    defaultExpanded,
}: {
    squad: SquadDTO;
    currentPlayerId: string;
    pollIsActive: boolean;
    onCancel: (id: string) => void;
    onAccept: (inviteId: string) => void;
    onDecline: (inviteId: string) => void;
    onRequestJoin: (squadId: string) => void;
    onAcceptRequest: (inviteId: string) => void;
    onDeclineRequest: (inviteId: string) => void;
    onRemoveMember: (inviteId: string) => void;
    isCancelling: boolean;
    isResponding: boolean;
    isRequesting: boolean;
    isRespondingRequest: boolean;
    isRemoving: boolean;
    defaultExpanded?: boolean;
}) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? false);
    const isCaptain = squad.captain.id === currentPlayerId;
    const myInvite = squad.myInvite;
    const hasPendingInvite = myInvite?.status === "PENDING" && myInvite?.initiatedBy === "CAPTAIN";
    const emptySlots = squad.totalSlots - squad.members.length;

    // Can player request to join?
    const isInThisSquad = isCaptain || myInvite?.status === "ACCEPTED" || myInvite?.status === "PENDING";
    const canRequestJoin = !isInThisSquad && !squad.isFull && squad.status === "FORMING" && pollIsActive;

    // Pending join requests (player-initiated, for captain view)
    const pendingRequests = squad.members.filter(
        (m) => m.status === "PENDING" && m.initiatedBy === "PLAYER"
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-divider bg-default-50 dark:bg-default-100/50 overflow-hidden"
        >
            {/* Header — always visible, tap to expand */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-default-100/50 transition-colors"
            >
                <div className="flex items-center gap-2 min-w-0">
                    <Shield className="w-4 h-4 text-primary shrink-0" />
                    <h4 className="font-semibold text-sm truncate">{squad.name}</h4>
                    {isCaptain && (
                        <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {pendingRequests.length > 0 && isCaptain && (
                        <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-bold text-blue-500">
                            {pendingRequests.length} req
                        </span>
                    )}
                    {squad.isFull ? (
                        <Chip size="sm" variant="flat" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            Full ✅
                        </Chip>
                    ) : (
                        <Chip size="sm" variant="flat" className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            {squad.acceptedCount}/{squad.totalSlots}
                        </Chip>
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
                                const showRemove = isCaptain && !isMemberCaptain && member.status === "ACCEPTED" && pollIsActive;
                                return (
                                    <div key={member.inviteId} className="flex items-center gap-3">
                                        <Avatar
                                            src={member.imageUrl}
                                            name={member.displayName}
                                            size="sm"
                                            className="w-8 h-8 shrink-0"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-sm font-medium truncate">{member.displayName}</span>
                                                {isMemberCaptain && (
                                                    <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <StatusBadge status={member.status} initiatedBy={member.initiatedBy} />
                                            {showRemove && (
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
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Empty slots */}
                            {emptySlots > 0 && Array.from({ length: emptySlots }).map((_, i) => (
                                <div key={`empty-${i}`} className="flex items-center gap-3 opacity-40">
                                    <div className="w-8 h-8 rounded-full border-2 border-dashed border-foreground/20 flex items-center justify-center">
                                        <Plus className="w-3 h-3" />
                                    </div>
                                    <span className="text-sm text-foreground/40">Open slot</span>
                                </div>
                            ))}
                        </div>

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
                                                    isLoading={isRespondingRequest}
                                                    onPress={() => onAcceptRequest(req.inviteId)}
                                                    className="min-w-0 px-2 h-7"
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    color="danger"
                                                    variant="flat"
                                                    isLoading={isRespondingRequest}
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
                                        isLoading={isResponding}
                                        onPress={() => onAccept(myInvite.id)}
                                        startContent={!isResponding && <Check className="w-3.5 h-3.5" />}
                                    >
                                        Accept & Join
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="flat"
                                        color="danger"
                                        isLoading={isResponding}
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

                        {/* Request to Join */}
                        {canRequestJoin && (
                            <div className="px-4 py-3 border-t border-divider/50">
                                <Button
                                    size="sm"
                                    color="primary"
                                    variant="solid"
                                    className="w-full font-semibold"
                                    isLoading={isRequesting}
                                    onPress={() => onRequestJoin(squad.id)}
                                    startContent={!isRequesting && <UserPlus className="w-3.5 h-3.5" />}
                                >
                                    {myInvite?.status === "DECLINED" ? "Request Again" : "Request to Join"}
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
}: SquadCenterProps) {
    const [showCreate, setShowCreate] = useState(false);
    const { data: squads, isLoading, refetch } = useSquads(pollId);
    const cancelMutation = useCancelSquad();
    const respondMutation = useRespondToInvite();
    const requestJoinMutation = useRequestJoin();
    const respondRequestMutation = useRespondToRequest();
    const removeMemberMutation = useRemoveMember();

    const mySquad = squads?.find(
        (s) => s.isCaptain || s.myInvite?.status === "ACCEPTED" || s.myInvite?.status === "PENDING"
    );
    const otherSquads = squads?.filter((s) => s.id !== mySquad?.id) ?? [];
    const canCreateSquad = !mySquad;

    function handleCancel(squadId: string) {
        cancelMutation.mutate(squadId);
    }

    function handleAccept(inviteId: string) {
        respondMutation.mutate({ inviteId, action: "ACCEPT" });
    }

    function handleDecline(inviteId: string) {
        respondMutation.mutate({ inviteId, action: "DECLINE" });
    }

    function handleRequestJoin(squadId: string) {
        requestJoinMutation.mutate(squadId);
    }

    function handleAcceptRequest(inviteId: string) {
        respondRequestMutation.mutate({ inviteId, action: "ACCEPT" });
    }

    function handleDeclineRequest(inviteId: string) {
        respondRequestMutation.mutate({ inviteId, action: "DECLINE" });
    }

    function handleRemoveMember(inviteId: string) {
        removeMemberMutation.mutate(inviteId);
    }

    // Check if the poll is active — we can infer from the first squad's data
    // or we pass it as prop. For now we'll consider squads are always viewable
    const pollIsActive = true; // Squads already filter by poll status in APIs

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                placement="center"
                size="md"
                scrollBehavior="inside"
                classNames={{ body: "px-4 py-3 max-h-[60vh] overflow-y-auto" }}
            >
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2 text-base pb-1">
                        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                            <Shield className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="truncate block">{tournamentName}</span>
                            <span className="text-xs font-normal text-foreground/50">Squad Center</span>
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
                                    {/* Your Squad */}
                                    {mySquad && (
                                        <div>
                                            <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-2">
                                                Your Squad
                                            </p>
                                            <SquadCard
                                                squad={mySquad}
                                                currentPlayerId={currentPlayerId}
                                                pollIsActive={pollIsActive}
                                                onCancel={handleCancel}
                                                onAccept={handleAccept}
                                                onDecline={handleDecline}
                                                onRequestJoin={handleRequestJoin}
                                                onAcceptRequest={handleAcceptRequest}
                                                onDeclineRequest={handleDeclineRequest}
                                                onRemoveMember={handleRemoveMember}
                                                isCancelling={cancelMutation.isPending}
                                                isResponding={respondMutation.isPending}
                                                isRequesting={requestJoinMutation.isPending}
                                                isRespondingRequest={respondRequestMutation.isPending}
                                                isRemoving={removeMemberMutation.isPending}
                                                defaultExpanded
                                            />
                                        </div>
                                    )}

                                    {/* Other Squads */}
                                    {otherSquads.length > 0 && (
                                        <div>
                                            <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-2">
                                                {mySquad ? "Other Squads" : "Squads"}
                                            </p>
                                            <div className="space-y-3">
                                                {otherSquads.map((squad) => (
                                                    <SquadCard
                                                        key={squad.id}
                                                        squad={squad}
                                                        currentPlayerId={currentPlayerId}
                                                        pollIsActive={pollIsActive}
                                                        onCancel={handleCancel}
                                                        onAccept={handleAccept}
                                                        onDecline={handleDecline}
                                                        onRequestJoin={handleRequestJoin}
                                                        onAcceptRequest={handleAcceptRequest}
                                                        onDeclineRequest={handleDeclineRequest}
                                                        onRemoveMember={handleRemoveMember}
                                                        isCancelling={cancelMutation.isPending}
                                                        isResponding={respondMutation.isPending}
                                                        isRequesting={requestJoinMutation.isPending}
                                                        isRespondingRequest={respondRequestMutation.isPending}
                                                        isRemoving={removeMemberMutation.isPending}
                                                    />
                                                ))}
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
                                                    Be the first to create a squad!
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        )}
                    </ModalBody>

                    <ModalFooter className="flex-col gap-2">
                        {canCreateSquad && (
                            <Button
                                color="primary"
                                className="w-full font-semibold"
                                startContent={<Plus className="w-4 h-4" />}
                                onPress={() => setShowCreate(true)}
                            >
                                + Create Team
                            </Button>
                        )}
                        <Button variant="flat" className="w-full" onPress={onClose}>
                            Close
                        </Button>
                    </ModalFooter>
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
            />
        </>
    );
}
