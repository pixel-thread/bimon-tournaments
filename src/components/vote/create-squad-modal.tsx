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
import { Shield, AlertTriangle, X, Ghost, Users } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useCreateSquad, useRecentTeammates, useImportRoster, type PreviousRoster } from "@/hooks/use-squads";
import { useQuery } from "@tanstack/react-query";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";
import { containsProfanity } from "@/lib/profanity";

import { markWhatsAppPending, markWhatsAppJoined } from "@/components/common/whatsapp-squad-guard";
import { useDiscordCompareModal } from "@/components/common/discord-compare-modal";

/* ─── Types ─────────────────────────────────────────────────── */

interface CreateSquadModalProps {
    isOpen: boolean;
    onClose: () => void;
    pollId: string;
    tournamentName: string;
    entryFee: number;
    whatsappGroupLink?: string | null;
    /** Whether the current user already has an individual vote on this poll */
    hasVotedIn?: boolean;
    /** Ranked/squad tournament — uses Discord instead of WhatsApp */
    isRanked?: boolean;
    /** Captain info for optimistic UI */
    captainInfo?: { id: string; displayName: string; imageUrl: string } | null;
    /** Previous roster to import (Use Past Team mode) */
    importRoster?: PreviousRoster;
}

interface MyClan {
    id: string;
    name: string;
    tag: string;
    logoUrl: string | null;
    balance: number;
    role: "LEADER" | "CO_LEADER" | "MEMBER";
}

/* ─── Main Component ────────────────────────────────────────── */

