"use client";

import { useQuery } from "@tanstack/react-query";
import {
    Card,
    CardBody,
    CardHeader,
    Divider,
    Chip,
    Skeleton,
    Tabs,
    Tab,
    Button,
} from "@heroui/react";
import {
    Vote,
    AlertCircle,
    CheckCircle2,
    Users,
    Calendar,
    InboxIcon,
    Swords,
    Plus,
    Pencil,
    Send,
} from "lucide-react";
import { motion } from "motion/react";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PollTeamsPreviewModal } from "@/components/dashboard/polls/PollTeamsPreviewModal";
import { PollFormModal } from "@/components/dashboard/polls/PollFormModal";
import { useQueryClient } from "@tanstack/react-query";
import type { PreviewTeamsByPollsResult } from "@/lib/logic/previewTeamsByPoll";
import { toast } from "sonner";
import { GAME } from "@/lib/game-config";

interface PollDTO {
    id: string;
    question: string;
    teamType: string;
    days: string;
    isActive: boolean;
    inVotes: number;
    outVotes: number;
    soloVotes: number;
    totalVotes: number;
    createdAt: string;
    allowSquads?: boolean;
    enableFund?: boolean;
    prizePoolFee?: number | null;
    expectedPrizePool?: number | null;
    scheduledDate?: string | null;
    scheduledTime?: string;
    matchSchedule?: Record<string, string[]> | null;
    options?: { id: string; name: string; vote: string }[];
    tournament?: { id: string; name: string; fee: number; type: string };
}

type JobStatus = "idle" | "loading" | "completed" | "failed";

const TEAM_SIZE_MAP: Record<string, 1 | 2 | 3 | 4> = {
    SOLO: 1,
    DUO: 2,
    TRIO: 3,
    SQUAD: 4,
};

/**
 * For DYNAMIC: < 40 players → TRIO, ≥ 40 → SQUAD.
 */
function getDynamicGroupSize(playerCount: number): 3 | 4 {
    return playerCount < 40 ? 3 : 4;
}

function resolveGroupSize(teamType: string, inVotes: number): 1 | 2 | 3 | 4 {
    if (teamType === "DYNAMIC") return getDynamicGroupSize(inVotes);
    return TEAM_SIZE_MAP[teamType] ?? 2;
}

/**
 * /dashboard/polls — Admin polls overview.
 */
