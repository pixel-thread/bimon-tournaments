"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { GAME } from "@/lib/game-config";

export interface PollDTO {
    id: string;
    question: string;
    days: string;
    teamType: string;
    allowSquads: boolean;
    isChampionship: boolean;
    scheduledDate: string | null;
    scheduledTime: string;
    matchSchedule: Record<string, string[]> | null; // Per-day match times
    enableFund?: boolean;
    prizePoolFee?: number | null;
    fixedPrizes?: number[] | null;
    tournament: {
        id: string;
        name: string;
        fee: number | null;
        type: string;
        seasonId: string | null;
        isTDM?: boolean;
        isWoW?: boolean;
        hasTeams?: boolean;
    };
    luckyVoterId: string | null;
    isActive: boolean;
    createdAt: string;
    totalVotes: number;
    inVotes: number;
    outVotes: number;
    soloVotes: number;
    inPercentage: number;
    userVote: "IN" | "OUT" | "SOLO" | null;
    userVoteCount: number;
    hasVoted: boolean;
    playersVotes: {
        playerId: string;
        vote: string;
        voteCount: number;
        createdAt: string;
        displayName: string;
        imageUrl: string;
    }[];
    options: {
        id: string;
        name: string;
        vote: string;
    }[];
    donations: {
        total: number;
        donations: { amount: number; playerName: string | null; isAnonymous: boolean }[];
    };
    squadCount?: number;
    whatsappGroupLink?: string | null;
    sponsorCoupon: {
        sponsorName: string;
        discountPct: number;
        maxDiscount: number;
        description: string;
        status: string;
    } | null;
}

/**
 * Fetch active polls with vote data.
 */
export function usePolls() {
    return useQuery<{ polls: PollDTO[]; currentPlayerId: string | null; isCouponVerifier: boolean; isUCExempt: boolean; isAdmin: boolean }>({
        queryKey: ["polls"],
        queryFn: async () => {
            const res = await fetch(`/api/polls?_t=${Date.now()}`);
            if (!res.ok) throw new Error("Failed to fetch polls");
            const json = await res.json();
            return json.data;
        },
        staleTime: 30 * 1000,
    });
}

/**
 * Cast a vote on a poll (IN/OUT/SOLO).
 * Optimistically updates vote counts AND the playersVotes list.
 * Exposes `variables` so callers can check which poll/vote is pending.
 */
export function useVote() {
    const queryClient = useQueryClient();
    const { data: session } = useSession();

    return useMutation({
        mutationFn: async ({
            pollId,
            vote,
        }: {
            pollId: string;
            vote: "IN" | "OUT" | "SOLO";
        }) => {
            const res = await fetch("/api/polls/vote", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pollId, vote }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                const msg = json.message || "Failed to cast vote";
                const note = json.note ? ` (${json.note})` : "";
                throw new Error(`${msg}${note}`);
            }
            return res.json();
        },
        onMutate: async ({ pollId, vote }) => {
            await queryClient.cancelQueries({ queryKey: ["polls"] });
            const previous = queryClient.getQueryData<{ polls: PollDTO[]; currentPlayerId: string | null; isCouponVerifier: boolean; isUCExempt: boolean }>(["polls"]);

            queryClient.setQueryData<{ polls: PollDTO[]; currentPlayerId: string | null; isCouponVerifier: boolean; isUCExempt: boolean }>(["polls"], (old) => {
                if (!old) return old;
                const currentPlayerId = old.currentPlayerId;
                return {
                    ...old,
                    polls: old.polls.map((poll) => {
                        if (poll.id !== pollId) return poll;

                        let { inVotes, outVotes, soloVotes } = poll;

                        // Remove previous vote
                        if (poll.hasVoted) {
                            if (poll.userVote === "IN") inVotes--;
                            if (poll.userVote === "OUT") outVotes--;
                            if (poll.userVote === "SOLO") soloVotes--;
                        }

                        // Add new vote
                        if (vote === "IN") inVotes++;
                        else if (vote === "OUT") outVotes++;
                        else soloVotes++;

                        const totalVotes = inVotes + outVotes + soloVotes;

                        // Optimistically update playersVotes array
                        let playersVotes = [...poll.playersVotes];
                        if (currentPlayerId) {
                            playersVotes = playersVotes.filter(
                                (v) => v.playerId !== currentPlayerId
                            );
                            playersVotes.push({
                                playerId: currentPlayerId,
                                vote,
                                voteCount: 1,
                                createdAt: new Date().toISOString(),
                                displayName:
                                    session?.user?.name ||
                                    "You",
                                imageUrl: session?.user?.image || "",
                            });
                        }

                        return {
                            ...poll,
                            userVote: vote,
                            userVoteCount: 1,
                            hasVoted: true,
                            inVotes,
                            outVotes,
                            soloVotes,
                            totalVotes,
                            playersVotes,
                            inPercentage:
                                totalVotes > 0
                                    ? Math.round((inVotes / totalVotes) * 100)
                                    : 0,
                        };
                    }),
                };
            });

            return { previous };
        },
        onError: (err, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(["polls"], context.previous);
            }
            const message = err instanceof Error ? err.message : "Failed to cast vote";
            const isBalanceError = message.toLowerCase().includes("not enough");
            toast.error(message, {
                duration: 5000,
                ...(isBalanceError && {
                    action: {
                        label: `Add ${GAME.currency}`,
                        onClick: () => window.location.assign("/wallet"),
                    },
                }),
            });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["polls"] });
        },
    });
}

/**
 * Add/remove an extra entry on an existing vote (PES multi-entry).
 */
export function useEntryMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            pollId,
            action,
        }: {
            pollId: string;
            action: "ADD_ENTRY" | "REMOVE_ENTRY";
        }) => {
            const res = await fetch("/api/polls/vote", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pollId, vote: action }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                const msg = json.message || "Failed";
                const note = json.note ? ` (${json.note})` : "";
                throw new Error(`${msg}${note}`);
            }
            return res.json();
        },
        onMutate: async ({ pollId, action }) => {
            await queryClient.cancelQueries({ queryKey: ["polls"] });
            const previous = queryClient.getQueryData<{ polls: PollDTO[]; currentPlayerId: string | null; isCouponVerifier: boolean; isUCExempt: boolean }>(["polls"]);

            queryClient.setQueryData<{ polls: PollDTO[]; currentPlayerId: string | null; isCouponVerifier: boolean; isUCExempt: boolean }>(["polls"], (old) => {
                if (!old) return old;
                return {
                    ...old,
                    polls: old.polls.map((poll) => {
                        if (poll.id !== pollId) return poll;
                        const delta = action === "ADD_ENTRY" ? 1 : -1;
                        return {
                            ...poll,
                            userVoteCount: Math.max(1, poll.userVoteCount + delta),
                        };
                    }),
                };
            });

            return { previous };
        },
        onError: (err, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(["polls"], context.previous);
            }
            const message = err instanceof Error ? err.message : "Failed";
            toast.error(message);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["polls"] });
        },
    });
}
