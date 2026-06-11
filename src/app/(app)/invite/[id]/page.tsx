"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button, Spinner, Avatar, Checkbox } from "@heroui/react";
import { Shield, Users, Clock, Check, X } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useAuthUser } from "@/hooks/use-auth-user";
// import { useDiscordCompareModal } from "@/components/common/discord-compare-modal"; // Discord disabled

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
    // const { openDiscordModal, DiscordCompareModal } = useDiscordCompareModal(); // Discord disabled
    // Discord state (disabled — kept for future use)
    // const [discordLinked, setDiscordLinked] = useState(() => {
    //     if (typeof window !== "undefined") return sessionStorage.getItem("discord_linked") === "true";
    //     return false;
    // });
    const [autoAccept, setAutoAccept] = useState(false);

    // Discord link check (disabled — kept for future use)
    // useEffect(() => {
    //     if (!isSignedIn) return;
    //     fetch("/api/discord/link", { method: "GET" })
    //         .then((res) => res.json())
    //         .then((d) => {
    //             if (d.linked) {
    //                 setDiscordLinked(true);
    //                 sessionStorage.setItem("discord_linked", "true");
    //             }
    //         })
    //         .catch(() => {});
    // }, [isSignedIn]);

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

    // If already accepted (and didn't just join on this page) → redirect to vote page
    useEffect(() => {
        if (data?.myStatus === "accepted" && !joined) {
            router.replace(`/vote`);
        }
    }, [data?.myStatus, joined, router]);

    // If pending request → auto-accept via invite link (captain shared link = implicit approval)
    useEffect(() => {
        if (data?.myStatus === "pending" && !joining && !joined) {
            handleAccept();
        }
    }, [data?.myStatus]); // eslint-disable-line react-hooks/exhaustive-deps

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
            // Save auto-accept preference if toggled on
            if (autoAccept && data) {
                fetch("/api/squads/auto-accept-player", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ captainId: data.captain.id, enabled: true }),
                }).catch(() => {}); // fire-and-forget
            }
            setJoined(true);
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
            <div className="mx-auto max-w-lg px-4 py-20 text-center space-y-5">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto"
                >
                    <Check className="w-10 h-10 text-success" />
                </motion.div>
                <div>
                    <h1 className="text-2xl font-bold mb-1">You&apos;re In! 🎉</h1>
                    <p className="text-foreground/50">
                        Joined <strong>{data.squadName}</strong>
                    </p>
                </div>



                {/* Discord prompt removed — using WhatsApp now */}
                {/* Discord UI code kept as comment for future re-enablement
                {!discordLinked && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-3">
                        <button type="button" onClick={() => openDiscordModal(`/api/discord/authorize?returnTo=profile&pollId=${encodeURIComponent(data.pollId)}`)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-[#5865F2] text-white">
                            Link Discord
                        </button>
                        <button type="button" onClick={() => router.push("/vote")} className="w-full text-center text-xs text-foreground/35">
                            Skip — I'll get the room ID from my leader
                        </button>
                    </motion.div>
                )}
                */}

                {/* Go to Tournament — always visible */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                >
                    <Button
                        color="primary"
                        size="lg"
                        className="w-full font-semibold"
                        onPress={() => router.push("/vote")}
                    >
                        Go to Tournament
                    </Button>
                </motion.div>
                {/* <DiscordCompareModal /> */}{/* Discord disabled */}
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-[60vh] px-4">
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-sm space-y-6 text-center"
            >
                {/* Captain avatar + invite message */}
                <div className="space-y-3">
                    <Avatar
                        src={data.captain.imageUrl}
                        name={data.captain.displayName}
                        className="w-16 h-16 mx-auto ring-2 ring-primary/20"
                    />
                    <div>
                        <p className="text-lg font-bold">{data.captain.displayName}</p>
                        <p className="text-sm text-foreground/50 mt-1">
                            invited you to join team
                        </p>
                        <p className="text-base font-semibold text-primary mt-0.5">
                            {data.squadName}
                        </p>
                    </div>
                </div>

                {/* Conflict warning */}
                {conflictSquad && (
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200/30 dark:border-amber-800/30 p-3">
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                            ⚠️ You&apos;re in <strong>&quot;{conflictSquad}&quot;</strong>. Joining will switch you.
                        </p>
                    </div>
                )}

                {/* Auto-accept toggle */}
                {isSignedIn && (
                    <label
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                            autoAccept
                                ? "bg-primary/5 border-primary/20"
                                : "bg-foreground/[0.02] border-divider hover:border-foreground/20"
                        }`}
                    >
                        <Checkbox
                            isSelected={autoAccept}
                            onValueChange={setAutoAccept}
                            size="sm"
                            className="mt-0.5"
                        />
                        <div className="text-left min-w-0">
                            <p className="text-sm font-medium">
                                Auto-accept from {data.captain.displayName}
                            </p>
                            <p className="text-[11px] text-foreground/40 mt-0.5">
                                Future invites from this player will be accepted automatically
                            </p>
                        </div>
                    </label>
                )}

                {/* Action buttons */}
                <div className="flex gap-3">
                    <Button
                        color="success"
                        size="lg"
                        className="flex-1 font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 shadow-lg shadow-emerald-500/20"
                        isLoading={joining}
                        startContent={!joining ? <Check className="w-5 h-5" /> : undefined}
                        onPress={() => handleAccept(!!conflictSquad)}
                    >
                        {!isSignedIn ? "Sign In & Join" : joining ? "Joining..." : "Accept & Join"}
                    </Button>
                    <Button
                        variant="flat"
                        size="lg"
                        className="flex-1 font-medium"
                        startContent={<X className="w-4 h-4" />}
                        onPress={handleDecline}
                    >
                        Decline
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}
