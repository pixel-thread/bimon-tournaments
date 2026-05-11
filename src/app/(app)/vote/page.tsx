"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { usePolls, useVote, useEntryMutation } from "@/hooks/use-polls";
import { PollCard } from "@/components/vote/poll-card";

import { MeritRatingSection } from "@/components/vote/merit-rating-gate";

import { VotePageJobListings } from "@/components/vote/vote-page-jobs";
import { AdSlot } from "@/components/common/AdSlot";
import { Skeleton, Card, CardBody, Divider } from "@heroui/react";
import { Vote, AlertCircle } from "lucide-react";
import { useAuthGate } from "@/components/common/auth-gate-provider";
import { ModeTabs } from "@/components/common/ModeTabs";
import { GAME } from "@/lib/game-config";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import { WhatsAppJoinModal } from "@/components/common/WhatsAppJoinModal";
import { useQuery } from "@tanstack/react-query";

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
    const searchParams = useSearchParams();
    const [tab, setTab] = useState<TabKey>(() => {
        const t = searchParams.get("tab");
        if (t === "ranked" || t === "casual" || t === "tdm" || t === "wow") return t;
        return "casual";
    });
    const scrolledRef = useRef(false);
    // Accordion: only one poll expanded when multiple exist in a tab
    const [expandedPollId, setExpandedPollId] = useState<string | null>(null);

    const [showCasualWA, setShowCasualWA] = useState(false);
    const hasSeenCasualWA = useRef(false);

    const polls = data?.polls;
    const currentPlayerId = data?.currentPlayerId ?? undefined;
    const isCouponVerifier = data?.isCouponVerifier ?? false;
    const pendingPollId = voteMutation.isPending ? voteMutation.variables?.pollId : undefined;
    const pendingVote = voteMutation.isPending ? voteMutation.variables?.vote : undefined;

    // Fetch the casual room ID group link from public settings
    const { data: publicSettings } = useQuery({
        queryKey: ["public-settings"],
        queryFn: async () => {
            const res = await fetch("/api/settings/public");
            if (!res.ok) return {};
            const json = await res.json();
            return json.data ?? {};
        },
        staleTime: 5 * 60 * 1000,
    });
    const casualRoomIdLink = (publicSettings?.whatsAppGroups || [])[1] || "";

    // Check if player has seen the casual WA first-time modal
    useEffect(() => {
        hasSeenCasualWA.current = !!localStorage.getItem("casual_wa_seen");
    }, []);

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

    // Auto-scroll to a specific poll card when ?poll= is present
    useEffect(() => {
        const targetPollId = searchParams.get("poll");
        if (!targetPollId || !filteredPolls || scrolledRef.current) return;

        // Wait a tick for DOM to render
        const timer = setTimeout(() => {
            const el = document.querySelector(`[data-poll-id="${targetPollId}"]`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                // Brief highlight
                el.classList.add("ring-2", "ring-primary/40", "rounded-xl");
                setTimeout(() => el.classList.remove("ring-2", "ring-primary/40", "rounded-xl"), 2000);
                scrolledRef.current = true;
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [filteredPolls, searchParams]);

    // Wrap vote to show first-time casual WA modal
    const handleVote = useCallback((pollId: string, vote: "IN" | "OUT" | "SOLO") => {
        requireAuth(() => {
            // Check if this is a casual poll and player hasn't seen the WA modal yet
            if (casualRoomIdLink && !hasSeenCasualWA.current) {
                const poll = polls?.find((p: any) => p.id === pollId);
                if (poll && !poll.allowSquads && !poll.tournament?.isTDM && !poll.tournament?.isWoW) {
                    // Show the WA modal, then vote goes through
                    hasSeenCasualWA.current = true;
                    localStorage.setItem("casual_wa_seen", "1");
                    setShowCasualWA(true);
                }
            }
            voteMutation.mutate({ pollId, vote });
        });
    }, [requireAuth, voteMutation, casualRoomIdLink, polls]);

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



            {/* ── Casual / Ranked Tabs (premium animated) ── */}
            {hasBothTypes && (
                <div className="mb-4">
                    <ModeTabs
                        mode={tab}
                        onSelect={(m) => handleTabChange(m as TabKey)}
                        counts={{ casual: casualCount, ranked: rankedCount, tdm: tdmCount, wow: wowCount }}
                        hideEmpty
                        isLoading={isLoading}
                        layoutId="vote-tab-indicator"
                    />
                </div>
            )}



            {/* ── First-time casual WhatsApp modal ── */}
            {showCasualWA && casualRoomIdLink && (
                <WhatsAppJoinModal
                    isOpen={showCasualWA}
                    onClose={() => setShowCasualWA(false)}
                    mandatory={false}
                    groups={[{
                        id: "casual-room",
                        name: "🎮 Casual Room ID",
                        link: casualRoomIdLink,
                    }]}
                />
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
                        filteredPolls.map((poll, i) => {
                            const isMultiple = filteredPolls.length >= 2;
                            return (
                            <div key={`poll-slot-${i}`} data-poll-id={poll.id}>
                                <PollCard
                                    poll={poll}
                                    onVote={handleVote}
                                    votingPollId={pendingPollId}
                                    votingVote={pendingVote}
                                    currentPlayerId={currentPlayerId}
                                    onRefetch={() => refetch()}
                                    onEntryChange={(pollId, action) => entryMutation.mutate({ pollId, action })}
                                    entryPending={entryMutation.isPending && entryMutation.variables?.pollId === poll.id}
                                    isCouponVerifier={isCouponVerifier}
                                    {...(isMultiple ? {
                                        isExpanded: expandedPollId === poll.id,
                                        onToggleExpand: () => setExpandedPollId(
                                            expandedPollId === poll.id ? null : poll.id
                                        ),
                                    } : {})}
                                />
                            </div>
                            );
                        })
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
