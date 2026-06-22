"use client";

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GAME } from "@/lib/game-config";
import { useState, useEffect } from "react";

/* ─── Types ─────────────────────────────────────────────────── */

export interface SquadMember {
    inviteId: string;
    playerId: string;
    displayName: string;
    imageUrl: string;
    hasRoyalPass: boolean;
    hasDiscord: boolean;
    isGhost: boolean;
    status: "PENDING" | "ACCEPTED" | "DECLINED";
    initiatedBy: "CAPTAIN" | "PLAYER";
    isSub: boolean;
}

export interface SquadDTO {
    id: string;
    name: string;
    fullName: string | null;
    status: "FORMING" | "FULL" | "CANCELLED" | "REGISTERED";
    entryFee: number;
    createdAt: string;
    needsPayment: boolean;
    captain: {
        id: string;
        displayName: string;
        imageUrl: string;
    };
    clanLogo: string | null;
    clanTag: string | null;
    clanName: string | null;
    isDefendingChampion: boolean;
    isCaptain: boolean;
    myInvite: { id: string; status: string; initiatedBy: string } | null;
    members: SquadMember[];
    acceptedCount: number;
    activeCount: number;
    totalSlots: number;
    isFull: boolean;
}

export interface DefendingChampion {
    clanId: string;
    teamName: string;
    captainName: string | null;
    clanLogo: string | null;
}

export interface SearchPlayerResult {
    id: string;
    displayName: string;
    imageUrl: string;
    balance: number;
    hasEnoughBalance: boolean;
}

/* ─── Queries ───────────────────────────────────────────────── */

/**
 * Fetch all squads for a specific poll.
 */
export function useSquads(pollId: string | undefined) {
    return useQuery<{ squads: SquadDTO[]; defendingChampion: DefendingChampion | null; maxSquads: number; maxSquadWaitlist: number; squadCount: number; isChampionship: boolean; isMangoScrim: boolean }>({
        queryKey: ["squads", pollId],
        queryFn: async () => {
            if (!pollId) return { squads: [], defendingChampion: null, maxSquads: 16, maxSquadWaitlist: 24, squadCount: 0, isChampionship: false, isMangoScrim: false };
            const res = await fetch(`/api/squads?pollId=${pollId}`); // removed _t cache-buster
            if (!res.ok) throw new Error("Failed to fetch squads");
            const json = await res.json();
            return {
                squads: json.data ?? [],
                defendingChampion: json.meta?.defendingChampion ?? null,
                maxSquads: json.meta?.maxSquads ?? 16,
                maxSquadWaitlist: json.meta?.maxSquadWaitlist ?? 24,
                squadCount: json.meta?.squadCount ?? 0,
                isChampionship: json.meta?.isChampionship ?? false,
                isMangoScrim: json.meta?.isMangoScrim ?? false,
            };
        },
        enabled: !!pollId && GAME.features.hasSquads,
        staleTime: 15_000,
    });
}

/**
 * Search players for squad invite — with debounce.
 */
export function useSearchPlayers(query: string, pollId: string | undefined) {
    const [debouncedQuery, setDebouncedQuery] = useState(query);

    useEffect(() => {
        const id = setTimeout(() => setDebouncedQuery(query), 300);
        return () => clearTimeout(id);
    }, [query]);

    return useInfiniteQuery<{ success: boolean; data: SearchPlayerResult[]; meta: { hasMore: boolean; nextCursor: string | null } }>({
        queryKey: ["squad-search-players", debouncedQuery, pollId],
        queryFn: async ({ pageParam }) => {
            const params = new URLSearchParams({
                pollId: pollId!,
                limit: "20",
                ...(debouncedQuery.length >= 2 ? { q: debouncedQuery } : {}),
                ...(pageParam ? { cursor: pageParam as string } : {}),
            });
            const res = await fetch(`/api/squads/search-players?${params}`);
            if (!res.ok) throw new Error("Search failed");
            return res.json();
        },
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage) =>
            lastPage.meta?.hasMore ? lastPage.meta.nextCursor : undefined,
        enabled: !!pollId,
        staleTime: 10_000,
    });
}

