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
    Textarea,
    Tabs,
    Tab,
} from "@heroui/react";
import { ArrowUpRight, ArrowDownLeft, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthUser } from "@/hooks/use-auth-user";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";

// Transfers always use the entry currency (BP for MLBB, UC for BGMI, etc.)
const TRANSFER_CURRENCY = GAME.hasDualCurrency ? (GAME.entryCurrency ?? "BP") : GAME.currency;

interface UCTransferDialogProps {
    isOpen: boolean;
    onClose: () => void;
    toPlayerId: string;
    toPlayerName: string;
    sendOnly?: boolean;
}

export function UCTransferDialog({
    isOpen,
    onClose,
    toPlayerId,
    toPlayerName,
    sendOnly = false,
}: UCTransferDialogProps) {
    const [amount, setAmount] = useState("");
    const [message, setMessage] = useState("Synei lem ia kibi duk 😭");
    const [activeTab, setActiveTab] = useState<string>(sendOnly ? "send" : "request");
    const queryClient = useQueryClient();
    const { balance } = useAuthUser();

    const { mutate: createTransfer, isPending, error: transferError } = useMutation({
        mutationFn: async (data: {
            amount: number;
            type: string;
            toPlayerId: string;
            message?: string;
        }) => {
            const res = await fetch("/api/uc-transfers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error || "Transfer failed");
            }
            return json;
        },
        onSuccess: (data) => {
            if (data.success) {
                toast.success(data.message || "Transfer complete!");
                queryClient.invalidateQueries({ queryKey: ["auth-user"] });
                queryClient.invalidateQueries({ queryKey: ["players"] });
                handleClose();
            }
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Transfer failed", { duration: 5000 });
        },
    });

    const handleClose = () => {
        setAmount("");
        setMessage("Synei lem ia kibi duk 😭");
        setActiveTab(sendOnly ? "send" : "request");
        onClose();
    };

    const handleSubmit = () => {
        const amountNum = parseInt(amount);
        if (!amountNum || amountNum <= 0) return;

        if (activeTab === "send" && amountNum > balance) return;

        createTransfer({
            amount: amountNum,
            type: activeTab === "send" ? "SEND" : "REQUEST",
            toPlayerId,
            message: message || undefined,
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} placement="center" size="md" scrollBehavior="outside">
            <ModalContent>
                <ModalHeader className="flex flex-col items-center gap-1 pb-0">
                    <span className="text-lg font-bold">{toPlayerName}</span>
                </ModalHeader>

                <ModalBody className="gap-4 px-5 pt-4">
                    {sendOnly ? (
                        <div className="flex items-center justify-center gap-1.5 py-1.5 text-sm font-medium text-success">
                            <ArrowUpRight className="h-3.5 w-3.5" />
                            <span>Send {TRANSFER_CURRENCY}</span>
                        </div>
                    ) : (
                    <Tabs
                        selectedKey={activeTab}
                        onSelectionChange={(key) => {
                            setActiveTab(key as string);
                            setMessage(key === "send" ? "Shim ai donation" : "Synei lem ia kibi duk 😭");
                        }}
                        fullWidth
                        size="sm"
                        color={activeTab === "send" ? "success" : "primary"}
                    >
                        <Tab
                            key="request"
                            title={
                                <div className="flex items-center gap-1.5">
                                    <ArrowDownLeft className="h-3.5 w-3.5" />
                                    <span>Request {TRANSFER_CURRENCY}</span>
                                </div>
                            }
                        />
                        <Tab
                            key="send"
                            title={
                                <div className="flex items-center gap-1.5">
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                    <span>Send {TRANSFER_CURRENCY}</span>
                                </div>
                            }
                        />
                    </Tabs>
                    )}

                    {activeTab === "send" && (
                        <p className="text-xs text-foreground/50">
                            Your Balance:{" "}
                            <span
                                className={`font-bold ${balance > 0 ? "text-success" : "text-danger"
                                    }`}
                            >
                                {balance} <CurrencyIcon size={12} />
                            </span>
                        </p>
                    )}

                    {activeTab === "request" && (
                        <p className="text-xs text-foreground/50">
                            The player will need to approve your request.
                        </p>
                    )}

                    <Input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        label="Amount"
                        placeholder="Enter amount"
                        value={amount}
                        onValueChange={(v) => setAmount(v.replace(/\D/g, ""))}
                        endContent={<span className="text-foreground/40 text-xs font-medium inline-flex items-center"><CurrencyIcon size={14} /></span>}
                        size="sm"
                        isInvalid={
                            activeTab === "send" &&
                            !!amount &&
                            parseInt(amount) > balance
                        }
                        errorMessage={
                            activeTab === "send" &&
                                parseInt(amount) > balance
                                ? "Insufficient balance"
                                : undefined
                        }
                    />

                    <div className="flex gap-1.5">
                        {[5, 10, 20, 50, 100].map((v) => {
                            const disabled = activeTab === "send" && v > balance;
                            return (
                                <button
                                    key={v}
                                    onClick={() => !disabled && setAmount(String(v))}
                                    disabled={disabled}
                                    className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${amount === String(v)
                                        ? activeTab === "send"
                                            ? "bg-success/15 text-success"
                                            : "bg-primary/15 text-primary"
                                        : disabled
                                            ? "text-foreground/15 cursor-not-allowed"
                                            : "text-foreground/40 hover:bg-default-100 hover:text-foreground/60"
                                        }`}
                                >
                                    {v}
                                </button>
                            );
                        })}
                    </div>

                    <Textarea
                        label="Message (optional)"
                        placeholder="Add a note..."
                        value={message}
                        onValueChange={setMessage}
                        size="sm"
                        minRows={1}
                        maxRows={2}
                    />
                </ModalBody>

                <ModalFooter>
                    <Button variant="flat" onPress={handleClose} isDisabled={isPending}>
                        Cancel
                    </Button>
                    <Button
                        color={activeTab === "send" ? "success" : "primary"}
                        onPress={handleSubmit}
                        isDisabled={isPending || !amount || parseInt(amount) <= 0}
                        isLoading={isPending}
                        startContent={
                            !isPending &&
                            (activeTab === "send" ? (
                                <ArrowUpRight className="h-4 w-4" />
                            ) : (
                                <ArrowDownLeft className="h-4 w-4" />
                            ))
                        }
                    >
                        {activeTab === "send" ? `Send ${TRANSFER_CURRENCY}` : `Request ${TRANSFER_CURRENCY}`}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
