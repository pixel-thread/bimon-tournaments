"use client";

import { useState } from "react";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Input,
    Spinner,
} from "@heroui/react";
import { ArrowRightLeft, Check, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GAME, GAME_MODE, GAME_CONFIGS, type GameMode } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";

// ─── Game options (exclude current game) ────────────────────

const GAME_OPTIONS: { mode: GameMode; name: string; gameName: string; icon: string; gradient: string; border: string }[] = ([
    { mode: "bgmi" as const, name: "PUBGMI", gameName: "BGMI", icon: "/icons/bgmi/icon-192x192.png", gradient: "from-amber-500/20 to-orange-500/20", border: "border-amber-500/30" },
    { mode: "pes" as const, name: "KICKOFF", gameName: "eFootball", icon: "/icons/pes/icon-192x192.png", gradient: "from-emerald-500/20 to-teal-500/20", border: "border-emerald-500/30" },
    { mode: "freefire" as const, name: "BOOYAH", gameName: "Free Fire", icon: "/icons/freefire/icon-192x192.png", gradient: "from-violet-500/20 to-purple-500/20", border: "border-violet-500/30" },
    { mode: "mlbb" as const, name: "Mobai Legend", gameName: "Mobile Legends", icon: "/icons/mlbb/icon-192x192.png", gradient: "from-rose-500/20 to-pink-500/20", border: "border-rose-500/30" },
]).filter((g) => g.mode !== GAME_MODE);

// ─── Component ──────────────────────────────────────────────

interface CrossGameTransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentBalance: number;
}

