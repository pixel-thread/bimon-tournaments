"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { Gift, Shield, ChevronUp, X, Loader2, Check, Crown, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

interface SquadInvite {
    id: string;
    squad: {
        id: string;
        name: string;
        captain: { displayName: string | null };
        poll: { tournament: { name: string } | null };
    };
}

interface UnclaimedReward {
    id: string;
    type: string;
    amount: number;
    diamondAmount?: number;
    message?: string;
    position?: number;
}

interface NotifData {
    unclaimedRewards?: UnclaimedReward[];
    pendingSquadInvites?: SquadInvite[];
    pendingSquadRequests?: any[];
    hasUnclaimedStreak?: boolean;
}

/**
 * ActionCenter — Root-level floating component that surfaces pending actions.
 * Reads from the existing `notification-count` cache (zero extra API calls).
 * Shows one-click actions with loader → auto-dismiss.
 */
export function ActionCenter() {
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    const [dismissed, setDismissed] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [completedIds, setCompletedIds] = useState<Set<string>>(() => {
        try {
            const skipped = JSON.parse(sessionStorage.getItem("ac-skipped") || "[]");
            return new Set(skipped);
        } catch { return new Set(); }
    });

    // Refetch on route change (page navigation) — no polling needed
    const pathname = usePathname();
    useEffect(() => {
        queryClient.invalidateQueries({ queryKey: ["notification-count"] });
    }, [pathname, queryClient]);

    // Subscribe to the same "notification-count" cache that the header populates.
    // Both share queryKey + staleTime:Infinity so only one network call fires.
    // queryFn must produce the same shape as header.tsx so the cache is consistent.
    const { data: notifData } = useQuery<NotifData>({
        queryKey: ["notification-count"],
        queryFn: async () => {
            const res = await fetch("/api/notifications");
            if (!res.ok) return {};
            const json = await res.json();
            return {
                unreadCount: json.data?.unreadCount ?? 0,
                unclaimedRewardCount: json.data?.unclaimedRewards?.length ?? 0,
                unclaimedRewards: json.data?.unclaimedRewards ?? [],
                hasUnclaimedStreak: json.data?.hasUnclaimedStreakReward ?? false,
                pendingSquadInviteCount: json.data?.pendingSquadInviteCount ?? 0,
                pendingSquadInvites: json.data?.pendingSquadInvites ?? [],
                pendingSquadRequests: json.data?.pendingSquadRequests ?? [],
            };
        },
        enabled: !!session?.user,
        staleTime: Infinity,
        refetchOnWindowFocus: "always", // refetch when user returns to tab
    });

    const rewards = (notifData?.unclaimedRewards ?? []).filter(r => !completedIds.has(r.id));
    const squadInvites = (notifData?.pendingSquadInvites ?? []).filter(r => !completedIds.has(r.id));
    const hasUnclaimedStreak = !!(notifData?.hasUnclaimedStreak) && !completedIds.has("streak");

    const totalActions = rewards.length + squadInvites.length + (hasUnclaimedStreak ? 1 : 0);

    // Auto-expand when there are actions (once per session)
    useEffect(() => {
        if (totalActions > 0 && !dismissed) {
            const shown = sessionStorage.getItem("action-center-shown");
            if (!shown) {
                setExpanded(true);
                sessionStorage.setItem("action-center-shown", "1");
            }
        }
    }, [totalActions, dismissed]);

    // Re-surface the pill if new actions arrive after a dismiss
    const prevActionsRef = useRef(totalActions);
    useEffect(() => {
        if (totalActions > prevActionsRef.current && dismissed) {
            setDismissed(false);
            setExpanded(true);
        }
        prevActionsRef.current = totalActions;
    }, [totalActions, dismissed]);

    // Mark as completed + auto-remove after animation
    const markCompleted = useCallback((id: string) => {
        setCompletedIds(prev => new Set(prev).add(id));
        setProcessingId(null);
    }, []);

    // Invalidate caches after action
    const refreshCaches = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["notification-count"] });
        queryClient.invalidateQueries({ queryKey: ["squads"] });
        queryClient.invalidateQueries({ queryKey: ["auth-user"] });
    }, [queryClient]);

    // ── Claim reward ──
    const handleClaim = useCallback(async (reward: UnclaimedReward) => {
        setProcessingId(reward.id);
        try {
            const res = await fetch(`/api/rewards/${reward.id}/claim`, { method: "POST" });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.message || "Failed to claim");
            }
            toast.success(`🎉 Claimed ${reward.amount} ${GAME.currencyPlural}!`);
            markCompleted(reward.id);
            refreshCaches();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to claim reward");
            setProcessingId(null);
        }
    }, [markCompleted, refreshCaches]);

    // ── Accept squad invite ──
    const handleAcceptInvite = useCallback(async (invite: SquadInvite) => {
        setProcessingId(invite.id);
        try {
            const res = await fetch("/api/squads/respond", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inviteId: invite.id, action: "ACCEPT" }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.message || "Failed to accept");
            toast.success(json.message || `Joined "${invite.squad.name}"!`);
            markCompleted(invite.id);
            refreshCaches();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to accept invite");
            setProcessingId(null);
        }
    }, [markCompleted, refreshCaches]);

    // ── Skip squad invite (just hide from Action Center — invite stays PENDING) ──
    const handleSkipInvite = useCallback((invite: SquadInvite) => {
        markCompleted(invite.id);
        // Remember skipped invites so they don't reappear in this session
        try {
            const skipped = JSON.parse(sessionStorage.getItem("ac-skipped") || "[]");
            skipped.push(invite.id);
            sessionStorage.setItem("ac-skipped", JSON.stringify(skipped));
        } catch {}
    }, [markCompleted]);

    // Don't render if no session, no actions, or dismissed
    if (!session?.user || totalActions === 0 || dismissed) return null;

    return (
        <div className="fixed bottom-[68px] lg:bottom-4 left-0 right-0 z-[45] flex justify-center px-3 pointer-events-none">
            <AnimatePresence mode="wait">
                {!expanded ? (
                    // ── Floating pill ──
                    <motion.button
                        key="pill"
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        onClick={() => setExpanded(true)}
                        className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full bg-background/90 backdrop-blur-xl border border-divider shadow-lg shadow-black/10 active:scale-95 transition-transform"
                    >
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="absolute inset-0 rounded-full bg-danger animate-ping opacity-75" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-danger" />
                        </span>
                        <span className="text-sm font-semibold">
                            {totalActions} pending {totalActions === 1 ? "action" : "actions"}
                        </span>
                        <ChevronUp className="h-3.5 w-3.5 text-foreground/40" />
                    </motion.button>
                ) : (
                    // ── Expanded card ──
                    <motion.div
                        key="card"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="pointer-events-auto w-full max-w-md rounded-2xl bg-background/95 backdrop-blur-xl border border-divider shadow-2xl shadow-black/15 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-divider">
                            <span className="text-sm font-bold flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inset-0 rounded-full bg-danger animate-ping opacity-75" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
                                </span>
                                Action Center
                            </span>
                            <button
                                onClick={() => { setExpanded(false); setDismissed(true); }}
                                className="p-1 rounded-lg hover:bg-default-100 transition-colors text-foreground/40 hover:text-foreground/60"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Items */}
                        <div className="max-h-[280px] overflow-y-auto divide-y divide-divider">
                            {/* Squad invites */}
                            {squadInvites.map((invite) => (
                                <div key={invite.id} className="flex items-center gap-3 px-4 py-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                                        <Shield className="h-4 w-4 game-text" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate">{invite.squad.name}</p>
                                        <p className="text-[11px] text-foreground/40 truncate">
                                            {invite.squad.captain.displayName} invited you · {invite.squad.poll?.tournament?.name}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            onClick={() => handleSkipInvite(invite)}
                                            disabled={!!processingId}
                                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-foreground/40 hover:text-foreground/60 hover:bg-default-100 transition-colors disabled:opacity-40"
                                        >
                                            Later
                                        </button>
                                        <button
                                            onClick={() => handleAcceptInvite(invite)}
                                            disabled={!!processingId}
                                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/15 text-primary hover:bg-primary/25 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                                        >
                                            {processingId === invite.id ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Check className="h-3.5 w-3.5" />
                                            )}
                                            Join
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {/* Unclaimed rewards */}
                            {rewards.map((reward) => {
                                const label = reward.type === "WINNER" ? "🏆 Prize"
                                    : reward.type === "SOLO_SUPPORT" ? "💚 Solo Support"
                                    : reward.type === "REFERRAL" ? "🎁 Referral"
                                    : "🎉 Reward";
                                return (
                                    <div key={reward.id} className="flex items-center gap-3 px-4 py-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/10 shrink-0">
                                            <Gift className="h-4 w-4 text-success" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate">
                                                {label} — {reward.amount} <CurrencyIcon size={12} />
                                            </p>
                                            {reward.message && (
                                                <p className="text-[11px] text-foreground/40 truncate">{reward.message}</p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleClaim(reward)}
                                            disabled={!!processingId}
                                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-success/15 text-success hover:bg-success/25 transition-colors disabled:opacity-40 shrink-0 flex items-center gap-1.5"
                                        >
                                            {processingId === reward.id ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Gift className="h-3.5 w-3.5" />
                                            )}
                                            Claim
                                        </button>
                                    </div>
                                );
                            })}

                            {/* Battle Pass / Royal Pass unclaimed streak */}
                            {hasUnclaimedStreak && (
                                <div className="flex items-center gap-3 px-4 py-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10 shrink-0">
                                        <Crown className="h-4 w-4 text-amber-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate">👑 Royal Pass Reward</p>
                                        <p className="text-[11px] text-foreground/40 truncate">Unclaimed streak reward available</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            markCompleted("streak");
                                            window.location.assign("/royal-pass");
                                        }}
                                        disabled={!!processingId}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 transition-colors disabled:opacity-40 shrink-0"
                                    >
                                        Claim
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Collapse */}
                        <button
                            onClick={() => setExpanded(false)}
                            className="w-full py-2 text-[11px] text-foreground/30 hover:text-foreground/50 transition-colors border-t border-divider"
                        >
                            Minimize
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
