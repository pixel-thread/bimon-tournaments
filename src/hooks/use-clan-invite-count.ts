"use client";

import { useQuery } from "@tanstack/react-query";
import { GAME } from "@/lib/game-config";
import { useSession } from "next-auth/react";

/**
 * Returns the count of pending clan invites for the current player.
 * Powers the red dot notification chain:
 *   Bottom nav Profile tab → Clan row on profile → My Clan page
 *
 * FROZEN: Polling disabled to save edge requests (June 2026).
 * To revert: change staleTime back to 30_000 and refetchInterval to 60_000
 */
export function useClanInviteCount(): number {
    const { data: session } = useSession();

    const { data } = useQuery({
        queryKey: ["clan-invite-count"],
        queryFn: async () => {
            const res = await fetch("/api/clans/pending-count");
            if (!res.ok) return 0;
            const json = await res.json();
            return json.data?.count ?? 0;
        },
        enabled: GAME.features.hasClans && !!session?.user,
        staleTime: 5 * 60 * 1000, // FROZEN: was 90s → 5min (saves edge requests)
        // refetchInterval: 120_000, // FROZEN: polling disabled to save edge requests
        refetchOnWindowFocus: true, // Still refreshes when user switches back to tab
    });

    return data ?? 0;
}
