"use client";

import { useState, useCallback } from "react";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Input,
} from "@heroui/react";
import { Shield } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useCreateSquad } from "@/hooks/use-squads";
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

    const createMutation = useCreateSquad();

    const handleCreate = useCallback(async () => {
        if (!squadName.trim()) return;
        createMutation.mutate(
            { pollId, name: squadName.trim() },
            {
                onSuccess: () => {
                    setStep("done");
                },
            }
        );
    }, [pollId, squadName, createMutation]);

    const handleClose = useCallback(() => {
        setStep("name");
        setSquadName("");
        onClose();
    }, [onClose]);

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
                        <Shield className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <span className="truncate block">
                            {step === "name" ? "Create Squad" : "Squad Created! 🎉"}
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
                                        <span className="text-foreground/60"> per team • captain pays</span>
                                    </div>
                                </div>

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

                                <div className="text-xs text-foreground/50 space-y-1">
                                    <p>• You need <strong>{entryFee} {GAME.hasDualCurrency ? GAME.entryCurrency : GAME.currency}</strong> available — this covers the whole team</p>
                                    <p>• Your fee will be <strong>reserved</strong> (charged only when admin confirms teams)</p>
                                    <p>• Teammates join for free — no fee required for them</p>
                                    <p>• Players can request to join, or you can invite from View Teams</p>
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
                                    <Shield className="w-7 h-7 text-emerald-500" />
                                </div>
                                <div>
                                    <p className="font-semibold text-lg">Squad created!</p>
                                    <p className="text-sm text-foreground/60 mt-1">
                                        Players can now request to join your squad from the <strong>View Teams</strong> page.
                                    </p>
                                    <p className="text-sm text-foreground/60 mt-1">
                                        You&apos;ll get a notification when someone requests to join.
                                    </p>
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
                                isDisabled={!squadName.trim()}
                                isLoading={createMutation.isPending}
                                onPress={handleCreate}
                                startContent={!createMutation.isPending && <Shield className="w-4 h-4" />}
                            >
                                Create Squad
                            </Button>
                        </div>
                    ) : (
                        <Button
                            color="primary"
                            className="w-full font-semibold"
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
