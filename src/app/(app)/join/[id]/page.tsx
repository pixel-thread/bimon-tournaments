"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Input, Button, Spinner, Switch, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/react";
import { Shield, Users, Clock, ChevronRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useCreateSquad } from "@/hooks/use-squads";
import { useAuthUser } from "@/hooks/use-auth-user";
// import { useDiscordCompareModal } from "@/components/common/discord-compare-modal"; // Discord disabled

import { TeamDoneSection } from "@/components/squads/team-done-section";
import { markWhatsAppPending, markWhatsAppJoined } from "@/components/common/whatsapp-squad-guard";
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
    maxSquadWaitlist: number;
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
                    setStep("done");
                    // Persist WhatsApp pending for global guard
                    if (data?.whatsappGroupLink) {
                        markWhatsAppPending({
                            pollId,
                            squadName: result?.data?.name ?? name,
                            tournamentName: data?.tournamentName ?? "Tournament",
                            whatsappGroupLink: data.whatsappGroupLink,
                        });
                    }
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
            // Guest → save team name in URL and redirect to sign-in
            const effectiveName = (useClan && hasClan) ? "_clan_" : teamName.trim();
            localStorage.setItem("pending-join-poll", pollId);
            window.location.href = `/sign-in?redirect_url=${encodeURIComponent(`/join/${pollId}?team=${encodeURIComponent(effectiveName)}`)}`;
            return;
        }
        handleCreate();
    }, [teamName, useClan, hasClan, isSignedIn, pollId, handleCreate, data?.hasVotedIn]);

    const handleConfirmWithVote = useCallback(() => {
        setShowVoteWarning(false);
        if (!isSignedIn) {
            const effectiveName = (useClan && hasClan) ? "_clan_" : teamName.trim();
            localStorage.setItem("pending-join-poll", pollId);
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
    const canSubmit = ((useClan && hasClan) || teamName.trim().length > 0) && !isFull && step === "form"; // Discord requirement removed

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

                        {/* Quick nav — Vote or Create Team */}
                        <div className="flex gap-2">
                            <Button
                                variant="flat"
                                size="sm"
                                className="flex-1"
                                onPress={() => router.push(`/vote?tab=${data.allowSquads ? "ranked" : "casual"}&poll=${pollId}`)}
                            >
                                📋 Go to Vote
                            </Button>
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
                                        label="Team Tag"
                                        placeholder="e.g. ALPHA"
                                        value={teamName}
                                        onValueChange={(v) => setTeamName(v.slice(0, 7))}
                                        maxLength={7}
                                        size="lg"
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

                                {/* Optional Full Name */}
                                {myClan !== undefined && (!useClan || !hasClan) && teamName.trim().length > 0 && (
                                    <Input
                                        label="Full Team Name (optional)"
                                        placeholder="e.g. Alpha Warriors"
                                        value={teamFullName}
                                        onValueChange={(v) => setTeamFullName(v.slice(0, 30))}
                                        maxLength={30}
                                        size="lg"
                                        description="Shown in slot views • leave blank to use tag only"
                                        classNames={{
                                            input: "text-base",
                                            inputWrapper: "shadow-sm",
                                        }}
                                    />
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
            {/* <DiscordCompareModal /> */}{/* Discord disabled */}
        </>
    );
}
