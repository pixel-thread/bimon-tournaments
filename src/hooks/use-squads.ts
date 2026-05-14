"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
    status: "PENDING" | "ACCEPTED" | "DECLINED";
    initiatedBy: "CAPTAIN" | "PLAYER";
    isSub: boolean;
}

export interface SquadDTO {
    id: string;
    name: string;
    status: "FORMING" | "FULL" | "CANCELLED" | "REGISTERED";
    entryFee: number;
    createdAt: string;
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
    return useQuery<{ squads: SquadDTO[]; defendingChampion: DefendingChampion | null; maxSquads: number; maxSquadWaitlist: number; squadCount: number; isChampionship: boolean }>({
        queryKey: ["squads", pollId],
        queryFn: async () => {
            if (!pollId) return { squads: [], defendingChampion: null, maxSquads: 16, maxSquadWaitlist: 24, squadCount: 0, isChampionship: false };
            const res = await fetch(`/api/squads?pollId=${pollId}&_t=${Date.now()}`);
            if (!res.ok) throw new Error("Failed to fetch squads");
            const json = await res.json();
            return {
                squads: json.data ?? [],
                defendingChampion: json.meta?.defendingChampion ?? null,
                maxSquads: json.meta?.maxSquads ?? 16,
                maxSquadWaitlist: json.meta?.maxSquadWaitlist ?? 24,
                squadCount: json.meta?.squadCount ?? 0,
                isChampionship: json.meta?.isChampionship ?? false,
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

    return useQuery<SearchPlayerResult[]>({
        queryKey: ["squad-search-players", debouncedQuery, pollId],
        queryFn: async () => {
            const res = await fetch(
                `/api/squads/search-players?q=${encodeURIComponent(debouncedQuery)}&pollId=${pollId}`
            );
            if (!res.ok) throw new Error("Search failed");
            const json = await res.json();
            return json.data;
        },
        enabled: debouncedQuery.length >= 2 && !!pollId,
        staleTime: 10_000,
    });
}

/* ─── Mutations ─────────────────────────────────────────────── */

/**
 * Create a new squad.
 */
export function useCreateSquad() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ pollId, name, useClan }: { pollId: string; name: string; useClan?: boolean }) => {
            const res = await fetch("/api/squads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pollId, name, useClan }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.message || "Failed to create squad");
            }
            return res.json();
        },
        onSuccess: (data) => {
            toast.success(data.message || "Squad created!");
            queryClient.invalidateQueries({ queryKey: ["squads"] });
        },
        onError: (err) => {
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
        onSuccess: (data) => {
            toast.success(data.message || "Left the squad");
            queryClient.invalidateQueries({ queryKey: ["squads"] });
        },
        onError: (err) => {
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
        onSuccess: (data) => {
            toast.success(data.message || "Done!");
            queryClient.invalidateQueries({ queryKey: ["squads"] });
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
        onError: (err) => {
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
        onSuccess: (data) => {
            toast.success(data.message || "Squad cancelled");
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
        onSuccess: (data) => {
            toast.success(data.message || "Request sent!");
            queryClient.invalidateQueries({ queryKey: ["squads"] });
        },
        onError: (err) => {
            const msg = err instanceof Error ? err.message : "Failed to send request";
            toast.error(msg);
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
        onSuccess: (data) => {
            toast.success(data.message || "Member removed");
            queryClient.invalidateQueries({ queryKey: ["squads"] });
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to remove member");
        },
    });
}
