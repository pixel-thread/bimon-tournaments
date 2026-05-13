"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Input, Button, Spinner, Avatar } from "@heroui/react";
import { Shield, Trophy, Users, Calendar, Clock, ChevronRight, CheckCircle2, Copy, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useCreateSquad, useSearchPlayers, useInvitePlayer } from "@/hooks/use-squads";
import { useAuthGate } from "@/components/common/auth-gate-provider";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";
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
    days: string;
    squadCount: number;
    maxSquads: number;
    teamSize: number;
    maxTeamSize: number;
    hasSquad: boolean;
    mySquadName: string | null;
    whatsappGroupLink: string | null;
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
    const [inviteSearch, setInviteSearch] = useState("");
    const [linkCopied, setLinkCopied] = useState(false);
    const [invitingPlayerId, setInvitingPlayerId] = useState<string | null>(null);
    const [whatsappJoined, setWhatsappJoined] = useState(false);
    const createMutation = useCreateSquad();
    const inviteMutation = useInvitePlayer();
    const { data: searchResults, isLoading: isSearching } = useSearchPlayers(
        inviteSearch,
        pollId
    );
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

    // If user already has a squad → redirect to vote page
    useEffect(() => {
        if (data?.hasSquad) {
            toast.info(`You're already in ${data.mySquadName ?? "a team"} — redirecting...`);
            router.replace(`/vote?tab=ranked&poll=${pollId}`);
        }
    }, [data?.hasSquad, data?.mySquadName, pollId, router]);

    // Auto-focus team name input once data loads
    useEffect(() => {
        if (data && !data.hasSquad && data.isActive && data.allowSquads) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 400); // wait for entrance animation
            return () => clearTimeout(timer);
        }
    }, [data]);

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
                onSuccess: (result) => {
                    setCreatedSquadId(result?.data?.id ?? null);
                    setStep("done");
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

                        {/* WhatsApp join — prominent button */}
                        {data.whatsappGroupLink && (
                            <a
                                href={data.whatsappGroupLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setWhatsappJoined(true)}
                                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all ${
                                    whatsappJoined
                                        ? "bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                        : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                                }`}
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                                {whatsappJoined ? "Joined WhatsApp Group ✅" : "Join WhatsApp Group"}
                            </a>
                        )}

                        {/* Gate: copy link & invite only after WhatsApp joined (or no link) */}
                        {(!data.whatsappGroupLink || whatsappJoined) ? (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15 }}
                                className="space-y-5"
                            >
                                {/* Share on WhatsApp */}
                                {createdSquadId && (
                                    <a
                                        href={`https://wa.me/?text=${encodeURIComponent(`Join my team for the tournament! \ud83c\udfae\ud83d\udd25\n${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${createdSquadId}`)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors cursor-pointer"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                            </svg>
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                                                Share Invite on WhatsApp
                                            </p>
                                            <p className="text-[11px] text-emerald-600/60 dark:text-emerald-400/60">
                                                Send invite link to your teammates
                                            </p>
                                        </div>
                                        <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                            <Copy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                    </a>
                                )}

                                {/* Search & invite players */}
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">
                                        Or invite existing players
                                    </p>
                                    <Input
                                        placeholder="Search player..."
                                        value={inviteSearch}
                                        onValueChange={setInviteSearch}
                                        size="sm"
                                        startContent={<Search className="w-3.5 h-3.5 text-default-400" />}
                                        endContent={inviteSearch ? (
                                            <button type="button" onClick={() => setInviteSearch("")} className="p-0.5">
                                                <X className="w-3 h-3 text-default-400" />
                                            </button>
                                        ) : undefined}
                                    />
                                    {isSearching && (
                                        <div className="flex justify-center py-2">
                                            <Spinner size="sm" />
                                        </div>
                                    )}
                                    {searchResults && searchResults.length > 0 && (
                                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                            {searchResults.map((player) => (
                                                <div key={player.id} className="flex items-center gap-2 py-1.5">
                                                    <Avatar
                                                        src={player.imageUrl}
                                                        name={player.displayName}
                                                        size="sm"
                                                        className="w-7 h-7 shrink-0"
                                                    />
                                                    <span className="text-sm font-medium truncate flex-1">
                                                        {player.displayName}
                                                    </span>
                                                    <Button
                                                        size="sm"
                                                        color="primary"
                                                        variant="flat"
                                                        className="min-w-0 px-3 h-7"
                                                        isLoading={inviteMutation.isPending && invitingPlayerId === player.id}
                                                        isDisabled={inviteMutation.isPending && invitingPlayerId !== player.id}
                                                        onPress={() => {
                                                            if (!createdSquadId) return;
                                                            setInvitingPlayerId(player.id);
                                                            inviteMutation.mutate({ squadId: createdSquadId, playerId: player.id });
                                                        }}
                                                    >
                                                        Invite
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {searchResults && searchResults.length === 0 && inviteSearch.length >= 2 && (
                                        <p className="text-xs text-foreground/40 text-center py-2">No players found</p>
                                    )}
                                </div>

                                {/* Go to tournament button */}
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
                        ) : (
                            <p className="text-xs text-foreground/40 text-center">Join the WhatsApp group to invite teammates</p>
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

                        {/* ── Team Name Input ── */}
                        {!isFull && (
                            <div className="space-y-3">
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
                                <Clock className="w-4 h-4 text-foreground/40" />
                                <div>
                                    <p className="text-[10px] text-foreground/40 uppercase">Match Time</p>
                                    <p className="text-sm font-bold">{timeLabel}</p>
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
    );
}
