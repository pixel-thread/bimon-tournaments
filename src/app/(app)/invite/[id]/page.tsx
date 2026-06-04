"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button, Spinner, Avatar } from "@heroui/react";
import { Shield, Users, Clock, Check, X } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useDiscordCompareModal } from "@/components/common/discord-compare-modal";

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
    const { openDiscordModal, DiscordCompareModal } = useDiscordCompareModal();
    const [discordLinked, setDiscordLinked] = useState(() => {
        if (typeof window !== "undefined") return sessionStorage.getItem("discord_linked") === "true";
        return false;
    });

    // Check Discord link status
    useEffect(() => {
        if (!isSignedIn) return;
        fetch("/api/discord/link", { method: "GET" })
            .then((res) => res.json())
            .then((d) => {
                if (d.linked) {
                    setDiscordLinked(true);
                    sessionStorage.setItem("discord_linked", "true");
                }
            })
            .catch(() => {});
    }, [isSignedIn]);

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

                {/* Skippable Discord prompt — only if not linked */}
                {!discordLinked ? (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="space-y-3"
                    >
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/20">
                            <svg className="w-5 h-5 text-[#5865F2] shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-semibold text-[#5865F2]">Link Discord</p>
                                <p className="text-[11px] text-foreground/40">Get room IDs & match updates directly</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                openDiscordModal(`/api/discord/authorize?returnTo=profile&pollId=${encodeURIComponent(data.pollId)}`);
                            }}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all bg-[#5865F2] hover:bg-[#4752C4] text-white shadow-lg shadow-[#5865F2]/25 cursor-pointer active:scale-[0.98]"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
                            Link Discord
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push("/vote")}
                            className="w-full text-center text-xs text-foreground/35 hover:text-foreground/50 transition-colors py-1 cursor-pointer"
                        >
                            Skip — I&apos;ll get the room ID from my leader
                        </button>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
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
                )}
                <DiscordCompareModal />
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
