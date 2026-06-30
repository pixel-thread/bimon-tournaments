"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Input, Button, Spinner, Switch, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/react";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { Shield, Users, Clock, ChevronRight, CheckCircle2, AlertTriangle, X, Check, RefreshCw, Plus, CheckCheck, Phone } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useCreateSquad, usePreviousRoster, useImportRoster } from "@/hooks/use-squads";
import { useAuthUser } from "@/hooks/use-auth-user";
// import { useDiscordCompareModal } from "@/components/common/discord-compare-modal"; // Discord disabled

import { TeamDoneSection } from "@/components/squads/team-done-section";
import { markWhatsAppPending, markWhatsAppJoined } from "@/components/common/whatsapp-squad-guard";
import { getPollTheme } from "@/components/vote/pollTheme";
import { toast } from "sonner";
import { GAME } from "@/lib/game-config";

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
    maxSquadWaitlist: number;
    teamSize: number;
    maxTeamSize: number;
    hasSquad: boolean;
    mySquadName: string | null;
    hasVotedIn: boolean;
    whatsappGroupLink: string | null;
    participantCount: number;
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
    const { isSignedIn } = useAuthUser();
    // const { openDiscordModal, DiscordCompareModal } = useDiscordCompareModal(); // Discord disabled

    const [teamName, setTeamName] = useState(searchParams.get("team") ?? "");
    const [teamFullName, setTeamFullName] = useState("");
    const [step, setStep] = useState<"form" | "creating" | "done">("form");
    const [createdSquadId, setCreatedSquadId] = useState<string | null>(null);
    const [useClan, setUseClan] = useState(false);
    const [whatsappJoined, setWhatsappJoined] = useState(false);
    const [showVoteWarning, setShowVoteWarning] = useState(false);
    // Discord state (disabled — kept for future use)
    // const [discordLinked, setDiscordLinked] = useState(() => {
    //     if (typeof window !== "undefined") {
    //         return sessionStorage.getItem("discord_linked") === "true";
    //     }
    //     return false;
    // });
    const createMutation = useCreateSquad();
    const importRosterMutation = useImportRoster();
    const inputRef = useRef<HTMLInputElement>(null);
    const [showNewForm, setShowNewForm] = useState(false);
    const [quickCreating, setQuickCreating] = useState(false);

    // Guest form state
    const [guestMode, setGuestMode] = useState(!isSignedIn);
    const [captainName, setCaptainName] = useState("");
    const [captainPhone, setCaptainPhone] = useState("");
    const totalSlots = GAME.maxSquadSize - 1; // 5 for BGMI
    const [slotNames, setSlotNames] = useState<Record<number, string>>({});
    const [guestSubmitting, setGuestSubmitting] = useState(false);
    const [showGhostPrompt, setShowGhostPrompt] = useState(false);

    // Auto-enable guest mode when not signed in
    useEffect(() => {
        if (!isSignedIn) setGuestMode(true);
    }, [isSignedIn]);

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

    // Past roster — show as landing when available
    const { data: previousRoster } = usePreviousRoster(pollId, isSignedIn && !!data && !data.hasSquad);
    const hasPreviousRoster = !!previousRoster && previousRoster.members.some(m => m.available);

    // One-click "Use This Team" handler
    async function handleQuickCreateFromRoster() {
        if (!previousRoster || quickCreating || !pollId) return;
        setQuickCreating(true);
        try {
            const result = await createMutation.mutateAsync({
                pollId,
                name: previousRoster.squadName,
                fullName: previousRoster.fullName || undefined,
                useClan: !!previousRoster.clanId,
            });
            const newSquadId = result.data?.id;
            if (!newSquadId) throw new Error("Failed to create squad");

            const availableIds = previousRoster.members.filter(m => m.available).map(m => m.playerId);
            if (availableIds.length > 0) {
                await importRosterMutation.mutateAsync({
                    squadId: newSquadId,
                    memberIds: availableIds,
                    autoAcceptAll: true,
                });
            }

            toast.success(`Team "${previousRoster.squadName}" created with full roster! 🎉`);
            router.push(`/vote?tab=${data?.allowSquads ? "ranked" : "casual"}&poll=${pollId}`);
        } catch (err: any) {
            toast.error(err?.message || "Failed to create team");
        } finally {
            setQuickCreating(false);
        }
    }

    // Auto-enable clan toggle when valid clan data loads, but only if user hasn't started typing
    useEffect(() => {
        if (hasClan && !teamName.trim()) {
            setUseClan(true);
        }
    }, [hasClan]);

    // Discord link check (disabled — kept for future use)
    // useEffect(() => {
    //     fetch("/api/discord/link", { method: "GET" })
    //         .then((res) => res.json())
    //         .then((d) => {
    //             if (d.linked) {
    //                 setDiscordLinked(true);
    //                 sessionStorage.setItem("discord_linked", "true");
    //             } else {
    //                 setDiscordLinked(false);
    //                 sessionStorage.removeItem("discord_linked");
    //             }
    //         })
    //         .catch(() => {});
    // }, []);

    // Discord OAuth callback (disabled — kept for future use)
    // useEffect(() => {
    //     const discordParam = searchParams.get("discord");
    //     if (!discordParam) return;
    //     switch (discordParam) {
    //         case "linked":
    //             setDiscordLinked(true);
    //             sessionStorage.setItem("discord_linked", "true");
    //             break;
    //         case "not_in_server":
    //             toast.error("You must join our Discord server first!");
    //             break;
    //         case "already_linked":
    //             toast.error("This Discord account is already linked to another player");
    //             break;
    //         case "denied":
    //             toast.error("Discord authorization is required to create a team");
    //             break;
    //         default:
    //             if (discordParam !== "linked") {
    //                 toast.error("Failed to link Discord — please try again");
    //             }
    //     }
    // }, [searchParams]);

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
            { pollId, name, useClan: effectiveUseClan, fullName: teamFullName.trim() || undefined },
            {
                onSuccess: (result) => {
                    setCreatedSquadId(result?.data?.id ?? null);
                    // Persist WhatsApp pending for global guard
                    if (data?.whatsappGroupLink) {
                        markWhatsAppPending({
                            pollId,
                            squadName: result?.data?.name ?? name,
                            tournamentName: data?.tournamentName ?? "Tournament",
                            whatsappGroupLink: data.whatsappGroupLink,
                        });
                    }
                    toast.success(`Team "${result?.data?.name ?? name}" created! 🎉`);
                    router.push(`/vote?tab=${data?.allowSquads ? "ranked" : "casual"}&poll=${pollId}`);
                },
                onError: () => {
                    setStep("form");
                },
            }
        );
    }, [teamName, teamFullName, pollId, useClan, hasClan, createMutation, data?.whatsappGroupLink, data?.tournamentName]);

    const handleSubmit = useCallback(() => {
        const effectiveUseClan = useClan && hasClan;
        if (!effectiveUseClan && !teamName.trim()) return;
        // If user has an existing individual vote, show warning first
        if (data?.hasVotedIn) {
            setShowVoteWarning(true);
            return;
        }
        if (!isSignedIn) {
            // Show guest form instead of redirecting to sign-in
            setGuestMode(true);
            return;
        }
        handleCreate();
    }, [teamName, useClan, hasClan, isSignedIn, pollId, handleCreate, data?.hasVotedIn]);

    // Guest form submission
    const handleGuestSubmit = async () => {
        if (!captainName.trim() || captainPhone.replace(/\D/g, "").length !== 10 || !teamName.trim()) return;
        setGuestSubmitting(true);
        try {
            const members = Object.entries(slotNames)
                .filter(([, name]) => name.trim())
                .map(([, name]) => ({ name: name.trim() }));

            const res = await fetch("/api/squads/guest-create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pollId,
                    captainName: captainName.trim(),
                    captainPhone: captainPhone.trim(),
                    teamName: teamName.trim(),
                    teamFullName: teamFullName.trim() || undefined,
                    members,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                toast.error(json.message || "Failed to create team");
                return;
            }
            toast.success(json.message || "Team created! 🎉");
            setStep("done");
        } catch {
            toast.error("Failed to create team");
        } finally {
            setGuestSubmitting(false);
        }
    };

    const handleConfirmWithVote = useCallback(() => {
        setShowVoteWarning(false);
        if (!isSignedIn) {
            const effectiveName = (useClan && hasClan) ? "_clan_" : teamName.trim();
            localStorage.setItem("pending-join-poll", pollId);
            localStorage.setItem("pending-join-team", effectiveName);
            window.location.href = `/sign-in?redirect_url=${encodeURIComponent(`/join/${pollId}?team=${encodeURIComponent(effectiveName)}`)}`;
            return;
        }
        handleCreate();
    }, [isSignedIn, useClan, hasClan, teamName, pollId, handleCreate]);

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

    const isFull = data.squadCount >= data.maxSquadWaitlist;
    const guestCanSubmit = captainName.trim() && captainPhone.replace(/\D/g, "").length === 10 && teamName.trim();
    const canSubmit = guestMode
        ? !!guestCanSubmit && !isFull && step === "form"
        : ((useClan && hasClan) || teamName.trim().length > 0) && !isFull && step === "form";

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
                            onWhatsappJoin={() => { setWhatsappJoined(true); markWhatsAppJoined(pollId); }}
                            createdSquadId={createdSquadId}
                            pollId={pollId}
                            isRanked={data.allowSquads}
                            discordInviteLink={process.env.NEXT_PUBLIC_DISCORD_INVITE_LINK || null}
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
                        {(() => {
                            // Match vote page: squad polls use teams × squadSize for theme tier
                            const themeCount = data.allowSquads
                                ? data.squadCount * GAME.squadSize
                                : data.participantCount;
                            const theme = getPollTheme(themeCount);
                            const headerGradient = theme?.header || 'from-blue-600 via-violet-600 to-purple-700';
                            return (
                        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${headerGradient} p-6 pb-10 text-white`}>
                            {/* Decorative circles */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                            {/* Sparkles */}
                            <div className="absolute top-3 left-6 w-1 h-1 bg-white rounded-full animate-ping opacity-75" style={{ zIndex: 2 }} />
                            <div className={`absolute top-4 right-8 w-1.5 h-1.5 ${theme?.sparkle || 'bg-white'} rounded-full animate-ping opacity-60`} style={{ animationDelay: "0.5s", zIndex: 2 }} />
                            {/* Waves */}
                            <div className="absolute bottom-0 left-0 right-0 h-12 overflow-hidden" style={{ zIndex: 2 }}>
                                <svg className="absolute bottom-0 w-[200%] h-12 animate-[wave_3s_ease-in-out_infinite]" viewBox="0 0 1200 120" preserveAspectRatio="none">
                                    <path d="M0,60 C200,100 400,20 600,60 C800,100 1000,20 1200,60 L1200,120 L0,120 Z" fill={theme?.wave1 || "rgba(255,255,255,0.15)"} />
                                </svg>
                                <svg className="absolute bottom-0 w-[200%] h-10 animate-[wave_4s_ease-in-out_infinite_reverse]" viewBox="0 0 1200 120" preserveAspectRatio="none">
                                    <path d="M0,60 C200,20 400,100 600,60 C800,20 1000,100 1200,60 L1200,120 L0,120 Z" fill={theme?.wave2 || "rgba(255,255,255,0.1)"} />
                                </svg>
                            </div>
                            <style jsx>{`
                                @keyframes wave {
                                    0%, 100% { transform: translateX(0); }
                                    50% { transform: translateX(-25%); }
                                }
                            `}</style>
                            <div className="relative" style={{ zIndex: 3 }}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center backdrop-blur-sm">
                                            <Shield className="w-4 h-4" />
                                        </div>
                                        <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
                                            Team Registration
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => router.push(`/vote?tab=${data.allowSquads ? "ranked" : "casual"}&poll=${pollId}`)}
                                        className="text-[11px] font-medium text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-full backdrop-blur-sm transition-colors cursor-pointer"
                                    >
                                        📋 Vote Page →
                                    </button>
                                </div>
                                <h1 className="text-2xl font-bold leading-tight">
                                    {data.tournamentName}
                                </h1>
                                {data.seasonName && (
                                    <p className="text-sm text-white/60 mt-1">{data.seasonName}</p>
                                )}
                                {/* Stats row */}
                                <div className="flex items-center gap-3 mt-3 text-[11px] text-white/60">
                                    <span className="flex items-center gap-1">
                                        <Users className="w-3 h-3" />
                                        {data.squadCount}/{data.maxSquads} teams
                                    </span>
                                    {data.entryFee > 0 && (
                                        <span>💰 {data.entryFee} entry</span>
                                    )}
                                    {data.scheduledDate && (
                                        <span>📅 {new Date(data.scheduledDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                                    )}
                                </div>
                                {data.isChampionship && (
                                    <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 text-xs font-bold">
                                        🏆 Championship
                                    </span>
                                )}
                            </div>
                        </div>
                            );
                        })()}

                        {/* ── Past Roster Preview ── */}
                        {hasPreviousRoster && !showNewForm && !isFull && (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-3"
                            >
                                {/* Roster header */}
                                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                                    <RefreshCw className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-emerald-400 truncate">{previousRoster!.squadName}</p>
                                        {previousRoster!.fullName && (
                                            <p className="text-[11px] text-foreground/40 truncate">{previousRoster!.fullName}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Members */}
                                <div className="space-y-1.5">
                                    <p className="text-xs font-medium text-foreground/50 px-1">
                                        Roster ({previousRoster!.members.filter(m => m.available).length} available)
                                    </p>
                                    {previousRoster!.members.map((m) => (
                                        <div
                                            key={m.playerId}
                                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                                                m.available
                                                    ? 'bg-foreground/[0.03] border border-foreground/5'
                                                    : 'opacity-40 line-through'
                                            }`}
                                        >
                                            <PlayerAvatar src={m.imageUrl} playerId={m.playerId} playerName={m.displayName} size="sm" className="w-7 h-7 shrink-0" />
                                            <span className="text-sm font-medium flex-1 truncate">{m.displayName}</span>
                                            {m.available ? (
                                                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                            ) : (
                                                <X className="w-3.5 h-3.5 text-foreground/30 shrink-0" />
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Actions */}
                                <div className="space-y-2 pt-1">
                                    <Button
                                        className="w-full font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-lg shadow-emerald-500/20"
                                        size="lg"
                                        isLoading={quickCreating}
                                        startContent={!quickCreating && <CheckCheck className="w-4 h-4" />}
                                        onPress={handleQuickCreateFromRoster}
                                    >
                                        Use This Team
                                    </Button>
                                    <Button
                                        variant="flat"
                                        className="w-full font-semibold"
                                        size="lg"
                                        startContent={<Plus className="w-4 h-4" />}
                                        isDisabled={quickCreating}
                                        onPress={() => setShowNewForm(true)}
                                    >
                                        Create New Team
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {/* ── Team Name / Clan Toggle ── */}
                        {!isFull && (!hasPreviousRoster || showNewForm) && (
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

                                {/* Team Tag — mandatory, shown first */}
                                {myClan !== undefined && (!useClan || !hasClan) && (
                                    <Input
                                        ref={inputRef}
                                        label="Team Tag"
                                        placeholder="e.g. ALPHA"
                                        value={teamName}
                                        onValueChange={(v) => setTeamName(v.slice(0, 7))}
                                        maxLength={7}
                                        size="lg"
                                        isRequired
                                        description={`${teamName.length}/7 characters • shown in standings`}
                                        classNames={{
                                            input: "text-base",
                                            inputWrapper: "shadow-sm",
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && canSubmit) handleSubmit();
                                        }}
                                    />
                                )}

                                {/* Full Team Name — optional, collapsed by default */}
                                {myClan !== undefined && (!useClan || !hasClan) && (
                                    teamFullName ? (
                                        <Input
                                            label="Full Name (optional)"
                                            placeholder="e.g. Alpha Warriors"
                                            value={teamFullName.trim() ? teamFullName : ""}
                                            onValueChange={(v) => setTeamFullName(v.slice(0, 30))}
                                            maxLength={30}
                                            size="lg"
                                            autoFocus
                                            description="Shown in slot views • leave blank to use tag only"
                                            classNames={{
                                                input: "text-base",
                                                inputWrapper: "shadow-sm",
                                            }}
                                            endContent={
                                                <button
                                                    type="button"
                                                    className="p-0.5 rounded hover:bg-foreground/10 transition-colors cursor-pointer"
                                                    onClick={() => setTeamFullName("")}
                                                >
                                                    <X className="w-3.5 h-3.5 text-foreground/40" />
                                                </button>
                                            }
                                        />
                                    ) : (
                                        <button
                                            type="button"
                                            className="text-xs text-primary font-medium hover:underline cursor-pointer text-left"
                                            onClick={() => setTeamFullName(" ")}
                                        >
                                            + Add full team name (optional)
                                        </button>
                                    )
                                )}

                                {/* Clan confirmation hint */}
                                {useClan && hasClan && myClan && (
                                    <div className="p-3 rounded-xl bg-success-50/50 border border-success-100 text-sm text-success-700 dark:text-success-400 dark:bg-success-900/20 dark:border-success-800">
                                        Team will be named <strong>&ldquo;{myClan.name}&rdquo;</strong> with your clan logo.
                                    </div>
                                )}

                                {/* Discord requirement removed — leader invite sent via WhatsApp bot */}
                                {/* Discord UI code kept as comment for future re-enablement */}

                                {/* ── Submit Button ── */}
                                {!guestMode ? (
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
                                ) : (
                                    /* ── Guest Form ── */
                                    <div className="space-y-3 pt-1">
                                        <div className="h-px bg-divider" />
                                        <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">
                                            Players ({1 + Object.values(slotNames).filter(n => n.trim()).length}/{GAME.maxSquadSize})
                                        </p>
                                        <div className="space-y-2">
                                            {/* Player 1 / Leader */}
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-primary/15 text-primary">
                                                        1
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="Player 1 / Leader *"
                                                        value={captainName}
                                                        onChange={(e) => setCaptainName(e.target.value.slice(0, 20))}
                                                        maxLength={20}
                                                        className="flex-1 min-w-0 rounded-lg bg-default-100 px-3 py-2.5 text-sm outline-none placeholder:text-foreground/40 font-medium focus:ring-2 focus:ring-primary/40 transition-shadow"
                                                    />
                                                    <span className="text-[9px] text-primary font-bold uppercase shrink-0 bg-primary/10 px-1.5 py-0.5 rounded">Leader</span>
                                                </div>
                                                <div className="flex items-center gap-2 ml-8">
                                                    <Phone className="w-3.5 h-3.5 text-foreground/40 shrink-0" />
                                                    <input
                                                        type="tel"
                                                        placeholder="Leader phone (10 digits) *"
                                                        value={captainPhone}
                                                        onChange={(e) => setCaptainPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                                        maxLength={10}
                                                        className="flex-1 min-w-0 rounded-lg bg-default-100 px-3 py-2 text-sm outline-none placeholder:text-foreground/40 focus:ring-2 focus:ring-primary/40 transition-shadow"
                                                    />
                                                    {captainPhone.replace(/\D/g, "").length === 10 && (
                                                        <Check className="w-4 h-4 text-success shrink-0" />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Player 2–6 */}
                                            {Array.from({ length: totalSlots }).map((_, i) => {
                                                const slotLabel = i < GAME.squadSize - 1 ? `Player ${i + 2}` : `Sub ${i - GAME.squadSize + 2}`;
                                                const isSub = i >= GAME.squadSize - 1;
                                                return (
                                                    <div key={`guest-slot-${i}`} className="flex items-center gap-2">
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isSub ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'}`}>
                                                            {i + 2}
                                                        </div>
                                                        <input
                                                            type="text"
                                                            placeholder={slotLabel}
                                                            value={slotNames[i] || ""}
                                                            onChange={(e) => setSlotNames(prev => ({ ...prev, [i]: e.target.value }))}
                                                            maxLength={20}
                                                            className={`flex-1 min-w-0 rounded-lg bg-default-100 px-3 py-2.5 text-sm outline-none placeholder:text-foreground/40 focus:ring-2 focus:ring-primary/40 transition-shadow ${isSub ? 'border border-dashed border-foreground/10' : ''}`}
                                                        />
                                                        {slotNames[i]?.trim() && (
                                                            <button
                                                                onClick={() => setSlotNames(prev => { const n = { ...prev }; delete n[i]; return n; })}
                                                                className="w-6 h-6 rounded-full hover:bg-foreground/10 flex items-center justify-center shrink-0"
                                                            >
                                                                <X className="w-3.5 h-3.5 text-foreground/30" />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <Button
                                            color="primary"
                                            size="lg"
                                            className="w-full font-semibold text-white bg-gradient-to-r from-blue-600 to-violet-600 shadow-lg shadow-blue-500/20"
                                            isDisabled={!canSubmit}
                                            isLoading={guestSubmitting}
                                            startContent={!guestSubmitting ? <Shield className="w-4 h-4" /> : undefined}
                                            onPress={() => setShowGhostPrompt(true)}
                                        >
                                            {guestSubmitting ? "Creating Team..." : "Register Team"}
                                        </Button>

                                        <p className="text-[11px] text-center text-danger">
                                            Team tag, leader name & phone are required • teammates are optional
                                        </p>
                                        <p className="text-[11px] text-center text-foreground/40">
                                            Already a player?{" "}
                                            <a href={`/sign-in?redirect_url=${encodeURIComponent(`/join/${pollId}`)}`} className="text-primary font-medium hover:underline">
                                                Sign in
                                            </a>
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {isFull && (
                            <div className="text-center py-3 rounded-xl bg-danger/5 border border-danger/20">
                                <span className="text-sm font-bold text-danger">Registration Full</span>
                            </div>
                        )}

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

            {/* Ghost vs Sign-in prompt modal */}
            <Modal
                isOpen={showGhostPrompt}
                onClose={() => setShowGhostPrompt(false)}
                placement="center"
                size="sm"
                classNames={{
                    base: "bg-background border border-divider",
                    backdrop: "bg-black/60 backdrop-blur-sm",
                }}
            >
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2 text-base">
                        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4 text-primary" />
                        </div>
                        <span>Create your team</span>
                    </ModalHeader>
                    <ModalBody className="pt-0 space-y-3">
                        <Button
                            color="primary"
                            size="lg"
                            className="w-full font-semibold"
                            onPress={() => {
                                // Save form data to localStorage before redirecting
                                localStorage.setItem("pending-join-form", JSON.stringify({
                                    pollId,
                                    teamName,
                                    teamFullName,
                                    captainName,
                                    captainPhone,
                                    slotNames,
                                }));
                                window.location.href = `/sign-in?redirect_url=${encodeURIComponent(`/join/${pollId}`)}`;
                            }}
                        >
                            🔐 Sign In & Register
                        </Button>
                        <p className="text-[11px] text-center text-foreground/50">
                            Your team info is saved — no need to fill it again
                        </p>
                        <div className="h-px bg-divider" />
                        <Button
                            variant="flat"
                            size="lg"
                            className="w-full font-semibold"
                            isLoading={guestSubmitting}
                            onPress={() => {
                                setShowGhostPrompt(false);
                                handleGuestSubmit();
                            }}
                        >
                            👻 Continue as Guest
                        </Button>
                        <p className="text-[11px] text-center text-foreground/40">
                            No account needed • team created instantly
                        </p>
                    </ModalBody>
                    <ModalFooter />
                </ModalContent>
            </Modal>
            {/* <DiscordCompareModal /> */}{/* Discord disabled */}
        </>
    );
}
