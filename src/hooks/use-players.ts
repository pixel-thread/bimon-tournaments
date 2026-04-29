"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

export interface PlayerDTO {
    id: string;
    displayName: string | null;
    bio: string | null;
    username: string;
    imageUrl: string | null;
    category: string;
    isBanned: boolean;
    characterImage: {
        url: string;
        thumbnailUrl: string | null;
        isAnimated: boolean;
        isVideo: boolean;
    } | null;
    stats: {
        kills: number;
        deaths: number;
        matches: number;
        kd: number;
        wins: number;     // bracket/league: matches won
        losses: number;   // bracket/league: matches lost
    };
    balance: number;
    hasRoyalPass: boolean;
    isAdmin: boolean;
    clan: {
        id: string;
        name: string;
        tag: string;
        logoUrl: string | null;
    } | null;
}

export interface PlayersMeta {
    hasMore: boolean;
    nextCursor: string | null;
    count: number;
    totalBalance?: number;
    negativeBalance?: number;
}

interface PlayersResponse {
    success: boolean;
    data: PlayerDTO[];
    meta: PlayersMeta;
}

interface UsePlayersOptions {
    search?: string;
    tier?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    season?: string;
    state?: string;
    district?: string;
    town?: string;
    teamMode?: "ranked" | "casual" | "tdm" | "wow" | "all";
    limit?: number;
}

/**
 * Infinite query hook for paginated player data.
 * Backed by cursor-based pagination from the API.
 */
export function usePlayers({
    search = "",
    tier = "All",
    sortBy = "matches",
    sortOrder = "desc",
    season = "",
    state = "",
    district = "",
    town = "",
    teamMode = "all",
    limit = 10,
}: UsePlayersOptions = {}) {
    return useInfiniteQuery<PlayersResponse>({
        queryKey: ["players", { search, tier, sortBy, sortOrder, season, state, district, town, teamMode }],
        queryFn: async ({ pageParam }) => {
            const params = new URLSearchParams({
                search,
                tier,
                sortBy,
                sortOrder,
                ...(season ? { season } : {}),
                ...(state ? { state } : {}),
                ...(district ? { district } : {}),
                ...(town ? { town } : {}),
                ...(teamMode !== "all" ? { teamMode } : {}),
                limit: String(limit),
                ...(pageParam ? { cursor: pageParam as string } : {}),
            });

            const res = await fetch(`/api/players?${params}`);
            if (!res.ok) throw new Error("Failed to fetch players");
            return res.json();
        },
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage) =>
            lastPage.meta.hasMore ? lastPage.meta.nextCursor : undefined,
        staleTime: 60 * 1000,
        enabled: !!season, // Wait for season to be set before fetching
    });
}

/**
 * Helper to flatten infinite query pages into a single array.
 */
export function flattenPlayers(
    data: { pages: PlayersResponse[] } | undefined
): { players: PlayerDTO[]; meta: PlayersMeta | undefined } {
    if (!data) return { players: [], meta: undefined };
    const players = data.pages.flatMap((page) => page.data);
    const meta = data.pages[data.pages.length - 1]?.meta;
    return { players, meta };
}
