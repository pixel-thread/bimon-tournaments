"use client";

import { useQuery } from "@tanstack/react-query";
import { GAME } from "@/lib/game-config";
import { useAuthUser } from "@/hooks/use-auth-user";
import { notificationQueryOptions } from "@/lib/notification-query";

/**
 * Returns the count of pending captain-initiated squad invites for the current player.
 *
 * Uses the shared notificationQueryOptions so all consumers of ["notification-count"]
 * use the same queryFn and return the full data shape.
 */
export function useSquadInviteCount(): number {
    const { isSignedIn } = useAuthUser();

    const { data } = useQuery({
        ...notificationQueryOptions,
        enabled: GAME.features.hasSquads && isSignedIn,
    });

    return data?.pendingSquadInviteCount ?? 0;
}