export function CreateSquadModal({
    isOpen,
    onClose,
    pollId,
    tournamentName,
    entryFee,
    whatsappGroupLink,
    hasVotedIn,
    isRanked,
    captainInfo,
    importRoster,
}: CreateSquadModalProps) {
    const [step, setStep] = useState<"name">("name");
    const [squadName, setSquadName] = useState("");
    const [squadFullName, setSquadFullName] = useState("");
    const [createdSquadId, setCreatedSquadId] = useState<string | null>(null);
    const [createdSquadName, setCreatedSquadName] = useState<string>("");
    const [useClan, setUseClan] = useState(false);
    const [useClanTreasury, setUseClanTreasury] = useState(false);
    const [treasuryRequested, setTreasuryRequested] = useState(false);
    const [whatsappJoined, setWhatsappJoined] = useState(false);
    // Discord state (disabled — kept for future use)
    // const [discordLinked, setDiscordLinked] = useState(() => {
    //     if (typeof window !== "undefined") {
    //         return sessionStorage.getItem("discord_linked") === "true";
    //     }
    //     return false;
    // });

    // Discord link check (disabled — kept for future use)
    // useEffect(() => {
    //     if (!isOpen) return;
    //     fetch("/api/discord/link", { method: "GET" })
    //         .then((res) => res.json())
    //         .then((data) => {
    //             if (data.linked) {
    //                 setDiscordLinked(true);
    //                 sessionStorage.setItem("discord_linked", "true");
    //             } else {
    //                 setDiscordLinked(false);
    //                 sessionStorage.removeItem("discord_linked");
    //             }
    //         })
    //         .catch(() => {});
    // }, [isOpen]);

    const handleWhatsappJoin = useCallback(() => {
        setWhatsappJoined(true);
        markWhatsAppJoined(pollId);
    }, [pollId]);

    const createMutation = useCreateSquad();
    const importRosterMutation = useImportRoster();
    // const { openDiscordModal, DiscordCompareModal } = useDiscordCompareModal(); // Discord disabled

    // Import mode: track selected member IDs
    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());

    // Initialize selected members when importRoster changes
    useEffect(() => {
        if (importRoster && isOpen) {
            setSelectedMembers(new Set(
                importRoster.members.filter(m => m.available).map(m => m.playerId)
            ));
        }
    }, [importRoster, isOpen]);

    // Pre-fill team name from previous roster
    useEffect(() => {
        if (importRoster && isOpen) {
            setSquadName(importRoster.squadName);
            if (importRoster.fullName) setSquadFullName(importRoster.fullName);
        }
    }, [importRoster, isOpen]);

    // Pre-fetch subscribers (players with auto-accept ON for this captain)
    // Fetched as soon as modal opens so it's ready instantly after creation
    const { data: subscribers } = useRecentTeammates(pollId, isOpen);
    const hasSubscribers = (subscribers?.length ?? 0) > 0;

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

    // Auto-enable clan toggle when valid clan data loads, but only if user hasn't started typing
    const hasClan = !!myClan?.name;
    useEffect(() => {
        if (isOpen && hasClan && !squadName.trim()) {
            setUseClan(true);
        }
    }, [isOpen, hasClan]);

    const isLeaderOrCoLeader = myClan?.role === "LEADER" || myClan?.role === "CO_LEADER";

    const handleClose = useCallback(() => {
        setStep("name");
        setSquadName("");
        setSquadFullName("");
        setCreatedSquadId(null);
        setCreatedSquadName("");
        setWhatsappJoined(false);
        setUseClan(hasClan); // Reset to clan default for next open
        setUseClanTreasury(false);
        setTreasuryRequested(false);
        setSelectedMembers(new Set());
        onClose();
    }, [onClose, hasClan]);

    const handleCreate = useCallback(async () => {
        const effectiveUseClan = useClan && hasClan;
        if (!effectiveUseClan && !squadName.trim()) return;

        // Client-side profanity check
        const badWord = containsProfanity(squadName) || (squadFullName ? containsProfanity(squadFullName) : null);
        if (badWord) {
            const { toast } = await import("sonner");
            toast.error("Team name contains inappropriate language. Please choose another name.");
            return;
        }

        // Close modal immediately — optimistic update in onMutate shows the squad card instantly
        handleClose();

        const memberIdsToImport = importRoster ? Array.from(selectedMembers) : [];

        createMutation.mutate(
            {
                pollId,
                name: effectiveUseClan ? "" : squadName.trim(),
                useClan: effectiveUseClan,
                useClanTreasury: effectiveUseClan && useClanTreasury && isLeaderOrCoLeader,
                fullName: squadFullName.trim() || undefined,
                _captain: captainInfo ?? undefined,
                _clan: effectiveUseClan && myClan ? { tag: myClan.tag, name: myClan.name, logo: myClan.logoUrl } : null,
            },
            {
                onSuccess: async (data) => {
                    const name = data?.data?.name ?? squadName.trim();
                    const squadId = data?.data?.id;

                    const { toast } = await import("sonner");
                    toast.success(`Team "${name}" created! 🎉`);

                    // Import roster if in import mode
                    if (squadId && memberIdsToImport.length > 0) {
                        try {
                            const result = await importRosterMutation.mutateAsync({
                                squadId,
                                memberIds: memberIdsToImport,
                            });
                            const added = result?.data?.results?.filter((r: { status: string }) => r.status === "added").length ?? 0;
                            const invited = result?.data?.results?.filter((r: { status: string }) => r.status === "invited").length ?? 0;
                            if (added > 0 || invited > 0) {
                                const parts = [];
                                if (added > 0) parts.push(`${added} auto-added`);
                                if (invited > 0) parts.push(`${invited} invite${invited > 1 ? 's' : ''} sent`);
                                toast.success(`Past roster imported: ${parts.join(", ")}`);
                            }
                        } catch {
                            toast.error("Failed to import some teammates");
                        }
                    }

                    // Persist WhatsApp pending state for global guard
                    if (whatsappGroupLink) {
                        markWhatsAppPending({
                            pollId,
                            squadName: name,
                            tournamentName,
                            whatsappGroupLink,
                        });
                    }
                },
            }
        );
    }, [pollId, squadName, squadFullName, useClan, hasClan, createMutation, importRosterMutation, whatsappGroupLink, tournamentName, handleClose, hasSubscribers, captainInfo, myClan, isLeaderOrCoLeader, useClanTreasury, importRoster, selectedMembers]);

    const canSubmit = (useClan && hasClan) || !!squadName.trim();

    // Modal is always dismissable — leader can skip quick-add anytime
    const isModalBlocked = false;

    return (
        <>
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            placement="center"
            size="md"
            hideCloseButton={isModalBlocked}
            isDismissable={!isModalBlocked}
            isKeyboardDismissDisabled={isModalBlocked}
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
                            {step === "name"
                                ? (importRoster ? "Use Past Team" : "Create Team")
                                : "Quick Invite"}
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
                                        <span className="text-foreground/60"> per team • up to {GAME.maxSquadSize} players</span>
                                    </div>
                                </div>

                                {/* Clan Toggle — reserve space while loading to prevent layout shift */}
                                {myClan === undefined ? (
                                    /* Loading placeholder — same height as the clan row */
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-default-50 border border-divider animate-pulse">
                                        <div className="w-8 h-8 rounded-full bg-default-200 shrink-0" />
                                        <div className="flex-1 space-y-1.5">
                                            <div className="h-3.5 w-24 rounded bg-default-200" />
                                            <div className="h-2.5 w-32 rounded bg-default-100" />
                                        </div>
                                        <div className="w-10 h-5 rounded-full bg-default-200" />
                                    </div>
                                ) : hasClan && myClan ? (
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
                                            <p className="text-xs text-foreground/50">Use clan identity &amp; logo</p>
                                        </div>
                                        <Switch
                                            size="sm"
                                            isSelected={useClan}
                                            onValueChange={setUseClan}
                                        />
                                    </div>
                                ) : null}

                                {/* Team Tag — mandatory, shown first */}
                                {myClan !== undefined && (!useClan || !hasClan) && (
                                    <Input
                                        label="Team Tag"
                                        placeholder="e.g. ALPHA"
                                        value={squadName}
                                        onValueChange={(v) => setSquadName(v.slice(0, 7))}
                                        maxLength={7}
                                        isRequired
                                        autoFocus
                                        description={`${squadName.length}/7 characters • shown in standings`}
                                        classNames={{ input: "text-base" }}
                                    />
                                )}

                                {/* Full Team Name — optional, collapsed by default */}
                                {myClan !== undefined && (!useClan || !hasClan) && (
                                    squadFullName || step === "name" ? (
                                        <div className="space-y-1">
                                            {!squadFullName && (
                                                <button
                                                    type="button"
                                                    className="text-xs text-primary font-medium hover:underline cursor-pointer"
                                                    onClick={() => setSquadFullName(" ")}
                                                >
                                                    + Add full team name (optional)
                                                </button>
                                            )}
                                            {squadFullName && (
                                                <Input
                                                    label="Full Name (optional)"
                                                    placeholder="e.g. Alpha Warriors"
                                                    value={squadFullName.trim() ? squadFullName : ""}
                                                    onValueChange={(v) => {
                                                        const val = v.slice(0, 30);
                                                        setSquadFullName(val);
                                                    }}
                                                    maxLength={30}
                                                    autoFocus
                                                    description="Shown in slot views • leave blank to use tag only"
                                                    classNames={{ input: "text-base" }}
                                                    endContent={
                                                        <button
                                                            type="button"
                                                            className="p-0.5 rounded hover:bg-foreground/10 transition-colors cursor-pointer"
                                                            onClick={() => setSquadFullName("")}
                                                        >
                                                            <X className="w-3.5 h-3.5 text-foreground/40" />
                                                        </button>
                                                    }
                                                />
                                            )}
                                        </div>
                                    ) : null
                                )}

                                {useClan && hasClan && myClan && (
                                    <>
                                    <div className="p-3 rounded-lg bg-success-50/50 border border-success-100 text-sm text-success-700 dark:text-success-400 dark:bg-success-900/20 dark:border-success-800">
                                        Team will be named <strong>&ldquo;{myClan.name}&rdquo;</strong> with your clan logo.
                                        {/* Auto-increments if multiple clan squads exist */}
                                    </div>

                                    {/* Clan Treasury Toggle — Leaders/Co-Leaders get direct toggle, Members get request button */}
                                    {entryFee > 0 && (
                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium">Pay from clan treasury</p>
                                                <p className="text-xs text-foreground/50">
                                                    Treasury: <strong>{myClan.balance} {GAME.hasDualCurrency ? GAME.entryCurrency : GAME.currency}</strong>
                                                    {myClan.balance < entryFee && (
                                                        <span className="text-danger ml-1">(need {entryFee})</span>
                                                    )}
                                                </p>
                                            </div>
                                            {isLeaderOrCoLeader ? (
                                                <Switch
                                                    size="sm"
                                                    isSelected={useClanTreasury}
                                                    onValueChange={setUseClanTreasury}
                                                    isDisabled={myClan.balance < entryFee}
                                                />
                                            ) : treasuryRequested ? (
                                                <span className="text-xs text-success font-medium">Requested ✓</span>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="flat"
                                                    color="warning"
                                                    isDisabled={myClan.balance < entryFee}
                                                    onPress={async () => {
                                                        try {
                                                            const res = await fetch("/api/clans/treasury/use-request", {
                                                                method: "POST",
                                                                headers: { "Content-Type": "application/json" },
                                                                body: JSON.stringify({ pollId, amount: entryFee }),
                                                            });
                                                            if (res.ok) setTreasuryRequested(true);
                                                        } catch {}
                                                    }}
                                                >
                                                    Request
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                    </>
                                )}



                                {/* Import Roster Preview */}
                                {importRoster && importRoster.members.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Users className="w-3.5 h-3.5 text-foreground/50" />
                                            <span className="text-sm font-medium text-foreground/70">Past Roster</span>
                                            <span className="text-xs text-foreground/40">({selectedMembers.size} selected)</span>
                                        </div>
                                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                            {importRoster.members.map((m) => {
                                                const isSelected = selectedMembers.has(m.playerId);
                                                return (
                                                    <div
                                                        key={m.playerId}
                                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors ${
                                                            !m.available
                                                                ? 'bg-danger-50/50 border-danger-100 dark:bg-danger-900/10 dark:border-danger-800/40 opacity-60'
                                                                : isSelected
                                                                    ? 'bg-primary-50/50 border-primary-100 dark:bg-primary-900/10 dark:border-primary-800/40'
                                                                    : 'bg-default-50 border-divider opacity-50'
                                                        }`}
                                                    >
                                                        {m.imageUrl ? (
                                                            <img src={m.imageUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                                                        ) : (
                                                            <div className="w-7 h-7 rounded-full bg-default-200 flex items-center justify-center shrink-0">
                                                                {m.isGhost ? <Ghost className="w-3.5 h-3.5 text-foreground/30" /> : <Users className="w-3.5 h-3.5 text-foreground/30" />}
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">
                                                                {m.displayName}

                                                            </p>
                                                            {!m.available && m.existingTeamName && (
                                                                <p className="text-xs text-danger-500">Already in {m.existingTeamName}</p>
                                                            )}
                                                            {!m.available && m.isBanned && (
                                                                <p className="text-xs text-danger-500">Banned</p>
                                                            )}
                                                        </div>
                                                        {m.available && isSelected && (
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedMembers(prev => {
                                                                        const next = new Set(prev);
                                                                        next.delete(m.playerId);
                                                                        return next;
                                                                    });
                                                                }}
                                                                className="w-6 h-6 rounded-full bg-default-200 hover:bg-danger-100 flex items-center justify-center transition-colors shrink-0"
                                                            >
                                                                <X className="w-3 h-3 text-foreground/50" />
                                                            </button>
                                                        )}
                                                        {m.available && !isSelected && (
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedMembers(prev => {
                                                                        const next = new Set(prev);
                                                                        next.add(m.playerId);
                                                                        return next;
                                                                    });
                                                                }}
                                                                className="text-xs text-primary font-medium px-2 py-1 rounded-md hover:bg-primary-50 transition-colors"
                                                            >
                                                                Add
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {!importRoster && (
                                    <div className="text-xs text-foreground/50 space-y-1">
                                        <p>• {useClanTreasury ? 'Clan treasury' : 'Leader'} pays <strong>{entryFee} {GAME.hasDualCurrency ? GAME.entryCurrency : GAME.currency}</strong> — covers the whole team</p>
                                        <p>• Roster: up to <strong>{GAME.maxSquadSize}</strong> players</p>
                                        <p>• Teammates join for free — no fee required</p>
                                        <p>• {useClanTreasury ? 'Prize goes to clan treasury' : 'Prize goes to leader'} when team wins 🏆</p>
                                    </div>
                                )}
                            </motion.div>
                        )}


                    </AnimatePresence>
                </ModalBody>

                <ModalFooter>
                    {step === "name" && (
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
                                {importRoster ? `Create & Import (${selectedMembers.size})` : "Create Team"}
                            </Button>
                        </div>
                    )}

                </ModalFooter>
            </ModalContent>
        </Modal>
        {/* <DiscordCompareModal /> */}{/* Discord disabled */}
        </>
    );
}
