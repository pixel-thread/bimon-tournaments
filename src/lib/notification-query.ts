"use client";

import { queryOptions } from "@tanstack/react-query";

export interface NotificationData {
    unreadCount: number;
    unclaimedRewardCount: number;
    unclaimedRewards: {
        id: string;
        type: string;
        amount: number;
        diamondAmount?: number;
        message?: string;
        position?: number;
    }[];
    hasUnclaimedStreak: boolean;
    pendingSquadInviteCount: number;
    pendingSquadInvites: {
        id: string;
        squad: {
            id: string;
            name: string;
            captain: { displayName: string | null };
            poll: { tournament: { name: string } | null } | null;
        };
    }[];
    pendingSquadRequests: {
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
            poll: { tournament: { name: string } | null } | null;
        };
    }[];
}

const EMPTY: NotificationData = {
    unreadCount: 0,
    unclaimedRewardCount: 0,
    unclaimedRewards: [],
    hasUnclaimedStreak: false,
    pendingSquadInviteCount: 0,
    pendingSquadInvites: [],
    pendingSquadRequests: [],
};

async function fetchNotifications(): Promise<NotificationData> {
    const res = await fetch("/api/notifications");
    if (!res.ok) return EMPTY;
    const json = await res.json();
    const d = json.data;
    return {
        unreadCount: d?.unreadCount ?? 0,
        unclaimedRewardCount: d?.unclaimedRewards?.length ?? 0,
        unclaimedRewards: d?.unclaimedRewards ?? [],
        hasUnclaimedStreak: d?.hasUnclaimedStreakReward ?? false,
        pendingSquadInviteCount: d?.pendingSquadInviteCount ?? 0,
        pendingSquadInvites: d?.pendingSquadInvites ?? [],
        pendingSquadRequests: d?.pendingSquadRequests ?? [],
    };
}

/**
 * Shared query options for notification count + action items.
 * Used by both the Header and ActionCenter to ensure a single source of truth.
 */
export const notificationQueryOptions = queryOptions({
    queryKey: ["notification-count"],
    queryFn: fetchNotifications,
    refetchOnMount: "always" as const,
    refetchOnWindowFocus: "always" as const,
});
