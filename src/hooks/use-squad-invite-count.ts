"use client";

import { useQuery } from "@tanstack/react-query";
import { GAME } from "@/lib/game-config";
import { useSession } from "next-auth/react";

/**
 * Returns the count of pending captain-initiated squad invites for the current player.
 * Uses a separate query key so it doesn't conflict with the header's notification-count query.
 */
export function useSquadInviteCount(): number {
    const { data: session } = useSession();

    const { data } = useQuery({
        queryKey: ["squad-invite-count"],
        queryFn: async () => {
            const res = await fetch("/api/notifications");
            if (!res.ok) return 0;
            const json = await res.json();
            return json.data?.pendingSquadInviteCount ?? 0;
        },
        enabled: GAME.features.hasSquads && !!session?.user,
        staleTime: 90_000, // 90s — reduced to save edge requests
        refetchInterval: 120_000, // poll every 2min (was 60s)
    });

    return data ?? 0;
}
