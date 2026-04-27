"use client";

import { useState } from "react";
import { usePolls, useVote, useEntryMutation } from "@/hooks/use-polls";
import { PollCard } from "@/components/vote/poll-card";
import { MeritRatingSection } from "@/components/vote/merit-rating-gate";
import { VotePageJobListings } from "@/components/vote/vote-page-jobs";
import { AdSlot } from "@/components/common/AdSlot";
import { Skeleton, Card, CardBody, Divider } from "@heroui/react";
import { Vote, AlertCircle } from "lucide-react";
import { useAuthGate } from "@/components/common/auth-gate-provider";

/**
 * /vote — Tournament voting page.
 * Merit rating section on top, Casual/Ranked tabs, polls below, then community job listings.
 */
export default function VotePage() {
    const { data, isLoading, error, refetch } = usePolls();
    const voteMutation = useVote();
    const entryMutation = useEntryMutation();
    const { requireAuth } = useAuthGate();
    const [tab, setTab] = useState<"casual" | "ranked">("casual");

    const polls = data?.polls;
    const currentPlayerId = data?.currentPlayerId ?? undefined;
    const pendingPollId = voteMutation.isPending ? voteMutation.variables?.pollId : undefined;
    const pendingVote = voteMutation.isPending ? voteMutation.variables?.vote : undefined;

    // Filter polls by tab
    const filteredPolls = polls?.filter((p) =>
        tab === "ranked" ? p.allowSquads : !p.allowSquads
    );

    // Count polls per tab (for badges)
    const casualCount = polls?.filter((p) => !p.allowSquads).length ?? 0;
    const rankedCount = polls?.filter((p) => p.allowSquads).length ?? 0;

    function handleVote(pollId: string, vote: "IN" | "OUT" | "SOLO") {
        requireAuth(() => voteMutation.mutate({ pollId, vote }));
    }

    return (
        <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
            <div className="mb-6 space-y-1">
                <div className="flex items-center gap-2">
                    <Vote className="h-5 w-5 game-text" />
                    <h1 className="text-lg font-bold">Tournament Polls</h1>
                </div>
                <p className="text-sm text-foreground/50">
                    Vote on upcoming tournaments to secure your spot
                </p>
            </div>

            {/* ── Merit Rating (non-blocking, above polls) ────── */}
            <MeritRatingSection />

            {/* ── Casual / Ranked Tabs ──────────────────────── */}
            <div className="flex items-center justify-center gap-1 p-1 rounded-xl bg-default-100 mb-4">
                {([
                    { key: "casual" as const, label: "Casual", icon: "🎮", count: casualCount },
                    { key: "ranked" as const, label: "Ranked", icon: "🏆", count: rankedCount },
                ]).map(({ key, label, icon, count }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setTab(key)}
                        className={`
                            flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium
                            transition-all duration-200 cursor-pointer
                            ${tab === key
                                ? "bg-background shadow-sm text-foreground"
                                : "text-foreground/50 hover:text-foreground/70"
                            }
                        `}
                    >
                        <span>{icon}</span>
                        <span>{label}</span>
                        {!isLoading && count > 0 && (
                            <span className={`
                                ml-0.5 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1
                                ${tab === key ? "bg-primary/10 text-primary" : "bg-foreground/10 text-foreground/40"}
                            `}>
                                {count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Polls ──────────────────────────────────────── */}
            {isLoading && (
                <div className="space-y-4">
                    {[1, 2].map((i) => (
                        <Card key={i} className="border border-divider">
                            <CardBody className="space-y-4 p-4">
                                <Skeleton className="h-5 w-2/3 rounded" />
                                <Skeleton className="h-3 w-1/3 rounded" />
                                <Skeleton className="h-2 w-full rounded-full" />
                                <div className="flex gap-2">
                                    <Skeleton className="h-8 flex-1 rounded-lg" />
                                    <Skeleton className="h-8 flex-1 rounded-lg" />
                                    <Skeleton className="h-8 flex-1 rounded-lg" />
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 rounded-lg bg-danger-50 p-4 text-sm text-danger dark:bg-danger-50/10">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Failed to load polls. Please try again later.
                </div>
            )}

            {filteredPolls && (
                <div className="space-y-4">
                    {filteredPolls.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 rounded-xl bg-default-100 py-12 text-center">
                            <Vote className="h-10 w-10 text-foreground/20" />
                            <div>
                                <p className="font-medium text-foreground/60">
                                    No {tab === "ranked" ? "ranked" : "casual"} polls
                                </p>
                                <p className="text-sm text-foreground/40">
                                    {tab === "ranked"
                                        ? "No squad tournaments right now"
                                        : "Check back later for upcoming tournaments"}
                                </p>
                            </div>
                            <AdSlot format="banner" className="mt-4 w-full rounded-lg overflow-hidden" />
                        </div>
                    ) : (
                        filteredPolls.map((poll) => (
                            <PollCard
                                key={poll.id}
                                poll={poll}
                                onVote={handleVote}
                                votingPollId={pendingPollId}
                                votingVote={pendingVote}
                                currentPlayerId={currentPlayerId}
                                onRefetch={() => refetch()}
                                onEntryChange={(pollId, action) => entryMutation.mutate({ pollId, action })}
                                entryPending={entryMutation.isPending && entryMutation.variables?.pollId === poll.id}
                            />
                        ))
                    )}
                </div>
            )}

            {/* ── Ad (non-intrusive, collapses if empty) ──── */}
            <AdSlot format="banner" className="my-6 rounded-xl overflow-hidden" />

            {/* ── Divider ────────────────────────────────────── */}
            <Divider className="my-8" />

            {/* ── Job Listings ────────────────────────────────── */}
            <VotePageJobListings />
        </div>
    );
}

