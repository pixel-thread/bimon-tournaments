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
} from "@heroui/react";
import { Shield, Link2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { useCreateSquad } from "@/hooks/use-squads";
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
    const [useClan, setUseClan] = useState(false);

    const createMutation = useCreateSquad();

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
                    setStep("done");
                },
            }
        );
    }, [pollId, squadName, useClan, hasClan, createMutation]);

    const handleClose = useCallback(() => {
        setStep("name");
        setSquadName("");
        setCreatedSquadId(null);
        setUseClan(hasClan); // Reset to clan default for next open
        onClose();
    }, [onClose, hasClan]);

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
                            {step === "name" ? "Create Team" : "Team Created! 🎉"}
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
                                className="flex flex-col items-center gap-4 py-6 text-center"
                            >
                                <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                                    {useClan && myClan?.logoUrl ? (
                                        <img src={myClan.logoUrl} alt={myClan.tag} className="w-12 h-12 rounded-full object-cover" />
                                    ) : (
                                        <Shield className="w-7 h-7 text-emerald-500" />
                                    )}
                                </div>
                                <div>
                                    <p className="font-semibold text-lg">Team created!</p>
                                    <p className="text-sm text-foreground/60 mt-1">
                                        Share the invite link with your teammates on WhatsApp
                                    </p>
                                </div>
                                {createdSquadId && (
                                    <Button
                                        color="success"
                                        className="w-full font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600"
                                        startContent={<Link2 className="w-4 h-4" />}
                                        onPress={() => {
                                            const url = `${window.location.origin}/invite/${createdSquadId}`;
                                            navigator.clipboard.writeText(url);
                                            toast.success("📋 Link copied — share on WhatsApp!");
                                        }}
                                    >
                                        Copy Invite Link
                                    </Button>
                                )}
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
