"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton, Card, CardBody, Divider, Button } from "@heroui/react";
import { Trophy, ArrowLeft, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { BracketView, MyBracketMatch } from "@/components/bracket/bracket-view";
import { SubmitResultModal, useConfirmResult, useDisputeResult } from "@/components/bracket/submit-result-modal";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";

interface BracketPageProps {
    params: Promise<{ id: string }>;
}

export default function BracketPage({ params }: BracketPageProps) {
    const { id: tournamentId } = use(params);
    const router = useRouter();
    const [submitMatchId, setSubmitMatchId] = useState<string | null>(null);

    const { data, isLoading, error } = useQuery({
        queryKey: ["bracket", tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/tournaments/${tournamentId}/bracket`);
            if (!res.ok) throw new Error("Failed to load bracket");
            const json = await res.json();
            return json.data;
        },
        // refetchInterval: 60_000, // FROZEN: polling disabled to save edge requests (June 2026)
        refetchOnWindowFocus: true, // Still refreshes when user switches back
    });

    const confirmResult = useConfirmResult(tournamentId);
    const disputeResult = useDisputeResult(tournamentId);

    // Get current player ID from the bracket data
    // We'll fetch it from the profile
    const { data: profileData } = useQuery({
        queryKey: ["my-profile"],
        queryFn: async () => {
            const res = await fetch("/api/profile");
            if (!res.ok) return null;
            const json = await res.json();
            return json.data;
        },
    });
    const currentPlayerId = profileData?.player?.id;

    return (
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
            {/* Header */}
            <div className="mb-6">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-1 text-sm text-foreground/50 hover:text-foreground transition-colors mb-3"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </button>
                <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    <h1 className="text-lg font-bold">
                        {data?.tournament?.name || "Tournament Bracket"}
                    </h1>
                </div>
                {data?.tournament?.fee ? (
                    <p className="text-sm text-foreground/50 mt-1">
                        <CurrencyIcon size={14} /> {data.tournament.fee} {GAME.currency} entry
                        • {data.totalRounds} round{data.totalRounds !== 1 ? "s" : ""}
                        • {data.totalMatches} match{data.totalMatches !== 1 ? "es" : ""}
                    </p>
                ) : null}
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="space-y-4">
                    <Skeleton className="h-6 w-48 rounded" />
                    <div className="flex gap-4">
                        {[1, 2, 3].map((i) => (
                            <Card key={i} className="min-w-[200px] border border-divider">
                                <CardBody className="space-y-3 p-3">
                                    <Skeleton className="h-10 w-full rounded" />
                                    <Skeleton className="h-3 w-full rounded" />
                                    <Skeleton className="h-10 w-full rounded" />
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 rounded-lg bg-danger-50 p-4 text-sm text-danger dark:bg-danger-50/10">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Failed to load bracket. This might not be a bracket tournament.
                </div>
            )}

            {/* Bracket content */}
            {data && (
                <>
                    {/* My current match (prominent at top) */}
                    {currentPlayerId && (
                        <MyBracketMatch
                            rounds={data.rounds}
                            currentPlayerId={currentPlayerId}
                            onSubmitResult={(id) => setSubmitMatchId(id)}
                            onConfirmResult={(id) => confirmResult.mutate(id)}
                            onDispute={(id) => {
                                if (confirm("Are you sure you want to dispute this result? An admin will review.")) {
                                    disputeResult.mutate(id);
                                }
                            }}
                        />
                    )}

                    <Divider className="my-4" />

                    {/* Full bracket */}
                    <BracketView
                        rounds={data.rounds}
                        totalRounds={data.totalRounds}
                        currentPlayerId={currentPlayerId}
                        winner={data.winner}
                        maxPlacements={data.maxPlacements}
                        onSubmitResult={(id) => setSubmitMatchId(id)}
                        onConfirmResult={(id) => confirmResult.mutate(id)}
                        onDispute={(id) => {
                            if (confirm("Are you sure you want to dispute this result?")) {
                                disputeResult.mutate(id);
                            }
                        }}
                    />
                </>
            )}

            {/* Submit Result Modal */}
            <SubmitResultModal
                isOpen={!!submitMatchId}
                onClose={() => setSubmitMatchId(null)}
                matchId={submitMatchId}
                tournamentId={tournamentId}
            />
        </div>
    );
}