export interface RecentTeammate {
    id: string;
    displayName: string;
    imageUrl: string;
}

/**
 * Fetch players who have auto-accept enabled for this captain (quick add).
 */
export function useRecentTeammates(pollId: string | undefined, enabled = true) {
    return useQuery<RecentTeammate[]>({
        queryKey: ["recent-teammates", pollId],
        queryFn: async () => {
            if (!pollId) return [];
            const res = await fetch(`/api/squads/recent-teammates?pollId=${pollId}`);
            if (!res.ok) return [];
            const json = await res.json();
            return json.data ?? [];
        },
        enabled: !!pollId && enabled,
        staleTime: 30_000,
    });
}

/* ─── Mutations ─────────────────────────────────────────────── */

/**
 * Create a new squad.
 */
export function useCreateSquad() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ pollId, name, useClan, useClanTreasury, fullName }: {
            pollId: string; name: string; useClan?: boolean; useClanTreasury?: boolean; fullName?: string;
            // These are only used for optimistic UI, not sent to API:
            _captain?: { id: string; displayName: string; imageUrl: string };
            _clan?: { tag: string; name: string; logo: string | null } | null;
        }) => {
            const res = await fetch("/api/squads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pollId, name, useClan, useClanTreasury, fullName }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.message || "Failed to create squad");
            }
            return res.json();
        },
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: ["squads", variables.pollId] });
            const prev = queryClient.getQueryData(["squads", variables.pollId]);

            const cap = variables._captain ?? { id: "", displayName: "", imageUrl: "" };
            const clan = variables._clan;

            queryClient.setQueryData(
                ["squads", variables.pollId],
                (old: { squads: SquadDTO[]; defendingChampion: DefendingChampion | null; maxSquads: number; maxSquadWaitlist: number; squadCount: number; isChampionship: boolean; isMangoScrim: boolean } | undefined) => {
                    if (!old) return old;
                    const tempId = `temp-${Date.now()}`;
                    const newSquad: SquadDTO = {
                        id: tempId,
                        name: variables.name || clan?.tag || "New Team",
                        fullName: variables.fullName ?? (clan?.name ?? null),
                        status: "FORMING",
                        entryFee: 0,
                        needsPayment: false, // real value comes from API refetch
                        createdAt: new Date(0).toISOString(),
                        captain: cap,
                        clanLogo: clan?.logo ?? null,
                        clanTag: clan?.tag ?? null,
                        clanName: clan?.name ?? null,
                        isDefendingChampion: false,
                        isCaptain: true,
                        myInvite: { id: "", status: "ACCEPTED", initiatedBy: "CAPTAIN" },
                        members: cap.id ? [{
                            playerId: cap.id,
                            displayName: cap.displayName,
                            imageUrl: cap.imageUrl,
                            status: "ACCEPTED" as const,
                            isSub: false,
                            inviteId: "",
                            initiatedBy: "CAPTAIN" as const,
                            hasRoyalPass: false,
                            hasDiscord: false,
                            isGhost: false,
                        }] : [],
                        acceptedCount: 1,
                        activeCount: 1,
                        totalSlots: GAME.maxSquadSize,
                        isFull: false,
                    };
                    return {
                        ...old,
                        squads: [newSquad, ...old.squads],
                        squadCount: old.squadCount + 1,
                    };
                }
            );
            return { prev };
        },
        onSuccess: (data, variables) => {
            // Replace temp squad with real data from API, then background refetch
            queryClient.setQueryData(
                ["squads", variables.pollId],
                (old: { squads: SquadDTO[]; defendingChampion: DefendingChampion | null; maxSquads: number; maxSquadWaitlist: number; squadCount: number; isChampionship: boolean; isMangoScrim: boolean } | undefined) => {
                    if (!old) return old;
                    return {
                        ...old,
                        squads: old.squads.map((s) =>
                            s.id.startsWith("temp-")
                                ? { ...s, id: data.data?.id ?? s.id, name: data.data?.name ?? s.name, entryFee: data.data?.entryFee ?? 0 }
                                : s
                        ),
                    };
                }
            );
            queryClient.invalidateQueries({ queryKey: ["squads"] });
        },
        onError: (err, variables, ctx) => {
            // Rollback optimistic update
            if (ctx?.prev) queryClient.setQueryData(["squads", variables.pollId], ctx.prev);
            const msg = err instanceof Error ? err.message : "Failed to create squad";
            const isBalance = msg.toLowerCase().includes("not enough");
            toast.error(msg, {
                duration: 5000,
                ...(isBalance && {
                    action: {
                        label: `Add ${GAME.currency}`,
                        onClick: () => window.location.assign("/wallet"),
                    },
                }),
            });
        },
    });
}

