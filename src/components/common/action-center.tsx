"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { Gift, X, Check, Crown, UserPlus } from "lucide-react";
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

interface SquadJoinRequest {
    id: string;
    player: {
        id: string;
        displayName: string | null;
        customProfileImageUrl: string | null;
        user: { username: string; imageUrl: string | null };
    };
    squad: {
        id: string;
        name: string;
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
    pendingSquadRequests?: SquadJoinRequest[];
    hasUnclaimedStreak?: boolean;
}

/**
 * ActionCenter — Centered fullscreen overlay that surfaces pending actions.
 * Triggered by the ⚡ header button or auto-shown on first load if actions exist.
 */
export function ActionCenter() {
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
    const lastAutoShownPath = useRef<string | null>(null);

    // Listen for header button click
    useEffect(() => {
        const handler = () => setIsOpen(true);
        window.addEventListener("open-action-center", handler);
        return () => window.removeEventListener("open-action-center", handler);
    }, []);

    // Refetch on route change (page navigation)
    const pathname = usePathname();
    useEffect(() => {
        queryClient.invalidateQueries({ queryKey: ["notification-count"] });
    }, [pathname, queryClient]);

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
        refetchOnMount: "always",
        refetchOnWindowFocus: "always",
    });

    const rewards = (notifData?.unclaimedRewards ?? []).filter(r => !completedIds.has(r.id));
    const squadInvites = (notifData?.pendingSquadInvites ?? []).filter(r => !completedIds.has(r.id));
    const squadRequests = (notifData?.pendingSquadRequests ?? []).filter(r => !completedIds.has(r.id));
    const hasUnclaimedStreak = !!(notifData?.hasUnclaimedStreak) && !completedIds.has("streak");

    const totalActions = rewards.length + squadInvites.length + squadRequests.length + (hasUnclaimedStreak ? 1 : 0);

    // Auto-show only on page navigation or first visit — NOT on background refetches
    useEffect(() => {
        if (totalActions > 0 && lastAutoShownPath.current !== pathname) {
            setIsOpen(true);
            lastAutoShownPath.current = pathname;
        }
    }, [totalActions, pathname]);

    const markCompleted = useCallback((id: string) => {
        setCompletedIds(prev => new Set(prev).add(id));
    }, []);

    const refreshCaches = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["notification-count"] });
        queryClient.invalidateQueries({ queryKey: ["squads"] });
        queryClient.invalidateQueries({ queryKey: ["auth-user"] });
    }, [queryClient]);

    // ── Claim reward ──
    const handleClaim = useCallback(async (reward: UnclaimedReward) => {
        // Optimistic: remove card immediately
        markCompleted(reward.id);
        try {
            const res = await fetch(`/api/rewards/${reward.id}/claim`, { method: "POST" });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.message || "Failed to claim");
            }
            toast.success(`🎉 Claimed ${reward.amount} ${GAME.currencyPlural}!`);
            refreshCaches();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to claim reward");
            setCompletedIds(prev => { const next = new Set(prev); next.delete(reward.id); return next; });
        }
    }, [markCompleted, refreshCaches]);

    // ── Accept squad invite (player accepting captain's invite) ──
    const handleAcceptInvite = useCallback(async (invite: SquadInvite) => {
        // Optimistic: remove card immediately
        markCompleted(invite.id);
        try {
            const res = await fetch("/api/squads/respond", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inviteId: invite.id, action: "ACCEPT" }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.message || "Failed to accept");
            toast.success(json.message || `Joined "${invite.squad.name}"!`);
            refreshCaches();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to accept invite");
            // Roll back: remove from completed so card reappears
            setCompletedIds(prev => { const next = new Set(prev); next.delete(invite.id); return next; });
        }
    }, [markCompleted, refreshCaches]);

    // ── Respond to squad join request (captain accepting/declining player's request) ──
    const handleRespondRequest = useCallback(async (req: SquadJoinRequest, action: "ACCEPT" | "DECLINE") => {
        // Optimistic: remove card immediately
        markCompleted(req.id);
        const playerName = req.player.displayName ?? req.player.user.username;
        try {
            const res = await fetch("/api/squads/respond-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inviteId: req.id, action }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.message || "Failed to respond");
            toast.success(action === "ACCEPT"
                ? `✅ ${playerName} added to ${req.squad.name}!`
                : `${playerName} declined`
            );
            refreshCaches();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to respond");
            // Roll back: remove from completed so card reappears
            setCompletedIds(prev => { const next = new Set(prev); next.delete(req.id); return next; });
        }
    }, [markCompleted, refreshCaches]);

    // ── Skip (just close overlay — card reappears on next navigation) ──
    const handleSkip = useCallback(() => {
        setIsOpen(false);
    }, []);

    // Close overlay when all actions are completed
    useEffect(() => {
        if (totalActions === 0 && isOpen) setIsOpen(false);
    }, [totalActions, isOpen]);

    if (!session?.user || !isOpen || totalActions === 0) return null;

    return (
        <AnimatePresence>
            {/* ── Fullscreen backdrop ── */}
            <motion.div
                key="ac-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            >
                {/* ── Centered card ── */}
                <motion.div
                    key="ac-card"
                    initial={{ opacity: 0, scale: 0.9, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: "spring", damping: 22, stiffness: 300 }}
                    className="w-full max-w-sm rounded-3xl bg-background border border-divider shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="relative px-5 pt-5 pb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <span className="relative flex h-3 w-3">
                                    <span className="absolute inset-0 rounded-full bg-danger animate-ping opacity-75" />
                                    <span className="relative inline-flex h-3 w-3 rounded-full bg-danger" />
                                </span>
                                <h2 className="text-base font-extrabold tracking-tight">
                                    ⚡ Action Required
                                </h2>
                            </div>
                            <button
                        onClick={() => setIsOpen(false)}
                                className="p-2 -mr-1 rounded-xl hover:bg-default-100 transition-colors text-foreground/30 hover:text-foreground/60"
                                aria-label="Dismiss"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="text-xs text-foreground/40 mt-1">
                            You have {totalActions} pending {totalActions === 1 ? "item" : "items"}
                        </p>
                    </div>

                    {/* Action items */}
                    <div className="px-4 pb-4 space-y-3 max-h-[60vh] overflow-y-auto">

                        {/* ── Squad invites (player got invited to a team) ── */}
                        {squadInvites.map((invite) => (
                            <div key={invite.id} className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 shrink-0 ring-2 ring-primary/20">
                                        <UserPlus className="h-6 w-6 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-base font-bold truncate">{invite.squad.name}</p>
                                        <p className="text-xs text-foreground/50 truncate">
                                            {invite.squad.captain.displayName} invited you
                                        </p>
                                        <p className="text-[11px] text-foreground/30 truncate">
                                            {invite.squad.poll?.tournament?.name}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSkip}
                                        className="flex-1 py-3 rounded-xl text-sm font-semibold text-foreground/50 bg-foreground/[0.05] hover:bg-foreground/[0.1] active:scale-[0.97] transition-all"
                                    >
                                        Later
                                    </button>
                                    <button
                                        onClick={() => handleAcceptInvite(invite)}
                                        className="flex-[2] py-3 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 active:scale-[0.97] transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
                                    >
                                        <Check className="h-5 w-5" />
                                        Join Team
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* ── Squad join requests (captain sees player requests) ── */}
                        {squadRequests.map((req) => {
                            const playerName = req.player.displayName ?? req.player.user.username;
                            const playerImg = req.player.customProfileImageUrl ?? req.player.user.imageUrl;
                            return (
                                <div key={req.id} className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] p-4 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full shrink-0 ring-2 ring-blue-500/20 overflow-hidden bg-blue-500/15">
                                            {playerImg ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={playerImg} alt={playerName} className="h-full w-full object-cover" />
                                            ) : (
                                                <span className="text-base font-bold text-blue-500">
                                                    {(playerName || "?").charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-base font-bold truncate">{playerName}</p>
                                            <p className="text-xs text-foreground/50 truncate">
                                                Wants to join <span className="font-semibold">{req.squad.name}</span>
                                            </p>
                                            <p className="text-[11px] text-foreground/30 truncate">
                                                {req.squad.poll?.tournament?.name}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleRespondRequest(req, "DECLINE")}
                                            className="flex-1 py-3 rounded-xl text-sm font-semibold text-danger bg-danger/10 hover:bg-danger/20 active:scale-[0.97] transition-all flex items-center justify-center gap-1.5"
                                        >
                                            <X className="h-4 w-4" />
                                            Decline
                                        </button>
                                        <button
                                            onClick={() => handleRespondRequest(req, "ACCEPT")}
                                            className="flex-[2] py-3 rounded-xl text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 active:scale-[0.97] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30"
                                        >
                                            <Check className="h-5 w-5" />
                                            Accept
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* ── Unclaimed rewards ── */}
                        {rewards.map((reward) => {
                            const label = reward.type === "WINNER" ? "🏆 Prize"
                                : reward.type === "SOLO_SUPPORT" ? "💚 Solo Support"
                                : reward.type === "REFERRAL" ? "🎁 Referral"
                                : "🎉 Reward";
                            return (
                                <div key={reward.id} className="rounded-2xl border border-success/20 bg-success/[0.04] p-4 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/15 shrink-0 ring-2 ring-success/20">
                                            <Gift className="h-6 w-6 text-success" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-base font-bold truncate">
                                                {label}
                                            </p>
                                            <p className="text-lg font-extrabold text-success flex items-center gap-1">
                                                {reward.amount} <CurrencyIcon size={18} />
                                            </p>
                                            {reward.message && (
                                                <p className="text-[11px] text-foreground/40 truncate">{reward.message}</p>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleClaim(reward)}
                                        className="w-full py-3 rounded-xl text-sm font-bold bg-success text-white hover:bg-success/90 active:scale-[0.97] transition-all flex items-center justify-center gap-2 shadow-lg shadow-success/30"
                                    >
                                        <Gift className="h-5 w-5" />
                                        Claim Reward
                                    </button>
                                </div>
                            );
                        })}

                        {/* ── Royal Pass streak ── */}
                        {hasUnclaimedStreak && (
                            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 shrink-0 ring-2 ring-amber-500/20">
                                        <Crown className="h-6 w-6 text-amber-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-base font-bold">👑 Royal Pass Reward</p>
                                        <p className="text-xs text-foreground/50">Unclaimed streak reward available</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        markCompleted("streak");
                                        window.location.assign("/royal-pass");
                                    }}
                                    className="w-full py-3 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-500/90 active:scale-[0.97] transition-all shadow-lg shadow-amber-500/30"
                                >
                                    Claim
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Dismiss footer */}
                    <button
                        onClick={() => setIsOpen(false)}
                        className="w-full py-3 text-xs font-medium text-foreground/30 hover:text-foreground/50 transition-colors border-t border-divider"
                    >
                        Dismiss all
                    </button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
