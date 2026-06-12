"use client";

import { useQuery } from "@tanstack/react-query";
import { GAME } from "@/lib/game-config";
import { useSession } from "next-auth/react";

/**
 * Returns the count of pending captain-initiated squad invites for the current player.
 *
 * OPTIMIZED: Now reads from the same "notification-count" query as the header,
 * eliminating the duplicate /api/notifications call on every page load.
 * The header's query has staleTime: Infinity, so this piggybacks for free.
 */
export function useSquadInviteCount(): number {
    const { data: session } = useSession();

    const { data } = useQuery<{ pendingSquadInviteCount?: number }>({
        queryKey: ["notification-count"],
        queryFn: async () => {
            const res = await fetch("/api/notifications");
            if (!res.ok) return { pendingSquadInviteCount: 0 };
            const json = await res.json();
            return {
                unreadCount: json.data?.unreadCount ?? 0,
                unclaimedRewardCount: json.data?.unclaimedRewards?.length ?? 0,
                hasUnclaimedStreak: json.data?.hasUnclaimedStreakReward ?? false,
                pendingSquadInviteCount: json.data?.pendingSquadInviteCount ?? 0,
            };
        },
        enabled: GAME.features.hasSquads && !!session?.user,
        staleTime: Infinity, // Match header's staleTime — only fetches once per session
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any)?.pendingSquadInviteCount ?? 0;
}
