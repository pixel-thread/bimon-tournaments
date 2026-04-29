"use client";

import { useState } from "react";
import { usePolls, useVote, useEntryMutation } from "@/hooks/use-polls";
import { PollCard } from "@/components/vote/poll-card";
import { MeritRatingSection } from "@/components/vote/merit-rating-gate";
import { RoomInfoGenerator } from "@/components/vote/room-info-generator";
import { VotePageJobListings } from "@/components/vote/vote-page-jobs";
import { AdSlot } from "@/components/common/AdSlot";
import { Skeleton, Card, CardBody, Divider } from "@heroui/react";
import { Vote, AlertCircle } from "lucide-react";
import { useAuthGate } from "@/components/common/auth-gate-provider";
import { GAME } from "@/lib/game-config";
import { ArenaDropdown } from "@/components/players/arena-dropdown";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";

type TabKey = "casual" | "ranked" | "tdm" | "wow";

const SPRING = { type: "spring" as const, stiffness: 500, damping: 35 };

/**
 * /vote — Tournament voting page.
 * Merit rating section on top, Casual/Ranked tabs, polls below, then community job listings.
 */
export default function VotePage() {
    const { data, isLoading, error, refetch } = usePolls();
    const voteMutation = useVote();
    const entryMutation = useEntryMutation();
    const { requireAuth } = useAuthGate();
    const [tab, setTab] = useState<TabKey>("casual");

    const polls = data?.polls;
    const currentPlayerId = data?.currentPlayerId ?? undefined;
    const isCouponVerifier = data?.isCouponVerifier ?? false;
    const isUCExempt = data?.isUCExempt ?? false;
    const pendingPollId = voteMutation.isPending ? voteMutation.variables?.pollId : undefined;
    const pendingVote = voteMutation.isPending ? voteMutation.variables?.vote : undefined;

    // Filter polls by tab
    const tdmCount = polls?.filter((p: any) => p.tournament?.isTDM && !p.tournament?.isWoW).length ?? 0;
    const wowCount = polls?.filter((p: any) => p.tournament?.isWoW).length ?? 0;
    const casualCount = polls?.filter((p: any) => !p.allowSquads && !p.tournament?.isTDM && !p.tournament?.isWoW).length ?? 0;
    const rankedCount = polls?.filter((p: any) => p.allowSquads && !p.tournament?.isTDM && !p.tournament?.isWoW).length ?? 0;
    const hasBothTypes = (casualCount > 0 && rankedCount > 0) || (GAME.features.hasTDM && tdmCount > 0) || (GAME.features.hasWoW && wowCount > 0);
    const filteredPolls = hasBothTypes
        ? polls?.filter((p: any) => {
            if (tab === "tdm") return !!p.tournament?.isTDM && !p.tournament?.isWoW;
            if (tab === "wow") return !!p.tournament?.isWoW;
            if (tab === "ranked") return p.allowSquads && !p.tournament?.isTDM && !p.tournament?.isWoW;
            return !p.allowSquads && !p.tournament?.isTDM && !p.tournament?.isWoW;
        })
        : polls;

    function handleTabChange(newTab: TabKey) {
        setTab(newTab);
    }

    function handleVote(pollId: string, vote: "IN" | "OUT" | "SOLO") {
        requireAuth(() => voteMutation.mutate({ pollId, vote }));
    }

    // Tabs definition
    const tabs: { key: TabKey; label: string; icon: string; count: number }[] = [
        { key: "casual", label: "Casual", icon: "🎮", count: casualCount },
        { key: "ranked", label: "Ranked", icon: "🏆", count: rankedCount },
    ];



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

            {/* ── Room Info Generator (UC-exempt room creators only) ── */}
            {isUCExempt && (
                <RoomInfoGenerator />
            )}

            {/* ── Casual / Ranked Tabs (premium animated) ── */}
            {hasBothTypes && (
            <div className="flex items-center justify-center gap-1 p-1 rounded-xl bg-default-100 mb-4 relative">
                {tabs.map(({ key, label, icon, count }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => handleTabChange(key)}
                        className="flex-1 relative flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium cursor-pointer z-[1]"
                    >
                        {/* Sliding background indicator */}
                        {tab === key && (
                            <motion.div
                                layoutId="vote-tab-indicator"
                                className="absolute inset-0 bg-background rounded-lg shadow-sm"
                                style={{ zIndex: -1 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 500,
                                    damping: 35,
                                    mass: 0.8,
                                }}
                            />
                        )}
                        <motion.span
                            animate={{ scale: tab === key ? 1.05 : 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        >
                            {icon}
                        </motion.span>
                        <motion.span
                            animate={{
                                color: tab === key ? "var(--foreground)" : "var(--foreground-500)",
                            }}
                            transition={{ duration: 0.2 }}
                        >
                            {label}
                        </motion.span>
                        {!isLoading && count > 0 && (
                            <motion.span
                                className={`
                                    ml-0.5 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1
                                    ${tab === key ? "bg-primary/10 text-primary" : "bg-foreground/10 text-foreground/40"}
                                `}
                                animate={{
                                    scale: tab === key ? 1 : 0.9,
                                    opacity: tab === key ? 1 : 0.7,
                                }}
                                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            >
                                {count}
                            </motion.span>
                        )}
                    </button>
                ))}
                {(GAME.features.hasTDM || GAME.features.hasWoW) && (tdmCount > 0 || wowCount > 0) && (
                    <ArenaDropdown
                        teamMode={tab}
                        onSelect={(mode) => handleTabChange(mode)}
                        hasTDM={GAME.features.hasTDM && tdmCount > 0}
                        hasWoW={GAME.features.hasWoW && wowCount > 0}
                    />
                )}
            </div>
            )}

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
                        <motion.div
                            key={`empty-${tab}`}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="flex flex-col items-center gap-3 rounded-xl bg-default-100 py-12 text-center"
                        >
                            <Vote className="h-10 w-10 text-foreground/20" />
                            <div>
                                <p className="font-medium text-foreground/60">
                                    No {tab === "ranked" ? "ranked" : tab === "tdm" ? "TDM" : tab === "wow" ? "WoW" : "casual"} polls
                                </p>
                                <p className="text-sm text-foreground/40">
                                    {tab === "ranked"
                                        ? "No squad tournaments right now"
                                        : tab === "tdm"
                                            ? "No team deathmatch tournaments right now"
                                            : tab === "wow"
                                                ? "No World of Wonder tournaments right now"
                                                : "Check back later for upcoming tournaments"}
                                </p>
                            </div>
                            <AdSlot format="banner" className="mt-4 w-full rounded-lg overflow-hidden" />
                        </motion.div>
                    ) : (
                        filteredPolls.map((poll, i) => (
                            <PollCard
                                key={`poll-slot-${i}`}
                                poll={poll}
                                onVote={handleVote}
                                votingPollId={pendingPollId}
                                votingVote={pendingVote}
                                currentPlayerId={currentPlayerId}
                                onRefetch={() => refetch()}
                                onEntryChange={(pollId, action) => entryMutation.mutate({ pollId, action })}
                                entryPending={entryMutation.isPending && entryMutation.variables?.pollId === poll.id}
                                isCouponVerifier={isCouponVerifier}
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