/**
 * Leave a squad (non-captain members only).
 */
export function useLeaveSquad() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (squadId: string) => {
            const res = await fetch("/api/squads/leave", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ squadId }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.message || "Failed to leave squad");
            }
            return res.json();
        },
        onMutate: async (squadId) => {
            await queryClient.cancelQueries({ queryKey: ["squads"] });
            const prev = queryClient.getQueriesData({ queryKey: ["squads"] });
            queryClient.setQueriesData({ queryKey: ["squads"] }, (old: any) => {
                if (!old?.squads) return old;
                return {
                    ...old,
                    squads: old.squads.map((s: any) =>
                        s.id === squadId
                            ? { ...s, myInvite: null, acceptedCount: Math.max(0, s.acceptedCount - 1), activeCount: Math.max(0, s.activeCount - 1) }
                            : s
                    ),
                };
            });
            return { prev };
        },
        onSuccess: (data) => {
            toast.success(data.message || "Left the squad");
            queryClient.invalidateQueries({ queryKey: ["squads"] });
        },
        onError: (err, _, ctx) => {
            if (ctx?.prev) ctx.prev.forEach(([key, data]: any) => queryClient.setQueryData(key, data));
            toast.error(err instanceof Error ? err.message : "Failed to leave squad");
        },
    });
}

/**
 * Invite a player to a squad.
 */
export function useInvitePlayer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ squadId, playerId }: { squadId: string; playerId: string }) => {
            const res = await fetch("/api/squads/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ squadId, playerId }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.message || "Failed to send invite");
            }
            return res.json();
        },
        onSuccess: (data) => {
            toast.success(data.message || "Invite sent!");
            queryClient.invalidateQueries({ queryKey: ["squads"] });
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to send invite");
        },
    });
}

/**
 * Accept or decline a squad invite.
 */
export function useRespondToInvite() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ inviteId, action }: { inviteId: string; action: "ACCEPT" | "DECLINE" }) => {
            const res = await fetch("/api/squads/respond", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inviteId, action }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.message || "Failed to respond");
            }
            return res.json();
        },
        onMutate: async ({ inviteId, action }) => {
            await queryClient.cancelQueries({ queryKey: ["squads"] });
            const prev = queryClient.getQueriesData({ queryKey: ["squads"] });
            queryClient.setQueriesData({ queryKey: ["squads"] }, (old: any) => {
                if (!old?.squads) return old;
                return {
                    ...old,
                    squads: old.squads.map((s: any) => {
                        if (s.myInvite?.id === inviteId) {
                            const newStatus = action === "ACCEPT" ? "ACCEPTED" : "DECLINED";
                            return {
                                ...s,
                                myInvite: { ...s.myInvite, status: newStatus },
                                acceptedCount: action === "ACCEPT" ? s.acceptedCount + 1 : s.acceptedCount,
                                activeCount: action === "ACCEPT" ? s.activeCount + 1 : s.activeCount,
                            };
                        }
                        return s;
                    }),
                };
            });
            return { prev };
        },
        onSuccess: (data) => {
            toast.success(data.message || "Done!");
            queryClient.invalidateQueries({ queryKey: ["squads"] });
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
        onError: (err, _, ctx) => {
            if (ctx?.prev) ctx.prev.forEach(([key, data]: any) => queryClient.setQueryData(key, data));
            toast.error(err instanceof Error ? err.message : "Failed to respond to invite");
        },
    });
}

