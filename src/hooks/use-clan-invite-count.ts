"use client";

import { useQuery } from "@tanstack/react-query";
import { GAME } from "@/lib/game-config";
import { useSession } from "next-auth/react";

/**
 * Returns the count of pending clan invites for the current player.
 * Powers the red dot notification chain:
 *   Bottom nav Profile tab → Clan row on profile → My Clan page
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
        staleTime: 90_000,
        refetchInterval: 120_000, // Poll every 2min (was 60s)
    });

    return data ?? 0;
}
