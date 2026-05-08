"use client";

import { useState, useCallback, useEffect } from "react";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Input,
    Switch,
    Avatar,
    Spinner,
} from "@heroui/react";
import { Shield, Copy, Search, X } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { useCreateSquad, useSearchPlayers, useInvitePlayer } from "@/hooks/use-squads";
import { useQuery } from "@tanstack/react-query";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";

/* ─── Types ─────────────────────────────────────────────────── */

interface CreateSquadModalProps {
    isOpen: boolean;
    onClose: () => void;
    pollId: string;
    tournamentName: string;
    entryFee: number;
}

interface MyClan {
    id: string;
    name: string;
    tag: string;
    logoUrl: string | null;
}

/* ─── Main Component ────────────────────────────────────────── */

export function CreateSquadModal({
    isOpen,
    onClose,
    pollId,
    tournamentName,
    entryFee,
}: CreateSquadModalProps) {
    const [step, setStep] = useState<"name" | "done">("name");
    const [squadName, setSquadName] = useState("");
    const [createdSquadId, setCreatedSquadId] = useState<string | null>(null);
    const [createdSquadName, setCreatedSquadName] = useState<string>("");
    const [useClan, setUseClan] = useState(false);
    const [inviteSearch, setInviteSearch] = useState("");
    const [invitingPlayerId, setInvitingPlayerId] = useState<string | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);

    const createMutation = useCreateSquad();
    const inviteMutation = useInvitePlayer();
    const { data: searchResults, isLoading: isSearching } = useSearchPlayers(
        inviteSearch,
        pollId
    );

    // Fetch player's clan membership (lightweight)
    const { data: myClan } = useQuery<MyClan | null>({
        queryKey: ["my-clan"],
        queryFn: async () => {
            const res = await fetch("/api/clans/my");
            if (!res.ok) return null;
            const json = await res.json();
            return json.data ?? null;
        },
        enabled: isOpen,
        staleTime: 60_000,
    });

    // Auto-enable clan toggle when valid clan data loads
    const hasClan = !!myClan?.name;
    useEffect(() => {
        if (isOpen && hasClan) {
            setUseClan(true);
        }
    }, [isOpen, hasClan]);

    const handleCreate = useCallback(async () => {
        const effectiveUseClan = useClan && hasClan;
        if (!effectiveUseClan && !squadName.trim()) return;
        createMutation.mutate(
            { pollId, name: effectiveUseClan ? "" : squadName.trim(), useClan: effectiveUseClan },
            {
                onSuccess: (data) => {
                    setCreatedSquadId(data?.data?.id ?? null);
                    setCreatedSquadName(data?.data?.name ?? squadName.trim());
                    setStep("done");
                },
            }
        );
    }, [pollId, squadName, useClan, hasClan, createMutation]);

    const handleClose = useCallback(() => {
        setStep("name");
        setSquadName("");
        setCreatedSquadId(null);
        setCreatedSquadName("");
        setInviteSearch("");
        setInvitingPlayerId(null);
        setLinkCopied(false);
        setUseClan(hasClan); // Reset to clan default for next open
        onClose();
    }, [onClose, hasClan]);

    const handleCopyLink = useCallback(() => {
        if (!createdSquadId) return;
        const url = `${window.location.origin}/invite/${createdSquadId}`;
        navigator.clipboard.writeText(url);
        setLinkCopied(true);
        toast.success("📋 Link copied — share on WhatsApp!");
        setTimeout(() => setLinkCopied(false), 3000);
    }, [createdSquadId]);

    const canSubmit = (useClan && hasClan) || !!squadName.trim();

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            placement="center"
            size="md"
        >
            <ModalContent>
                <ModalHeader className="flex items-center gap-2 text-base pb-1">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                        {useClan && myClan?.logoUrl ? (
                            <img src={myClan.logoUrl} alt={myClan.tag} className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                            <Shield className="w-3.5 h-3.5 text-white" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <span className="truncate block">
                            {step === "name" ? "Create Team" : `${createdSquadName} Created! 🎉`}
                        </span>
                        <span className="text-xs font-normal text-foreground/50">{tournamentName}</span>
                    </div>
                </ModalHeader>

                <ModalBody className="px-4 py-3">
                    <AnimatePresence mode="wait">
                        {step === "name" && (
                            <motion.div
                                key="name-step"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="space-y-4"
                            >
                                {/* Entry Fee Info */}
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                                    <CurrencyIcon size={16} />
                                    <div className="text-sm">
                                        <span className="font-medium">{entryFee} {GAME.hasDualCurrency ? GAME.entryCurrency : GAME.currency}</span>
                                        <span className="text-foreground/60"> per team • {GAME.maxSquadSize} players ({GAME.maxSquadSize - GAME.squadSize} subs)</span>
                                    </div>
                                </div>

                                {/* Clan Toggle — only show when user has a valid clan */}
                                {hasClan && myClan && (
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-default-50 border border-divider">
                                        {myClan.logoUrl && (
                                            <img
                                                src={myClan.logoUrl}
                                                alt={myClan.tag}
                                                className="w-8 h-8 rounded-full object-cover shrink-0"
                                            />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">[{myClan.tag}] {myClan.name}</p>
                                            <p className="text-xs text-foreground/50">Use clan identity & logo</p>
                                        </div>
                                        <Switch
                                            size="sm"
                                            isSelected={useClan}
                                            onValueChange={setUseClan}
                                        />
                                    </div>
                                )}

                                {/* Squad Name Input — show when NOT using clan identity */}
                                {(!useClan || !hasClan) && (
                                    <Input
                                        label="Squad Name"
                                        placeholder="e.g. Team Alpha"
                                        value={squadName}
                                        onValueChange={setSquadName}
                                        maxLength={30}
                                        autoFocus
                                        description={`${squadName.length}/30 characters`}
                                        classNames={{ input: "text-base" }}
                                    />
                                )}

                                {useClan && hasClan && myClan && (
                                    <div className="p-3 rounded-lg bg-success-50/50 border border-success-100 text-sm text-success-700 dark:text-success-400 dark:bg-success-900/20 dark:border-success-800">
                                        Team will be named <strong>&ldquo;{myClan.name}&rdquo;</strong> with your clan logo.
                                        {/* Auto-increments if multiple clan squads exist */}
                                    </div>
                                )}

                                <div className="text-xs text-foreground/50 space-y-1">
                                    <p>• Leader pays <strong>{entryFee} {GAME.hasDualCurrency ? GAME.entryCurrency : GAME.currency}</strong> — covers the whole team</p>
                                    <p>• Roster: up to <strong>{GAME.maxSquadSize}</strong> players ({GAME.squadSize} active + {GAME.maxSquadSize - GAME.squadSize} subs)</p>
                                    <p>• Teammates join for free — no fee required</p>
                                    <p>• Prize goes to leader when team wins 🏆</p>
                                </div>
                            </motion.div>
                        )}

                        {step === "done" && (
                            <motion.div
                                key="done-step"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="space-y-4"
                            >
                                {/* Copy link row — compact */}
                                {createdSquadId && (
                                    <button
                                        type="button"
                                        onClick={handleCopyLink}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors cursor-pointer"
                                    >
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                                                {linkCopied ? "Copied! ✅" : "Copy Invite Link"}
                                            </p>
                                            <p className="text-[11px] text-emerald-600/60 dark:text-emerald-400/60">
                                                Share with your teammates on WhatsApp
                                            </p>
                                        </div>
                                        <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                            <Copy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                    </button>
                                )}

                                {/* Search & Invite players */}
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">
                                        Or invite existing players
                                    </p>
                                    <Input
                                        placeholder="Search player..."
                                        value={inviteSearch}
                                        onValueChange={setInviteSearch}
                                        size="sm"
                                        startContent={<Search className="w-3.5 h-3.5 text-default-400" />}
                                        endContent={inviteSearch ? (
                                            <button type="button" onClick={() => setInviteSearch("")} className="p-0.5">
                                                <X className="w-3 h-3 text-default-400" />
                                            </button>
                                        ) : undefined}
                                    />
                                    {isSearching && (
                                        <div className="flex justify-center py-2">
                                            <Spinner size="sm" />
                                        </div>
                                    )}
                                    {searchResults && searchResults.length > 0 && (
                                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                            {searchResults.map((player) => (
                                                <div key={player.id} className="flex items-center gap-2 py-1.5">
                                                    <Avatar
                                                        src={player.imageUrl}
                                                        name={player.displayName}
                                                        size="sm"
                                                        className="w-7 h-7 shrink-0"
                                                    />
                                                    <span className="text-sm font-medium truncate flex-1">
                                                        {player.displayName}
                                                    </span>
                                                    <Button
                                                        size="sm"
                                                        color="primary"
                                                        variant="flat"
                                                        className="min-w-0 px-3 h-7"
                                                        isLoading={inviteMutation.isPending && invitingPlayerId === player.id}
                                                        isDisabled={inviteMutation.isPending && invitingPlayerId !== player.id}
                                                        onPress={() => {
                                                            if (!createdSquadId) return;
                                                            setInvitingPlayerId(player.id);
                                                            inviteMutation.mutate({ squadId: createdSquadId, playerId: player.id });
                                                        }}
                                                    >
                                                        Invite
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {searchResults && searchResults.length === 0 && inviteSearch.length >= 2 && (
                                        <p className="text-xs text-foreground/40 text-center py-2">No players found</p>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </ModalBody>

                <ModalFooter>
                    {step === "name" ? (
                        <div className="flex gap-2 w-full">
                            <Button variant="flat" className="flex-1" onPress={handleClose}>
                                Cancel
                            </Button>
                            <Button
                                color="primary"
                                className="flex-1 font-semibold"
                                isDisabled={!canSubmit}
                                isLoading={createMutation.isPending}
                                onPress={handleCreate}
                                startContent={!createMutation.isPending && <Shield className="w-4 h-4" />}
                            >
                                Create Team
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="flat"
                            className="w-full font-medium"
                            onPress={handleClose}
                        >
                            Done
                        </Button>
                    )}
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