export function CrossGameTransferModal({
    isOpen,
    onClose,
    currentBalance,
}: CrossGameTransferModalProps) {
    const queryClient = useQueryClient();
    const [selectedGame, setSelectedGame] = useState<GameMode | null>(null);
    const [amount, setAmount] = useState("");
    const [step, setStep] = useState<"select" | "amount" | "confirm" | "done">("select");

    // ── Check target account ────────────────────────────────
    const { data: targetInfo, isLoading: isCheckingTarget } = useQuery({
        queryKey: ["cross-game-balance", selectedGame],
        queryFn: async () => {
            const res = await fetch(`/api/cross-game/balance?game=${selectedGame}`);
            if (!res.ok) throw new Error("Failed to check");
            const json = await res.json();
            return json.data as {
                exists: boolean;
                game: string;
                gameName: string;
                currency: string;
                balance?: number;
                displayName?: string;
            };
        },
        enabled: !!selectedGame,
        staleTime: 30_000,
    });

    // ── Transfer mutation ───────────────────────────────────
    const transfer = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/cross-game/transfer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: Number(amount), targetGame: selectedGame }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Transfer failed");
            return json;
        },
        onSuccess: (data) => {
            toast.success(data.message);
            queryClient.invalidateQueries({ queryKey: ["wallet"] });
            queryClient.invalidateQueries({ queryKey: ["profile"] });
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
            setStep("done");
        },
        onError: (err: Error) => {
            toast.error(err.message);
        },
    });

    const numAmount = Number(amount) || 0;

    // Exchange rate: source outgoing × target incoming
    const sourceOutRate = GAME.exchangeRateOut ?? 1;
    const targetInRate = selectedGame ? (GAME_CONFIGS[selectedGame]?.exchangeRateIn ?? 1) : 1;
    const combinedRate = sourceOutRate * targetInRate;
    const hasConversion = Math.abs(combinedRate - 1) > 0.001;
    const targetCurrencyLabel = selectedGame ? (GAME_CONFIGS[selectedGame]?.entryCurrency || GAME_CONFIGS[selectedGame]?.currency || "UC") : GAME.currency;
    const sourceCurrencyLabel = GAME.entryCurrency || GAME.currency;

    // Find minimum step for clean conversion (no rounding)
    let transferStep = 1;
    if (hasConversion) {
        for (let n = 1; n <= 100; n++) {
            const result = n * combinedRate;
            if (Math.abs(result - Math.round(result)) < 0.0001) {
                transferStep = n;
                break;
            }
        }
    }

    const creditAmount = Math.round(numAmount * combinedRate);
    const isValidAmount = numAmount > 0 && numAmount <= currentBalance && Number.isInteger(numAmount) && (!hasConversion || numAmount % transferStep === 0);

    const handleClose = () => {
        setSelectedGame(null);
        setAmount("");
        setStep("select");
        onClose();
    };

    const selectedGameOption = GAME_OPTIONS.find((g) => g.mode === selectedGame);

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            size="sm"
            placement="center"
            classNames={{
                base: "bg-background border border-divider",
                backdrop: "bg-black/60 backdrop-blur-sm",
            }}
        >
            <ModalContent>
                <ModalHeader className="flex items-center gap-2 pb-2">
                    <ArrowRightLeft className="h-4 w-4 text-primary" />
                    <span className="text-base font-bold">Transfer to Game</span>
                </ModalHeader>

                <ModalBody className="pb-2">
                    <AnimatePresence mode="wait">
                        {/* ── Step 1: Select Game ─────────────────── */}
                        {step === "select" && (
                            <motion.div
                                key="select"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-3"
                            >
                                <p className="text-xs text-foreground/50">
                                    Move {sourceCurrencyLabel} from your {GAME.gameName} wallet to another game
                                </p>

                                <div className="space-y-2">
                                    {GAME_OPTIONS.map((game) => (
                                        <button
                                            key={game.mode}
                                            onClick={() => {
                                                setSelectedGame(game.mode);
                                                setStep("amount");
                                            }}
                                            className={`
                                                w-full flex items-center gap-3 p-3 rounded-xl
                                                border ${game.border} bg-gradient-to-r ${game.gradient}
                                                transition-all duration-200
                                                hover:scale-[1.02] active:scale-[0.98]
                                            `}
                                        >
                                            <img
                                                src={game.icon}
                                                alt={game.name}
                                                className="h-10 w-10 rounded-xl"
                                            />
                                            <div className="text-left">
                                                <p className="text-sm font-semibold">{game.name}</p>
                                                <p className="text-[11px] text-foreground/50">{game.gameName}</p>
                                            </div>
                                            <ArrowRightLeft className="ml-auto h-4 w-4 text-foreground/30" />
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* ── Step 2: Enter Amount ────────────────── */}
                        {step === "amount" && (
                            <motion.div
                                key="amount"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-4"
                            >
                                {/* Target game info */}
                                {isCheckingTarget ? (
                                    <div className="flex items-center justify-center py-6">
                                        <Spinner size="sm" />
                                        <span className="ml-2 text-xs text-foreground/50">Checking account...</span>
                                    </div>
                                ) : targetInfo && !targetInfo.exists ? (
                                    <div className="flex flex-col items-center gap-2 py-4">
                                        <AlertCircle className="h-8 w-8 text-warning" />
                                        <p className="text-sm font-medium text-center">
                                            You don&apos;t have an account on {targetInfo.gameName}
                                        </p>
                                        <p className="text-xs text-foreground/50 text-center">
                                            Sign up on {targetInfo.gameName} with the same email first
                                        </p>
                                        <Button
                                            size="sm"
                                            variant="flat"
                                            onPress={() => { setSelectedGame(null); setStep("select"); }}
                                        >
                                            Back
                                        </Button>
                                    </div>
                                ) : targetInfo?.exists ? (
                                    <>
                                        {/* Game cards */}
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 rounded-xl border border-divider p-3">
                                                <p className="text-[10px] font-medium text-foreground/40 uppercase">From</p>
                                                <p className="text-sm font-bold">{GAME.gameName}</p>
                                                <p className="text-xs text-foreground/60 flex items-center gap-1">
                                                    {currentBalance.toLocaleString()} <CurrencyIcon size={10} />
                                                </p>
                                            </div>
                                            <ArrowRightLeft className="h-4 w-4 text-foreground/30 shrink-0" />
                                            <div className="flex-1 rounded-xl border border-divider p-3">
                                                <p className="text-[10px] font-medium text-foreground/40 uppercase">To</p>
                                                <p className="text-sm font-bold">{targetInfo.gameName}</p>
                                                <p className="text-xs text-foreground/60">
                                                    {(targetInfo.balance ?? 0).toLocaleString()} {targetInfo.currency}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Amount input */}
                                        <Input
                                            type="number"
                                            label="Amount"
                                            placeholder={hasConversion ? `Multiples of ${transferStep}` : "Enter amount"}
                                            value={amount}
                                            onValueChange={setAmount}
                                            min={transferStep}
                                            max={currentBalance}
                                            step={transferStep}
                                            endContent={
                                                <span className="text-xs text-foreground/40">{sourceCurrencyLabel}</span>
                                            }
                                            description={
                                                hasConversion
                                                    ? `Available: ${currentBalance.toLocaleString()} ${sourceCurrencyLabel} · Multiples of ${transferStep}`
                                                    : `Available: ${currentBalance.toLocaleString()} ${sourceCurrencyLabel}`
                                            }
                                        />

                                        {/* Exchange rate notice */}
                                        {hasConversion && numAmount > 0 && numAmount % transferStep === 0 && (
                                            <div className="rounded-lg bg-warning/5 border border-warning/15 px-3 py-2">
                                                <p className="text-[11px] text-warning font-medium">
                                                    {numAmount} {sourceCurrencyLabel} → {creditAmount} {targetCurrencyLabel}
                                                </p>
                                            </div>
                                        )}

                                        {/* Invalid step warning */}
                                        {hasConversion && numAmount > 0 && numAmount % transferStep !== 0 && (
                                            <div className="rounded-lg bg-danger/5 border border-danger/15 px-3 py-2">
                                                <p className="text-[11px] text-danger font-medium">
                                                    Must be a multiple of {transferStep}
                                                </p>
                                            </div>
                                        )}

                                        {/* Quick amount buttons */}
                                        <div className="flex gap-2">
                                            {(hasConversion
                                                ? [transferStep, transferStep * 5, transferStep * 10]
                                                : [10, 50, 100]
                                            ).filter(v => v <= currentBalance).map((v) => (
                                                <Button
                                                    key={v}
                                                    size="sm"
                                                    variant={numAmount === v ? "solid" : "flat"}
                                                    color={numAmount === v ? "primary" : "default"}
                                                    onPress={() => setAmount(String(v))}
                                                    className="flex-1"
                                                >
                                                    {v}
                                                </Button>
                                            ))}
                                            {currentBalance > 0 && (
                                                <Button
                                                    size="sm"
                                                    variant={numAmount === Math.floor(currentBalance / transferStep) * transferStep ? "solid" : "flat"}
                                                    color={numAmount === Math.floor(currentBalance / transferStep) * transferStep ? "primary" : "default"}
                                                    onPress={() => setAmount(String(Math.floor(currentBalance / transferStep) * transferStep))}
                                                    className="flex-1"
                                                >
                                                    Max
                                                </Button>
                                            )}
                                        </div>
                                    </>
                                ) : null}
                            </motion.div>
                        )}

                        {/* ── Step 3: Confirm ─────────────────────── */}
                        {step === "confirm" && selectedGameOption && (
                            <motion.div
                                key="confirm"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="space-y-4 py-2"
                            >
                                <div className="text-center space-y-2">
                                    <p className="text-foreground/50 text-xs">You are transferring</p>
                                    <p className="text-3xl font-bold flex items-center justify-center gap-2">
                                        {numAmount.toLocaleString()} <CurrencyIcon size={24} />
                                    </p>
                                    {hasConversion && (
                                        <p className="text-sm font-semibold text-warning">
                                            → {creditAmount.toLocaleString()} {targetCurrencyLabel}
                                        </p>
                                    )}
                                    <div className="flex items-center justify-center gap-2 text-sm text-foreground/60">
                                        <span className="font-medium">{GAME.gameName}</span>
                                        <ArrowRightLeft className="h-3 w-3" />
                                        <span className="font-medium">{targetInfo?.gameName}</span>
                                    </div>
                                </div>

                                <div className="rounded-xl bg-warning/10 border border-warning/20 p-3">
                                    <p className="text-[11px] text-warning font-medium">
                                        {hasConversion
                                            ? `This will deduct ${numAmount} ${sourceCurrencyLabel} from your ${GAME.gameName} wallet and add ${creditAmount} ${targetCurrencyLabel} to your ${targetInfo?.gameName} wallet.`
                                            : `This will deduct ${numAmount} ${sourceCurrencyLabel} from your ${GAME.gameName} wallet and add ${numAmount} ${targetCurrencyLabel} to your ${targetInfo?.gameName} wallet.`
                                        }
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {/* ── Step 4: Done ─────────────────────────── */}
                        {step === "done" && (
                            <motion.div
                                key="done"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center gap-3 py-6"
                            >
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/20">
                                    <Check className="h-7 w-7 text-success" />
                                </div>
                                <p className="text-base font-bold">Transfer Complete!</p>
                                <p className="text-xs text-foreground/50 text-center">
                                    {hasConversion
                                        ? `${numAmount} ${sourceCurrencyLabel} → ${creditAmount} ${targetCurrencyLabel} moved to your ${targetInfo?.gameName} account`
                                        : `${numAmount} ${sourceCurrencyLabel} has been moved to your ${targetInfo?.gameName} account`
                                    }
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </ModalBody>

                <ModalFooter className="pt-1">
                    {step === "select" && (
                        <Button variant="flat" size="sm" onPress={handleClose} className="w-full">
                            Cancel
                        </Button>
                    )}

                    {step === "amount" && targetInfo?.exists && (
                        <div className="flex w-full gap-2">
                            <Button
                                variant="flat"
                                size="sm"
                                onPress={() => { setSelectedGame(null); setAmount(""); setStep("select"); }}
                                className="flex-1"
                            >
                                Back
                            </Button>
                            <Button
                                color="primary"
                                size="sm"
                                isDisabled={!isValidAmount}
                                onPress={() => setStep("confirm")}
                                className="flex-1 font-semibold"
                            >
                                Continue
                            </Button>
                        </div>
                    )}

                    {step === "confirm" && (
                        <div className="flex w-full gap-2">
                            <Button
                                variant="flat"
                                size="sm"
                                onPress={() => setStep("amount")}
                                isDisabled={transfer.isPending}
                                className="flex-1"
                            >
                                Back
                            </Button>
                            <Button
                                color="primary"
                                size="sm"
                                isLoading={transfer.isPending}
                                onPress={() => transfer.mutate()}
                                className="flex-1 font-semibold"
                                startContent={!transfer.isPending && <ArrowRightLeft className="h-3.5 w-3.5" />}
                            >
                                {transfer.isPending ? "Transferring..." : "Transfer Now"}
                            </Button>
                        </div>
                    )}

                    {step === "done" && (
                        <Button color="primary" size="sm" onPress={handleClose} className="w-full font-semibold">
                            Done
                        </Button>
                    )}
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
