"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Input, Button, Spinner } from "@heroui/react";
import { Shield, Trophy, Users, Calendar, Clock, ChevronRight, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useCreateSquad } from "@/hooks/use-squads";
import { useAuthGate } from "@/components/common/auth-gate-provider";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";

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
    days: string;
    squadCount: number;
    maxSquads: number;
    teamSize: number;
    maxTeamSize: number;
    hasSquad: boolean;
    mySquadName: string | null;
}

/* ─── Main Page ─────────────────────────────────────────────── */

export default function JoinPage() {
    const { id: pollId } = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { requireAuth } = useAuthGate();

    const [teamName, setTeamName] = useState(searchParams.get("team") ?? "");
    const [step, setStep] = useState<"form" | "creating" | "done">("form");
    const createMutation = useCreateSquad();

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

    // If user already has a squad → redirect to vote page
    useEffect(() => {
        if (data?.hasSquad) {
            router.replace(`/vote?tab=ranked&poll=${pollId}`);
        }
    }, [data?.hasSquad, pollId, router]);

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
        const name = (nameOverride ?? teamName).trim();
        if (!name || !pollId) return;

        setStep("creating");
        createMutation.mutate(
            { pollId, name, useClan: false },
            {
                onSuccess: () => {
                    setStep("done");
                    // Redirect to vote page after brief success animation
                    setTimeout(() => {
                        router.push(`/vote?tab=ranked&poll=${pollId}`);
                    }, 1500);
                },
                onError: () => {
                    setStep("form");
                },
            }
        );
    }, [teamName, pollId, createMutation, router]);

    const handleSubmit = useCallback(() => {
        if (!teamName.trim()) return;
        requireAuth(() => handleCreate());
    }, [teamName, requireAuth, handleCreate]);

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
    const timeLabel = (() => {
        const [h, m] = (data.scheduledTime || "20:00").split(":").map(Number);
        const d = new Date(2000, 0, 1, h, m);
        return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    })();

    const isFull = data.squadCount >= data.maxSquads;
    const canSubmit = teamName.trim().length > 0 && !isFull && step === "form";

    return (
        <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
            <AnimatePresence mode="wait">
                {step === "done" ? (
                    <motion.div
                        key="done"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center gap-4 py-20 text-center"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.1 }}
                            className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center"
                        >
                            <CheckCircle2 className="w-10 h-10 text-success" />
                        </motion.div>
                        <h1 className="text-2xl font-bold">Team Created! 🎉</h1>
                        <p className="text-foreground/50">
                            Redirecting to tournament page...
                        </p>
                        <Spinner size="sm" className="mt-2" />
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
                                <Clock className="w-4 h-4 text-foreground/40" />
                                <div>
                                    <p className="text-[10px] text-foreground/40 uppercase">Match Time</p>
                                    <p className="text-sm font-bold">{timeLabel}</p>
                                </div>
                            </div>
                        </div>

                        {/* ── Teams count ── */}
                        <div className="flex items-center justify-between px-1">
                            <span className="text-sm text-foreground/50">
                                {data.squadCount}/{data.maxSquads} teams registered
                            </span>
                            {isFull && (
                                <span className="text-xs font-bold text-danger px-2 py-0.5 rounded-full bg-danger/10">
                                    FULL
                                </span>
                            )}
                        </div>

                        {/* ── Progress bar ── */}
                        <div className="h-2 rounded-full bg-default-100 overflow-hidden">
                            <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min((data.squadCount / data.maxSquads) * 100, 100)}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                            />
                        </div>

                        {/* ── Team Name Input ── */}
                        {!isFull && (
                            <div className="space-y-4">
                                <Input
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

                                {/* ── Info bullets ── */}
                                <div className="text-xs text-foreground/40 space-y-1 px-1">
                                    {data.entryFee > 0 && (
                                        <p>• Leader pays <strong>{data.entryFee} {GAME.hasDualCurrency ? GAME.entryCurrency : GAME.currency}</strong> — covers the whole team</p>
                                    )}
                                    <p>• Roster: up to <strong>{data.maxTeamSize}</strong> players ({data.teamSize} active + {data.maxTeamSize - data.teamSize} subs)</p>
                                    <p>• Teammates join for free — no fee required</p>
                                    <p>• Prize goes to leader when team wins 🏆</p>
                                </div>

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
    );
}
