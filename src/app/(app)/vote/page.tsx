"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
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
import { WhatsAppJoinModal } from "@/components/common/WhatsAppJoinModal";
import { useQuery } from "@tanstack/react-query";

type TabKey = "casual" | "ranked" | "tdm" | "wow";

const SPRING = { type: "spring" as const, stiffness: 500, damping: 35 };

const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

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

    // WhatsApp casual room ID modal
    const [showCasualWA, setShowCasualWA] = useState(false);
    const hasSeenCasualWA = useRef(false);

    const polls = data?.polls;
    const currentPlayerId = data?.currentPlayerId ?? undefined;
    const isCouponVerifier = data?.isCouponVerifier ?? false;
    const isUCExempt = data?.isUCExempt ?? false;
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

    // Check if player has acknowledged the casual WA group
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

            {/* ── Casual WhatsApp Room ID Banner ── */}
            {tab === "casual" && casualRoomIdLink && (
                <a
                    href={casualRoomIdLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 mb-4 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors"
                >
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <WhatsAppIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            Join WhatsApp for Room ID & Password
                        </p>
                        <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/60">
                            Get match details before each casual tournament
                        </p>
                    </div>
                </a>
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
