"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Input, Button, Spinner, Switch, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/react";
import { Shield, Trophy, Users, Calendar, Clock, ChevronRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useCreateSquad } from "@/hooks/use-squads";
import { useAuthGate } from "@/components/common/auth-gate-provider";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";
import { TeamDoneSection } from "@/components/squads/team-done-section";
import { toast } from "sonner";

/* ─── Types ─────────────────────────────────────────────────── */

interface PollPublicData {
    id: string;
    tournamentName: string;
    seasonName: string | null;
    entryFee: number;
    expectedPrizePool: number | null;
    isActive: boolean;
    allowSquads: boolean;
    isChampionship: boolean;
    isTDM: boolean;
    isWoW: boolean;
    scheduledDate: string | null;
    scheduledTime: string;
    matchSchedule: Record<string, string[]> | null;
    days: string;
    squadCount: number;
    maxSquads: number;
    teamSize: number;
    maxTeamSize: number;
    hasSquad: boolean;
    mySquadName: string | null;
    hasVotedIn: boolean;
    whatsappGroupLink: string | null;
}

interface MyClan {
    id: string;
    name: string;
    tag: string;
    logoUrl: string | null;
}

/* ─── Main Page ─────────────────────────────────────────────── */

export default function JoinPage() {
    const { id: pollId } = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { requireAuth } = useAuthGate();

    const [teamName, setTeamName] = useState(searchParams.get("team") ?? "");
    const [step, setStep] = useState<"form" | "creating" | "done">("form");
    const [createdSquadId, setCreatedSquadId] = useState<string | null>(null);
    const [useClan, setUseClan] = useState(false);
    const [whatsappJoined, setWhatsappJoined] = useState(false);
    const [showVoteWarning, setShowVoteWarning] = useState(false);
    const createMutation = useCreateSquad();
    const inputRef = useRef<HTMLInputElement>(null);

    // Fetch tournament info
    const { data, isLoading, error } = useQuery<PollPublicData>({
        queryKey: ["poll-public", pollId],
        queryFn: async () => {
            const res = await fetch(`/api/polls/${pollId}/public`);
            if (!res.ok) throw new Error("Tournament not found");
            const json = await res.json();
            return json.data;
        },
        enabled: !!pollId,
        staleTime: 30_000,
    });

    // Fetch player's clan membership
    const { data: myClan } = useQuery<MyClan | null>({
        queryKey: ["my-clan"],
        queryFn: async () => {
            const res = await fetch("/api/clans/my");
            if (!res.ok) return null;
            const json = await res.json();
            return json.data ?? null;
        },
        staleTime: 60_000,
    });

    const hasClan = !!myClan?.name;

    // Auto-enable clan toggle when valid clan data loads, but only if user hasn't started typing
    useEffect(() => {
        if (hasClan && !teamName.trim()) {
            setUseClan(true);
        }
    }, [hasClan]);

    // Prevent navigation if team was created but WhatsApp not joined
    useEffect(() => {
        if (step === "done" && data?.whatsappGroupLink && !whatsappJoined) {
            const handler = (e: BeforeUnloadEvent) => {
                e.preventDefault();
            };
            window.addEventListener("beforeunload", handler);
            return () => window.removeEventListener("beforeunload", handler);
        }
    }, [step, data?.whatsappGroupLink, whatsappJoined]);

    // If user already has a squad → redirect to vote page
    useEffect(() => {
        if (data?.hasSquad) {
            toast.info(`You're already in ${data.mySquadName ?? "a team"} — redirecting...`);
            router.replace(`/vote?tab=ranked&poll=${pollId}`);
        }
    }, [data?.hasSquad, data?.mySquadName, pollId, router]);

    // Auto-focus team name input once data loads (only when not using clan)
    useEffect(() => {
        if (data && !data.hasSquad && data.isActive && data.allowSquads && !useClan) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 400); // wait for entrance animation
            return () => clearTimeout(timer);
        }
    }, [data, useClan]);

    // Auto-create team if returning from sign-in with ?team= param
    useEffect(() => {
        const teamFromUrl = searchParams.get("team");
        if (teamFromUrl && data && !data.hasSquad && data.isActive && step === "form") {
            // Check if user is signed in by attempting creation
            setTeamName(teamFromUrl);
            handleCreate(teamFromUrl);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, searchParams]);

    const handleCreate = useCallback((nameOverride?: string) => {
        const effectiveUseClan = useClan && hasClan;
        const name = effectiveUseClan ? "" : (nameOverride ?? teamName).trim();
        if (!effectiveUseClan && !name) return;
        if (!pollId) return;

        setStep("creating");
        createMutation.mutate(
            { pollId, name, useClan: effectiveUseClan },
            {
                onSuccess: (result) => {
                    setCreatedSquadId(result?.data?.id ?? null);
                    setStep("done");
                },
                onError: () => {
                    setStep("form");
                },
            }
        );
    }, [teamName, pollId, useClan, hasClan, createMutation]);

    const handleSubmit = useCallback(() => {
        const effectiveUseClan = useClan && hasClan;
        if (!effectiveUseClan && !teamName.trim()) return;
        // If user has an existing individual vote, show warning first
        if (data?.hasVotedIn) {
            setShowVoteWarning(true);
            return;
        }
        requireAuth(() => handleCreate());
    }, [teamName, useClan, hasClan, requireAuth, handleCreate, data?.hasVotedIn]);

    const handleConfirmWithVote = useCallback(() => {
        setShowVoteWarning(false);
        requireAuth(() => handleCreate());
    }, [requireAuth, handleCreate]);

    // ── Loading ──
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Spinner size="lg" />
            </div>
        );
    }

    // ── Error ──
    if (error || !data) {
        return (
            <div className="mx-auto max-w-lg px-4 py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-7 h-7 text-danger" />
                </div>
                <h1 className="text-xl font-bold mb-2">Tournament Not Found</h1>
                <p className="text-foreground/50 mb-6">
                    This registration link may be expired or invalid.
                </p>
                <Button
                    color="primary"
                    variant="flat"
                    onPress={() => router.push("/vote")}
                >
                    Browse Tournaments
                </Button>
            </div>
        );
    }

    // ── Not active ──
    if (!data.isActive) {
        return (
            <div className="mx-auto max-w-lg px-4 py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-7 h-7 text-warning" />
                </div>
                <h1 className="text-xl font-bold mb-2">Registration Closed</h1>
                <p className="text-foreground/50 mb-6">
                    Registration for <strong>{data.tournamentName}</strong> is no longer open.
                </p>
                <Button
                    color="primary"
                    variant="flat"
                    onPress={() => router.push("/vote")}
                >
                    Browse Tournaments
                </Button>
            </div>
        );
    }

    // ── Squads not allowed ──
    if (!data.allowSquads) {
        return (
            <div className="mx-auto max-w-lg px-4 py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-default-100 flex items-center justify-center mx-auto mb-4">
                    <Users className="w-7 h-7 text-foreground/30" />
                </div>
                <h1 className="text-xl font-bold mb-2">Individual Tournament</h1>
                <p className="text-foreground/50 mb-6">
                    This tournament uses random teams. Vote on the tournament page to join!
                </p>
                <Button
                    color="primary"
                    onPress={() => router.push(`/vote?tab=casual&poll=${pollId}`)}
                >
                    Go to Vote Page
                </Button>
            </div>
        );
    }

    // Format schedule
    const scheduleLabel = (() => {
        if (data.scheduledDate) {
            return new Date(data.scheduledDate).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
            });
        }
        return data.days;
    })();
    const fmtTime = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        const d = new Date(2000, 0, 1, h, m);
        return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    };
    const timeLabel = fmtTime(data.scheduledTime || "20:00");
    const schedule = data.matchSchedule as Record<string, string[]> | null;
    const hasSchedule = schedule && Object.keys(schedule).length > 0;

    const isFull = data.squadCount >= data.maxSquads;
    const canSubmit = ((useClan && hasClan) || teamName.trim().length > 0) && !isFull && step === "form";

    return (
        <>
        <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
            <AnimatePresence mode="wait">
                {step === "done" ? (
                    <motion.div
                        key="done"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-5"
                    >
                        {/* Success header */}
                        <div className="flex flex-col items-center gap-3 pt-4 pb-2 text-center">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.1 }}
                                className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center"
                            >
                                <CheckCircle2 className="w-8 h-8 text-success" />
                            </motion.div>
                            <h1 className="text-xl font-bold">Team Created! 🎉</h1>
                            <p className="text-sm text-foreground/50">
                                Now invite your teammates to join
                            </p>
                        </div>

                        {/* Shared done section — WhatsApp gate + invite tools */}
                        <TeamDoneSection
                            whatsappGroupLink={data.whatsappGroupLink}
                            whatsappJoined={whatsappJoined}
                            onWhatsappJoin={() => setWhatsappJoined(true)}
                            createdSquadId={createdSquadId}
                            pollId={pollId}
                        />

                        {/* Go to tournament — only after WhatsApp gate is cleared */}
                        {(!data.whatsappGroupLink || whatsappJoined) && (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.25 }}
                            >
                                <Button
                                    color="primary"
                                    size="lg"
                                    className="w-full font-semibold text-white bg-gradient-to-r from-blue-600 to-violet-600 shadow-lg shadow-blue-500/20"
                                    onPress={() => router.push(`/vote?tab=ranked&poll=${pollId}`)}
                                    startContent={<ChevronRight className="w-4 h-4" />}
                                >
                                    Go to Tournament
                                </Button>
                            </motion.div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="form"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-5"
                    >
                        {/* ── Header ── */}
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-violet-600 to-purple-700 p-6 text-white">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center backdrop-blur-sm">
                                        <Shield className="w-4 h-4" />
                                    </div>
                                    <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
                                        Team Registration
                                    </span>
                                </div>
                                <h1 className="text-2xl font-bold leading-tight">
                                    {data.tournamentName}
                                </h1>
                                {data.seasonName && (
                                    <p className="text-sm text-white/60 mt-1">{data.seasonName}</p>
                                )}
                                {data.isChampionship && (
                                    <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 text-xs font-bold">
                                        🏆 Championship
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ── Team Name / Clan Toggle ── */}
                        {!isFull && (
                            <div className="space-y-3">
                                {/* Clan Toggle — reserve space while loading */}
                                {myClan === undefined ? (
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-default-50 border border-divider animate-pulse">
                                        <div className="w-8 h-8 rounded-full bg-default-200 shrink-0" />
                                        <div className="flex-1 space-y-1.5">
                                            <div className="h-3.5 w-24 rounded bg-default-200" />
                                            <div className="h-2.5 w-32 rounded bg-default-100" />
                                        </div>
                                        <div className="w-10 h-5 rounded-full bg-default-200" />
                                    </div>
                                ) : hasClan && myClan ? (
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-default-50 border border-divider">
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

                                {/* Team name input — show when NOT using clan (or no clan) AND clan data loaded */}
                                {myClan !== undefined && (!useClan || !hasClan) && (
                                    <Input
                                        ref={inputRef}
                                        label="Team Name"
                                        placeholder="e.g. Never Give Up"
                                        value={teamName}
                                        onValueChange={setTeamName}
                                        maxLength={30}
                                        size="lg"
                                        description={`${teamName.length}/30 characters`}
                                        classNames={{
                                            input: "text-base",
                                            inputWrapper: "shadow-sm",
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && canSubmit) handleSubmit();
                                        }}
                                    />
                                )}

                                {/* Clan confirmation hint */}
                                {useClan && hasClan && myClan && (
                                    <div className="p-3 rounded-xl bg-success-50/50 border border-success-100 text-sm text-success-700 dark:text-success-400 dark:bg-success-900/20 dark:border-success-800">
                                        Team will be named <strong>&ldquo;{myClan.name}&rdquo;</strong> with your clan logo.
                                    </div>
                                )}

                                {/* ── Submit Button ── */}
                                <Button
                                    color="primary"
                                    size="lg"
                                    className="w-full font-semibold text-white bg-gradient-to-r from-blue-600 to-violet-600 shadow-lg shadow-blue-500/20"
                                    isDisabled={!canSubmit}
                                    isLoading={step === "creating"}
                                    startContent={step !== "creating" ? <Shield className="w-4 h-4" /> : undefined}
                                    onPress={handleSubmit}
                                >
                                    {step === "creating" ? "Creating Team..." : "Register Team"}
                                </Button>
                            </div>
                        )}

                        {isFull && (
                            <div className="text-center py-3 rounded-xl bg-danger/5 border border-danger/20">
                                <span className="text-sm font-bold text-danger">Registration Full</span>
                            </div>
                        )}

                        {/* ── Info Cards ── */}
                        <div className="grid grid-cols-2 gap-3">
                            {data.expectedPrizePool != null && data.expectedPrizePool > 0 && (
                                <div className="col-span-2 flex items-center gap-3 rounded-xl border border-amber-200/30 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-800/30 p-4">
                                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                                        <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-foreground/50 uppercase tracking-wider font-medium">Prize Pool</p>
                                        <p className="text-xl font-black text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                            {data.expectedPrizePool} <CurrencyIcon size={16} />
                                        </p>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-3 rounded-xl border border-divider bg-default-50 p-3">
                                <CurrencyIcon size={18} />
                                <div>
                                    <p className="text-[10px] text-foreground/40 uppercase">Entry Fee</p>
                                    <p className="text-sm font-bold">
                                        {data.entryFee > 0 ? `${data.entryFee} ${GAME.hasDualCurrency ? GAME.entryCurrency : GAME.currency}` : "Free"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-xl border border-divider bg-default-50 p-3">
                                <Users className="w-4 h-4 text-foreground/40" />
                                <div>
                                    <p className="text-[10px] text-foreground/40 uppercase">Team Size</p>
                                    <p className="text-sm font-bold">
                                        {data.maxTeamSize} players
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-xl border border-divider bg-default-50 p-3">
                                <Calendar className="w-4 h-4 text-foreground/40" />
                                <div>
                                    <p className="text-[10px] text-foreground/40 uppercase">Schedule</p>
                                    <p className="text-sm font-bold">{scheduleLabel}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-xl border border-divider bg-default-50 p-3">
                                <Clock className="w-4 h-4 text-foreground/40 shrink-0" />
                                <div>
                                    <p className="text-[10px] text-foreground/40 uppercase">Match Times</p>
                                    {hasSchedule ? (
                                        <div className="space-y-0.5">
                                            {Object.entries(schedule).map(([day, times]) => (
                                                <p key={day} className="text-xs">
                                                    <span className="font-medium text-foreground/50">{day}:</span>{" "}
                                                    <span className="font-bold">{times.map(fmtTime).join(" · ")}</span>
                                                </p>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm font-bold">{timeLabel}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── Info bullets ── */}
                        <div className="text-xs text-foreground/40 space-y-1 px-1">
                            {data.entryFee > 0 && (
                                <p>• Leader pays <strong>{data.entryFee} {GAME.hasDualCurrency ? GAME.entryCurrency : GAME.currency}</strong> — covers the whole team</p>
                            )}
                            <p>• Roster: up to <strong>{data.maxTeamSize}</strong> players ({data.teamSize} active + {data.maxTeamSize - data.teamSize} subs)</p>
                            <p>• Teammates join for free — no fee required</p>
                            <p>• Prize goes to leader when team wins 🏆</p>
                        </div>

                        {/* ── Teams count + Progress ── */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-sm text-foreground/50">
                                    {data.squadCount}/{data.maxSquads} teams registered
                                </span>
                            </div>
                            <div className="h-2 rounded-full bg-default-100 overflow-hidden">
                                <motion.div
                                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min((data.squadCount / data.maxSquads) * 100, 100)}%` }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                />
                            </div>
                        </div>

                        {/* ── Browse link ── */}
                        <button
                            type="button"
                            onClick={() => router.push("/vote")}
                            className="flex items-center justify-center gap-1 w-full text-sm text-foreground/40 hover:text-foreground/60 transition-colors py-2 cursor-pointer"
                        >
                            View all tournaments
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

            {/* Vote conflict warning modal */}
            <Modal
                isOpen={showVoteWarning}
                onClose={() => setShowVoteWarning(false)}
                placement="center"
                size="sm"
                classNames={{
                    base: "bg-background border border-divider",
                    backdrop: "bg-black/60 backdrop-blur-sm",
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
                            Want to <strong>remove your solo entry</strong> and create a team instead? Your vote will be replaced by the squad entry.
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="flat"
                            size="sm"
                            onPress={() => setShowVoteWarning(false)}
                        >
                            Keep Solo Vote
                        </Button>
                        <Button
                            color="primary"
                            size="sm"
                            className="font-semibold"
                            onPress={handleConfirmWithVote}
                        >
                            Create Team Instead
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}