export default function PollsAdminPage() {
    const [filter, setFilter] = useState<"all" | "active" | "closed">("active");
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewData, setPreviewData] = useState<PreviewTeamsByPollsResult | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<JobStatus>("idle");
    const [activePoll, setActivePoll] = useState<PollDTO | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [editingPoll, setEditingPoll] = useState<PollDTO | null>(null);
    const queryClient = useQueryClient();
    const router = useRouter();

    const { data: seasons } = useQuery<{ id: string; name: string; isCurrent: boolean }[]>({
        queryKey: ["seasons"],
        queryFn: async () => {
            const res = await fetch("/api/seasons");
            if (!res.ok) throw new Error("Failed");
            const json = await res.json();
            return json.data;
        },
    });

    const currentSeasonId = seasons?.find((s) => s.isCurrent)?.id ?? seasons?.[0]?.id;

    // Active polls — fetched immediately
    const { data: activePolls, isLoading: activeLoading, error: activeError } = useQuery<PollDTO[]>({
        queryKey: ["admin-polls", "active", currentSeasonId],
        queryFn: async () => {
            const res = await fetch(`/api/polls?seasonId=${currentSeasonId}&_t=${Date.now()}`);
            if (!res.ok) throw new Error("Failed");
            return (await res.json()).data.polls;
        },
        staleTime: 30 * 1000,
        enabled: !!currentSeasonId,
    });

    // All polls — only fetched when "all" or "closed" tab is selected
    const { data: allPolls, isLoading: allLoading, error: allError } = useQuery<PollDTO[]>({
        queryKey: ["admin-polls", "all", currentSeasonId],
        queryFn: async () => {
            const res = await fetch(`/api/polls?all=true&seasonId=${currentSeasonId}&_t=${Date.now()}`);
            if (!res.ok) throw new Error("Failed");
            return (await res.json()).data.polls;
        },
        staleTime: 30 * 1000,
        enabled: !!currentSeasonId && (filter === "all" || filter === "closed"),
    });

    // Derive data based on active tab
    const data = filter === "active" ? activePolls : allPolls;
    const isLoading = filter === "active" ? activeLoading : allLoading;
    const error = filter === "active" ? activeError : allError;

    const filteredPolls = data?.filter((poll) => {
        if (filter === "closed") return !poll.isActive;
        return true; // "active" already filtered by API, "all" shows everything
    });

    const activeCount = activePolls?.length ?? 0;
    const closedCount = allPolls ? allPolls.filter((p) => !p.isActive).length : 0;

    // ─── Team Generation ─────────────────────────────────────

    const fetchPreview = useCallback(async (poll: PollDTO) => {
        if (!poll.tournament) {
            toast.error("Poll has no tournament linked");
            return;
        }

        setPreviewLoading(true);
        setPreviewError(null);
        setPreviewData(null);
        setJobStatus("idle");
        setActivePoll(poll);
        setPreviewOpen(true);

        try {
            // Get current season
            const seasonRes = await fetch("/api/seasons");
            const seasonJson = await seasonRes.json();
            const currentSeason = seasonJson.data?.find((s: any) => s.isCurrent);
            if (!currentSeason) throw new Error("No active season found");

            const res = await fetch("/api/polls/teams/preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pollId: poll.id,
                    tournamentId: poll.tournament.id,
                    seasonId: currentSeason.id,
                    groupSize: resolveGroupSize(poll.teamType, poll.inVotes),
                    entryFee: poll.tournament.fee ?? 0,
                }),
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Preview failed");
            setPreviewData(json.data);
        } catch (err: any) {
            setPreviewError(err.message);
        } finally {
            setPreviewLoading(false);
        }
    }, []);

    const handleRegenerate = useCallback(() => {
        if (activePoll) fetchPreview(activePoll);
    }, [activePoll, fetchPreview]);

    const handleConfirm = useCallback(async () => {
        if (!activePoll?.tournament || !previewData) return;

        setJobStatus("loading");

        try {
            const seasonRes = await fetch("/api/seasons");
            const seasonJson = await seasonRes.json();
            const currentSeason = seasonJson.data?.find((s: any) => s.isCurrent);
            if (!currentSeason) throw new Error("No active season found");

            // Build previewTeams from current preview
            const previewTeams = previewData.teams.map((t) => ({
                teamNumber: t.teamNumber,
                playerIds: t.players.map((p) => p.id),
            }));

            const res = await fetch("/api/polls/teams/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pollId: activePoll.id,
                    tournamentId: activePoll.tournament.id,
                    seasonId: currentSeason.id,
                    groupSize: resolveGroupSize(activePoll.teamType, activePoll.inVotes),
                    entryFee: activePoll.tournament.fee ?? 0,
                    previewTeams,
                }),
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Creation failed");

            setJobStatus("completed");
            toast.success(`Created ${json.data.teamsCreated} teams with ${json.data.playersAssigned} players`);
            setTimeout(() => {
                setPreviewOpen(false);
                router.push("/dashboard/teams");
            }, 1000);
        } catch (err: any) {
            setJobStatus("failed");
            toast.error(err.message);
        }
    }, [activePoll, previewData]);

    // ─── Render ──────────────────────────────────────────────

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">Polls</h1>
                    <p className="text-sm text-foreground/50">
                        View all polls and voting results
                    </p>
                </div>
                <Button
                    size="sm"
                    color="primary"
                    isIconOnly
                    onPress={() => { setEditingPoll(null); setFormOpen(true); }}
                    className="h-9 w-9 min-w-0 sm:w-auto sm:px-3"
                    startContent={<Plus className="h-5 w-5" />}
                >
                    <span className="hidden sm:inline">New Poll</span>
                </Button>
            </div>

            {/* Filter Tabs */}
            <Tabs
                selectedKey={filter}
                onSelectionChange={(key) => setFilter(key as typeof filter)}
                size="sm"
            >
                <Tab key="active" title={`Active${activePolls ? ` (${activeCount})` : ""}`} />
                <Tab key="all" title={`All${allPolls ? ` (${allPolls.length})` : ""}`} />
                <Tab key="closed" title={`Closed${allPolls ? ` (${closedCount})` : ""}`} />
            </Tabs>

            {error && (
                <div className="flex items-center gap-2 rounded-lg bg-danger-50 p-4 text-sm text-danger dark:bg-danger-50/10">
                    <AlertCircle className="h-4 w-4" />
                    Failed to load polls.
                </div>
            )}

            {isLoading && (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-36 w-full rounded-xl" />
                    ))}
                </div>
            )}

            {filteredPolls && (
                <div>
                    {filteredPolls.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 rounded-xl bg-default-100 py-12 text-center">
                            <InboxIcon className="h-10 w-10 text-foreground/20" />
                            <p className="text-sm text-foreground/50">No polls found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {filteredPolls.map((poll, i) => {
                                const total = poll.totalVotes || 1;
                                const inPct = Math.round((poll.inVotes / total) * 100);
                                const outPct = Math.round((poll.outVotes / total) * 100);
                                const soloPct = Math.round((poll.soloVotes / total) * 100);

                                return (
                                    <motion.div
                                        key={poll.id}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.02 }}
                                    >
                                        <Card className="border border-divider h-full">
                                            <CardHeader className="justify-between pb-1">
                                                <div className="flex flex-col gap-0.5 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <Vote className="h-4 w-4 shrink-0 text-primary" />
                                                        <h3 className="text-sm font-semibold truncate">
                                                            {poll.tournament?.name ?? poll.question}
                                                        </h3>
                                                    </div>
                                                    <span className="ml-6 text-[11px] text-foreground/40">
                                                        {poll.tournament && poll.tournament.fee > 0 ? `${poll.tournament.fee} ${GAME.currency} · ` : ""}{poll.days}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Chip
                                                        size="sm"
                                                        variant="flat"
                                                        color={poll.isActive ? "success" : "default"}
                                                        startContent={
                                                            poll.isActive ? (
                                                                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                                                            ) : (
                                                                <CheckCircle2 className="h-3 w-3" />
                                                            )
                                                        }
                                                    >
                                                        {poll.isActive ? "Active" : "Closed"}
                                                    </Chip>
                                                    {GAME.features.hasTeamSizes && (
                                                        <Chip
                                                            size="sm"
                                                            variant="flat"
                                                            className="text-[10px]"
                                                        >
                                                            {poll.teamType}
                                                        </Chip>
                                                    )}
                                                </div>
                                            </CardHeader>
                                            <Divider />
                                            <CardBody className="space-y-3 pt-3">
                                                {/* Vote distribution */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-success">IN {poll.inVotes}</span>
                                                        {GAME.features.hasTeamSizes && (
                                                            <span className="text-warning">SOLO {poll.soloVotes}</span>
                                                        )}
                                                        <span className="text-danger">OUT {poll.outVotes}</span>
                                                    </div>
                                                    <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                                                        <div
                                                            className="bg-success transition-all"
                                                            style={{ width: `${inPct}%` }}
                                                        />
                                                        {GAME.features.hasTeamSizes && (
                                                            <div
                                                                className="bg-warning transition-all"
                                                                style={{ width: `${soloPct}%` }}
                                                            />
                                                        )}
                                                        <div
                                                            className="bg-danger transition-all"
                                                            style={{ width: `${outPct}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Meta + Generate button */}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4 text-xs text-foreground/40">
                                                        <span className="flex items-center gap-1">
                                                            <Users className="h-3 w-3" />
                                                            {poll.totalVotes} votes
                                                        </span>
                                                        <span>
                                                            {new Date(poll.createdAt).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            variant="flat"
                                                            isIconOnly
                                                            className="min-w-0 h-7 w-7"
                                                            onPress={() => { setEditingPoll(poll); setFormOpen(true); }}
                                                        >
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        {poll.tournament && (
                                                            <DiscordAnnounceButton pollId={poll.id} />
                                                        )}
                                                        {poll.tournament && poll.tournament.type === "BR" && (
                                                            <Button
                                                                size="sm"
                                                                variant="flat"
                                                                color="primary"
                                                                startContent={<Swords className="h-3 w-3" />}
                                                                className="min-w-0 h-7 px-2 text-xs"
                                                                onPress={() => fetchPreview(poll)}
                                                            >
                                                                Teams
                                                            </Button>
                                                        )}
                                                        {poll.tournament && ["BRACKET_1V1", "LEAGUE", "GROUP_KNOCKOUT"].includes(poll.tournament.type) && (
                                                            <BracketButton
                                                                tournamentId={poll.tournament.id}
                                                                tournamentName={poll.tournament.name}
                                                                disabled={poll.inVotes < 2}
                                                                onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-polls"] })}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            </CardBody>
                                        </Card>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Preview Modal */}
            <PollTeamsPreviewModal
                isOpen={previewOpen}
                onClose={() => {
                    setPreviewOpen(false);
                    setJobStatus("idle");
                }}
                previewData={previewData}
                isLoading={previewLoading}
                jobStatus={jobStatus}
                onConfirm={handleConfirm}
                onRegenerate={handleRegenerate}
                error={previewError}
                allowSquads={activePoll?.allowSquads ?? false}
            />

            {/* Create/Edit Poll Modal */}
            <PollFormModal
                isOpen={formOpen}
                onClose={() => setFormOpen(false)}
                poll={editingPoll}
                onSaved={() => {
                    queryClient.invalidateQueries({ queryKey: ["admin-polls"] });
                }}
            />
        </div>
    );
}

/* ─── Bracket Button (inline loading, no confirm modal) ───── */
function BracketButton({
    tournamentId,
    tournamentName,
    disabled,
    onSuccess,
}: {
    tournamentId: string;
    tournamentName: string;
    disabled: boolean;
    onSuccess: () => void;
}) {
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/generate-bracket`, { method: "POST" });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || json.error || "Failed");
            toast.success(json.message || `Bracket generated for ${tournamentName}`);
            onSuccess();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            size="sm"
            variant="flat"
            color="secondary"
            startContent={!loading ? <Swords className="h-3 w-3" /> : undefined}
            className="min-w-0 h-7 px-2 text-xs"
            isDisabled={disabled}
            isLoading={loading}
            onPress={handleGenerate}
        >
            Bracket
        </Button>
    );
}

/* ─── Discord Announce Button ─────────────────────────────── */
function DiscordAnnounceButton({ pollId }: { pollId: string }) {
    const [loading, setLoading] = useState(false);

    const handleAnnounce = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/discord/announce-poll", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pollId }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed");
            toast.success("Announced on Discord!");
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            size="sm"
            variant="flat"
            isIconOnly
            className="min-w-0 h-7 w-7"
            isLoading={loading}
            onPress={handleAnnounce}
            title="Announce on Discord"
        >
            <Send className="h-3 w-3" />
        </Button>
    );
}