/**
 * Cancel a squad (captain only).
 */
export function useCancelSquad() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (squadId: string) => {
            const res = await fetch(`/api/squads/${squadId}/cancel`, {
                method: "POST",
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.message || "Failed to cancel squad");
            }
            return res.json();
        },
        onSuccess: (data, squadId) => {
            toast.success(data.message || "Squad cancelled");
            // Remove squad from cache after server confirms
            queryClient.setQueriesData({ queryKey: ["squads"] }, (old: any) => {
                if (!old?.squads) return old;
                return {
                    ...old,
                    squads: old.squads.filter((s: any) => s.id !== squadId),
                    squadCount: Math.max(0, old.squadCount - 1),
                };
            });
            queryClient.invalidateQueries({ queryKey: ["squads"] });
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to cancel squad");
        },
    });
}

/**
 * Request to join an open squad (player-initiated).
 */
export function useRequestJoin() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (squadId: string) => {
            const res = await fetch("/api/squads/request-join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ squadId }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.message || "Failed to send request");
            }
            return res.json();
        },
        onMutate: async (squadId) => {
            await queryClient.cancelQueries({ queryKey: ["squads"] });
            const prev = queryClient.getQueriesData({ queryKey: ["squads"] });
            queryClient.setQueriesData({ queryKey: ["squads"] }, (old: any) => {
                if (!old?.squads) return old;
                return {
                    ...old,
                    squads: old.squads.map((s: any) =>
                        s.id === squadId
                            ? { ...s, myInvite: { id: `temp-${Date.now()}`, status: "PENDING", initiatedBy: "PLAYER" } }
                            : s
                    ),
                };
            });
            return { prev };
        },
        onSuccess: (data) => {
            toast.success(data.message || "Request sent!");
            queryClient.invalidateQueries({ queryKey: ["squads"] });
        },
        onError: (err, _, ctx) => {
            if (ctx?.prev) ctx.prev.forEach(([key, data]: any) => queryClient.setQueryData(key, data));
            toast.error(err instanceof Error ? err.message : "Failed to send request");
        },
    });
}

/**
 * Captain accepts or declines a player's join request.
 */
export function useRespondToRequest() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ inviteId, action }: { inviteId: string; action: "ACCEPT" | "DECLINE" }) => {
            const res = await fetch("/api/squads/respond-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inviteId, action }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.message || "Failed to respond");
            }
            return res.json();
        },
        onSuccess: (data) => {
            toast.success(data.message || "Done!");
            queryClient.invalidateQueries({ queryKey: ["squads"] });
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to respond");
        },
    });
}

/**
 * Captain removes a member from a squad.
 */
export function useRemoveMember() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (inviteId: string) => {
            const res = await fetch("/api/squads/remove-member", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inviteId }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.message || "Failed to remove member");
            }
            return res.json();
        },
        onMutate: async (inviteId) => {
            await queryClient.cancelQueries({ queryKey: ["squads"] });
            const prev = queryClient.getQueriesData({ queryKey: ["squads"] });
            queryClient.setQueriesData({ queryKey: ["squads"] }, (old: any) => {
                if (!old?.squads) return old;
                return {
                    ...old,
                    squads: old.squads.map((s: any) => {
                        const hasMember = s.members?.some((m: any) => m.inviteId === inviteId);
                        if (!hasMember) return s;
                        return {
                            ...s,
                            members: s.members.filter((m: any) => m.inviteId !== inviteId),
                            acceptedCount: Math.max(0, s.acceptedCount - 1),
                            activeCount: Math.max(0, s.activeCount - 1),
                            isFull: false,
                        };
                    }),
                };
            });
            return { prev };
        },
        onSuccess: (data) => {
            toast.success(data.message || "Member removed");
            queryClient.invalidateQueries({ queryKey: ["squads"] });
        },
        onError: (err, _, ctx) => {
            if (ctx?.prev) ctx.prev.forEach(([key, data]: any) => queryClient.setQueryData(key, data));
            toast.error(err instanceof Error ? err.message : "Failed to remove member");
        },
    });
}
