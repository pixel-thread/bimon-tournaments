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
import { Shield, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useCreateSquad } from "@/hooks/use-squads";
import { useQuery } from "@tanstack/react-query";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";
import { TeamDoneSection } from "@/components/squads/team-done-section";
import { markWhatsAppPending, markWhatsAppJoined } from "@/components/common/whatsapp-squad-guard";

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
}: CreateSquadModalProps) {
    const [step, setStep] = useState<"name" | "done">("name");
    const [squadName, setSquadName] = useState("");
    const [createdSquadId, setCreatedSquadId] = useState<string | null>(null);
    const [createdSquadName, setCreatedSquadName] = useState<string>("");
    const [useClan, setUseClan] = useState(false);
    const [useClanTreasury, setUseClanTreasury] = useState(false);
    const [treasuryRequested, setTreasuryRequested] = useState(false);
    const [whatsappJoined, setWhatsappJoined] = useState(false);
    const [discordLinked, setDiscordLinked] = useState(() => {
        // Instant check from cache — no network needed
        if (typeof window !== "undefined") {
            return sessionStorage.getItem("discord_linked") === "true";
        }
        return false;
    });

    // Verify with API in background (fast DB-only check)
    useEffect(() => {
        if (!isOpen) return;
        fetch("/api/discord/link", { method: "GET" })
            .then((res) => res.json())
            .then((data) => {
                if (data.linked) {
                    setDiscordLinked(true);
                    sessionStorage.setItem("discord_linked", "true");
                } else {
                    setDiscordLinked(false);
                    sessionStorage.removeItem("discord_linked");
                }
            })
            .catch(() => {});
    }, [isOpen]);

    const handleWhatsappJoin = useCallback(() => {
        setWhatsappJoined(true);
        markWhatsAppJoined(pollId);
    }, [pollId]);

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
        setCreatedSquadId(null);
        setCreatedSquadName("");
        setWhatsappJoined(false);
        setUseClan(hasClan); // Reset to clan default for next open
        setUseClanTreasury(false);
        setTreasuryRequested(false);
        onClose();
    }, [onClose, hasClan]);

    const handleCreate = useCallback(async () => {
        const effectiveUseClan = useClan && hasClan;
        if (!effectiveUseClan && !squadName.trim()) return;
        createMutation.mutate(
            {
                pollId,
                name: effectiveUseClan ? "" : squadName.trim(),
                useClan: effectiveUseClan,
                // Only send useClanTreasury if leader/co-leader toggled it directly
                useClanTreasury: effectiveUseClan && useClanTreasury && isLeaderOrCoLeader,
            },
            {
                onSuccess: (data) => {
                    const name = data?.data?.name ?? squadName.trim();
                    setCreatedSquadId(data?.data?.id ?? null);
                    setCreatedSquadName(name);

                    // Discord already linked → close immediately, no second modal
                    if (discordLinked) {
                        handleClose();
                        return;
                    }

                    setStep("done");
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
    }, [pollId, squadName, useClan, hasClan, createMutation, whatsappGroupLink, tournamentName, discordLinked, handleClose]);

    const canSubmit = ((useClan && hasClan) || !!squadName.trim()) && discordLinked;

    // On the done step, block dismiss until communication channel is joined
    const mustJoinWhatsapp = step === "done" && !!whatsappGroupLink && !whatsappJoined;
    const mustJoinDiscord = step === "done" && !discordLinked;
    const isModalBlocked = mustJoinWhatsapp || mustJoinDiscord;

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
                                ? "Create Team"
                                : mustJoinDiscord
                                    ? "Link Discord to Continue"
                                    : `${createdSquadName} Created! 🎉`}
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

                                {/* Squad Name Input — show when NOT using clan identity AND clan data loaded */}
                                {myClan !== undefined && (!useClan || !hasClan) && (
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

                                {/* Discord requirement */}
                                {!discordLinked && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/20">
                                            <svg className="w-5 h-5 text-[#5865F2] shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-[#5865F2]">Discord Required</p>
                                                <p className="text-[11px] text-foreground/40">Link Discord to receive room IDs &amp; match updates</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                window.location.href = `/api/discord/authorize?returnTo=&pollId=${encodeURIComponent(pollId)}`;
                                            }}
                                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all bg-[#5865F2] hover:bg-[#4752C4] text-white shadow-lg shadow-[#5865F2]/25 cursor-pointer active:scale-[0.98]"
                                        >
                                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
                                            Link with Discord
                                        </button>
                                    </div>
                                )}

                                <div className="text-xs text-foreground/50 space-y-1">
                                    <p>• {useClanTreasury ? 'Clan treasury' : 'Leader'} pays <strong>{entryFee} {GAME.hasDualCurrency ? GAME.entryCurrency : GAME.currency}</strong> — covers the whole team</p>
                                    <p>• Roster: up to <strong>{GAME.maxSquadSize}</strong> players ({GAME.squadSize} active + {GAME.maxSquadSize - GAME.squadSize} subs)</p>
                                    <p>• Teammates join for free — no fee required</p>
                                    <p>• {useClanTreasury ? 'Prize goes to clan treasury' : 'Prize goes to leader'} when team wins 🏆</p>
                                </div>
                            </motion.div>
                        )}

                        {step === "done" && (
                            <motion.div
                                key="done-step"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                            >
                                <TeamDoneSection
                                    whatsappGroupLink={whatsappGroupLink}
                                    whatsappJoined={whatsappJoined}
                                    onWhatsappJoin={handleWhatsappJoin}
                                    createdSquadId={createdSquadId}
                                    pollId={pollId}
                                    isRanked={isRanked}
                                    discordInviteLink={process.env.NEXT_PUBLIC_DISCORD_INVITE_LINK || null}
                                />
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
                    ) : !isModalBlocked ? (
                        <Button
                            variant="flat"
                            className="w-full font-medium"
                            onPress={handleClose}
                        >
                            Done
                        </Button>
                    ) : null}
                </ModalFooter>
            </ModalContent>
        </Modal>
        </>
    );
}
