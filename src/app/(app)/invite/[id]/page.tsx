"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button, Spinner, Avatar } from "@heroui/react";
import { Shield, Trophy, Users, Calendar, Clock, Check, X, Crown, LogIn } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";
import { useAuthUser } from "@/hooks/use-auth-user";

/* ─── Types ─────────────────────────────────────────────────── */

interface SquadPublicData {
    squadId: string;
    squadName: string;
    status: string;
    entryFee: number;
    pollId: string;
    pollIsActive: boolean;
    tournamentName: string;
    tournamentFee: number;
    expectedPrizePool: number | null;
    scheduledDate: string | null;
    scheduledTime: string;
    matchSchedule: Record<string, string[]> | null;
    days: string;
    captain: { id: string; displayName: string; imageUrl: string };
    clanLogo: string | null;
    clanTag: string | null;
    clanName: string | null;
    members: { playerId: string; displayName: string; imageUrl: string; isCaptain: boolean }[];
    acceptedCount: number;
    totalSlots: number;
    isFull: boolean;
    myStatus: "none" | "accepted" | "pending" | "declined";
    isSignedIn: boolean;
    hasPlayerProfile: boolean;
    whatsappGroupLink: string | null;
}

/* ─── Main Page ─────────────────────────────────────────────── */

export default function InvitePage() {
    const { id: squadId } = useParams<{ id: string }>();
    const router = useRouter();
    const { isSignedIn, isLoading: authLoading } = useAuthUser();
    const [joining, setJoining] = useState(false);
    const [joined, setJoined] = useState(false);
    const [conflictSquad, setConflictSquad] = useState<string | null>(null);

    // Fetch squad info
    const { data, isLoading, error } = useQuery<SquadPublicData>({
        queryKey: ["squad-invite", squadId],
        queryFn: async () => {
            const res = await fetch(`/api/squads/${squadId}/link-join`);
            if (!res.ok) throw new Error("Squad not found");
            const json = await res.json();
            return json.data;
        },
        enabled: !!squadId,
        staleTime: 15_000,
    });

    // If already accepted → redirect to vote page
    useEffect(() => {
        if (data?.myStatus === "accepted") {
            router.replace(`/vote`);
        }
    }, [data?.myStatus, router]);

    // Handle Accept for signed-in players with profile
    const handleAccept = useCallback(async (force = false) => {
        if (!squadId) return;

        // Not signed in → save intent and redirect to sign-in
        if (!isSignedIn) {
            localStorage.setItem("pending-squad-join", squadId);
            window.location.href = "/sign-in";
            return;
        }

        // Signed in but no player profile → save intent and redirect to onboarding
        if (data && !data.hasPlayerProfile) {
            localStorage.setItem("pending-squad-join", squadId);
            router.push("/onboarding");
            return;
        }

        // Signed in with profile → join directly
        setJoining(true);
        try {
            const res = await fetch(`/api/squads/${squadId}/link-join`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ force }),
            });
            const json = await res.json();

            // 409 = already in another squad — show inline confirmation
            if (res.status === 409 && json.error === "EXISTING_SQUAD") {
                setJoining(false);
                setConflictSquad(json.existingSquadName);
                return;
            }

            if (!res.ok) {
                const msg = json.message || "Failed to join";
                // If already in the squad, redirect to vote page
                if (msg.toLowerCase().includes("already")) {
                    toast.success("You're already in this team!");
                    router.push("/vote");
                    return;
                }
                toast.error(msg);
                setJoining(false);
                return;
            }
            toast.success(json.message || "Joined!");
            setJoined(true);
            setTimeout(() => router.push("/vote"), 1200);
        } catch {
            toast.error("Network error. Please try again.");
            setJoining(false);
        }
    }, [squadId, isSignedIn, data, router]);

    // Handle Decline
    const handleDecline = useCallback(() => {
        if (!isSignedIn) {
            // New player declining → send to sign-in → onboarding
            window.location.href = "/sign-in";
            return;
        }
        router.push("/vote");
    }, [isSignedIn, router]);

    // ── Loading ──
    if (isLoading || authLoading) {
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
                <h1 className="text-xl font-bold mb-2">Squad Not Found</h1>
                <p className="text-foreground/50 mb-6">
                    This invite link may be expired or invalid.
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

    // ── Squad full ──
    if (data.isFull) {
        return (
            <div className="mx-auto max-w-lg px-4 py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
                    <Users className="w-7 h-7 text-warning" />
                </div>
                <h1 className="text-xl font-bold mb-2">Squad is Full</h1>
                <p className="text-foreground/50 mb-6">
                    <strong>{data.squadName}</strong> already has all {data.totalSlots} members.
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

    // ── Poll closed ──
    if (!data.pollIsActive) {
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

    // ── Success state ──
    if (joined) {
        return (
            <div className="mx-auto max-w-lg px-4 py-20 text-center">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"
                >
                    <Check className="w-10 h-10 text-success" />
                </motion.div>
                <h1 className="text-2xl font-bold mb-2">You&apos;re In! 🎉</h1>
                <p className="text-foreground/50">
                    Joined <strong>{data.squadName}</strong> • Redirecting...
                </p>
                <Spinner size="sm" className="mt-4" />
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

    const emptySlots = data.totalSlots - data.acceptedCount;

    return (
        <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
            >
                {/* ── Header ── */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center backdrop-blur-sm">
                                <Shield className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
                                Squad Invite
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold leading-tight">
                            {data.squadName}
                        </h1>
                        <p className="text-sm text-white/60 mt-1">
                            {data.tournamentName}
                        </p>
                        {data.clanName && (
                            <div className="flex items-center gap-1.5 mt-2">
                                {data.clanLogo && (
                                    <img src={data.clanLogo} alt="" className="w-4 h-4 rounded-full object-cover" />
                                )}
                                <span className="text-xs text-white/50">
                                    {data.clanTag ? `[${data.clanTag}] ` : ""}{data.clanName}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Invited by ── */}
                <div className="flex items-center gap-3 rounded-xl border border-divider bg-default-50 p-3">
                    <Avatar
                        src={data.captain.imageUrl}
                        name={data.captain.displayName}
                        size="sm"
                        className="w-9 h-9 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-foreground/40 uppercase">Invited by</p>
                        <p className="text-sm font-semibold truncate">
                            {data.captain.displayName}
                        </p>
                    </div>
                </div>




                {/* ── Squad Members ── */}
                <div className="rounded-xl border border-divider bg-default-50 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-divider/50">
                        <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">
                            Squad Members ({data.acceptedCount}/{data.totalSlots})
                        </p>
                    </div>
                    <div className="px-4 py-3 space-y-2.5">
                        {data.members.map((member) => (
                            <div key={member.playerId} className="flex items-center gap-3">
                                <Avatar
                                    src={member.imageUrl}
                                    name={member.displayName}
                                    size="sm"
                                    className="w-8 h-8 shrink-0"
                                />
                                <span className="text-sm font-medium truncate flex-1">{member.displayName}</span>
                                {member.isCaptain && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">Leader</span>
                                )}
                            </div>
                        ))}
                        {/* Empty slots */}
                        {emptySlots > 0 && Array.from({ length: emptySlots }).map((_, i) => (
                            i === 0 && !joined && data.myStatus === "none" ? (
                                conflictSquad ? (
                                    <div key={`empty-${i}`} className="space-y-2">
                                        <p className="text-xs text-amber-600 dark:text-amber-400">
                                            ⚠️ You&apos;re in <strong>&quot;{conflictSquad}&quot;</strong>. Switch?
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-success bg-success/10 hover:bg-success/20 transition-colors"
                                                onClick={() => handleAccept(true)}
                                                disabled={joining}
                                            >
                                                <Check className="w-3.5 h-3.5" />
                                                {joining ? "Switching…" : "Leave & join"}
                                            </button>
                                            <button
                                                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                                                onClick={() => router.push("/vote")}
                                            >
                                                <X className="w-3.5 h-3.5" />
                                                Keep current
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div key={`empty-${i}`} className="flex items-center gap-2">
                                        <button
                                            className="flex-1 flex items-center gap-3 text-left rounded-lg py-1.5 px-1 transition-colors hover:bg-success/10 active:bg-success/20"
                                            onClick={() => handleAccept()}
                                            disabled={joining}
                                        >
                                            <div className="w-8 h-8 rounded-full border-2 border-dashed border-success/50 flex items-center justify-center shrink-0">
                                                <Check className="w-3.5 h-3.5 text-success" />
                                            </div>
                                            <span className="text-sm font-medium text-success">
                                                {joining ? "Joining…" : "Tap to join"}
                                            </span>
                                        </button>
                                        <button
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-danger bg-danger/10 hover:bg-danger/20 transition-colors shrink-0"
                                            onClick={handleDecline}
                                        >
                                            Decline
                                        </button>
                                    </div>
                                )
                            ) : i === 0 && (joined || data.myStatus === "accepted" || data.myStatus === "pending") ? (
                                <div key={`empty-${i}`} className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center shrink-0">
                                        <Check className="w-4 h-4 text-success" />
                                    </div>
                                    <span className="text-sm font-medium text-success">
                                        {data.myStatus === "pending" ? "Request pending" : "You're in! ✨"}
                                    </span>
                                </div>
                            ) : (
                                <div key={`empty-${i}`} className="flex items-center gap-3 opacity-40">
                                    <div className="w-8 h-8 rounded-full border-2 border-dashed border-foreground/20 flex items-center justify-center">
                                        <Users className="w-3 h-3" />
                                    </div>
                                    <span className="text-sm text-foreground/40">Open slot</span>
                                </div>
                            )
                        ))}
                    </div>
                </div>

                {/* ── Action Buttons (second touchpoint) ── */}
                {joined || data.myStatus === "accepted" || data.myStatus === "pending" ? (
                    <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-success/10 border border-success/20">
                        <Check className="w-5 h-5 text-success" />
                        <span className="text-sm font-semibold text-success">
                            {data.myStatus === "pending" ? "Your request is pending approval" : "You've joined this squad!"}
                        </span>
                    </div>
                ) : (
                    <div className="flex gap-3">
                        <Button
                            color="success"
                            size="lg"
                            className="flex-1 font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 shadow-lg shadow-emerald-500/20"
                            isLoading={joining}
                            startContent={!joining ? <Check className="w-5 h-5" /> : undefined}
                            onPress={() => handleAccept()}
                        >
                            {!isSignedIn ? "Sign In & Join" : joining ? "Joining..." : "Join Squad"}
                        </Button>
                        <Button
                            variant="flat"
                            size="lg"
                            className="font-medium"
                            startContent={<X className="w-4 h-4" />}
                            onPress={handleDecline}
                        >
                            Decline
                        </Button>
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
                                {data.entryFee > 0 ? `${data.entryFee} ${GAME.currency}` : "Free"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-divider bg-default-50 p-3">
                        <Users className="w-4 h-4 text-foreground/40" />
                        <div>
                            <p className="text-[10px] text-foreground/40 uppercase">Team Size</p>
                            <p className="text-sm font-bold">{data.totalSlots} players</p>
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
                    <p>• Joining is <strong>free</strong> — the leader covers the entry fee</p>
                    <p>• Roster: up to <strong>{data.totalSlots}</strong> players</p>
                    <p>• Prize goes to leader when team wins 🏆</p>
                </div>


            </motion.div>
        </div>
    );
}
