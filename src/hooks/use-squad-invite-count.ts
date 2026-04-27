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
        staleTime: 30_000, // 30s — re-check periodically
        refetchInterval: 60_000, // poll every 60s for new invites
    });

    return data ?? 0;
}
