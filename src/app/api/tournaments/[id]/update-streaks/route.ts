import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

/**
 * POST /api/tournaments/[id]/update-streaks
 * Increments streak.current for every player who participated in this tournament.
 * Updates streak.longest if current exceeds it.
 * When a Royal Pass player hits the streak milestone, creates a STREAK
 * PendingReward and resets their streak to 0.
 * Skips players whose streak.lastTournamentId already matches (idempotent).
 */
export async function POST(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAdmin();
        const { id: tournamentId } = await params;

        // Get tournament + season
        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            select: { id: true, seasonId: true, isWinnerDeclared: true },
        });

        if (!tournament) {
            return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
        }

        if (!tournament.isWinnerDeclared) {
            return NextResponse.json({ error: "Winners must be declared first" }, { status: 400 });
        }

        const settings = await getSettings();
        const STREAK_MILESTONE = settings.streakMilestone;
        const STREAK_REWARD_UC = settings.streakRewardAmount;

        // Find all players who played in this tournament
        const matchPlayed = await prisma.matchPlayerPlayed.findMany({
            where: { tournamentId },
            select: { playerId: true },
            distinct: ["playerId"],
        });

        const playerIds = matchPlayed.map((m) => m.playerId);

        if (playerIds.length === 0) {
            return NextResponse.json({
                success: true,
                data: { updated: 0, message: "No players found for this tournament" },
            });
        }

        // Get existing streaks, Royal Pass status, and unclaimed STREAK rewards
        const [streaks, players, unclaimedStreakRewards] = await Promise.all([
            prisma.playerStreak.findMany({
                where: { playerId: { in: playerIds } },
            }),
            prisma.player.findMany({
                where: { id: { in: playerIds } },
                select: { id: true, hasRoyalPass: true },
            }),
            // Check who already has an unclaimed STREAK reward (don't create duplicates)
            prisma.pendingReward.findMany({
                where: {
                    playerId: { in: playerIds },
                    type: "STREAK",
                    isClaimed: false,
                },
                select: { playerId: true },
            }),
        ]);

        const streakMap = new Map(streaks.map((s) => [s.playerId, s]));
        const royalPassSet = new Set(players.filter((p) => p.hasRoyalPass).map((p) => p.id));
        const hasUnclaimedRewardSet = new Set(unclaimedStreakRewards.map((r) => r.playerId));
        let updated = 0;
        let rewardsCreated = 0;

        // Update streaks in batches
        const BATCH_SIZE = 10;
        for (let i = 0; i < playerIds.length; i += BATCH_SIZE) {
            const batch = playerIds.slice(i, i + BATCH_SIZE);
            const promises = batch.map(async (playerId) => {
                const existing = streakMap.get(playerId);

                // Skip if already processed for this tournament (idempotent)
                if (existing?.lastTournamentId === tournamentId) return;

                // Skip increment if player has an unclaimed STREAK reward (waiting to claim)
                if (hasUnclaimedRewardSet.has(playerId)) return;

                const newCurrent = (existing?.current ?? 0) + 1;
                const newLongest = Math.max(newCurrent, existing?.longest ?? 0);

                // Check if Royal Pass player hits milestone
                if (newCurrent >= STREAK_MILESTONE && royalPassSet.has(playerId)) {
                    // Create streak reward — keep streak at milestone until claimed
                    await prisma.$transaction([
                        prisma.pendingReward.create({
                            data: {
                                playerId,
                                type: "STREAK",
                                amount: STREAK_REWARD_UC,
                                message: `🔥 ${STREAK_MILESTONE} tournament streak reward!`,
                            },
                        }),
                        prisma.playerStreak.upsert({
                            where: { playerId },
                            create: {
                                playerId,
                                current: STREAK_MILESTONE,
                                longest: newLongest,
                                seasonId: tournament.seasonId,
                                lastTournamentId: tournamentId,
                                lastRewardAt: new Date(),
                            },
                            update: {
                                current: STREAK_MILESTONE,
                                longest: newLongest,
                                seasonId: tournament.seasonId,
                                lastTournamentId: tournamentId,
                                lastRewardAt: new Date(),
                            },
                        }),
                    ]);
                    rewardsCreated++;
                } else {
                    // Normal streak increment
                    await prisma.playerStreak.upsert({
                        where: { playerId },
                        create: {
                            playerId,
                            current: 1,
                            longest: 1,
                            seasonId: tournament.seasonId,
                            lastTournamentId: tournamentId,
                        },
                        update: {
                            current: newCurrent,
                            longest: newLongest,
                            seasonId: tournament.seasonId,
                            lastTournamentId: tournamentId,
                        },
                    });
                }
                updated++;
            });
            await Promise.all(promises);
        }

        // Reset streaks for players who DIDN'T play (break their streak)
        const playedSet = new Set(playerIds);
        const allActiveStreaks = await prisma.playerStreak.findMany({
            where: {
                current: { gt: 0 },
                // Include streaks with null lastTournamentId too (Prisma `not` skips nulls)
                OR: [
                    { lastTournamentId: { not: tournamentId } },
                    { lastTournamentId: null },
                ],
            },
            select: { playerId: true },
        });

        const toReset = allActiveStreaks.filter((s) => !playedSet.has(s.playerId));
        if (toReset.length > 0) {
            await prisma.playerStreak.updateMany({
                where: {
                    playerId: { in: toReset.map((s) => s.playerId) },
                },
                data: { current: 0 },
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                updated,
                reset: toReset.length,
                rewardsCreated,
                message: `Updated ${updated} streaks, reset ${toReset.length}${rewardsCreated > 0 ? `, ${rewardsCreated} streak reward(s) created` : ""}`,
            },
        });
    } catch (error) {
        console.error("Update streaks error:", error);
        return NextResponse.json(
            { error: "Failed to update streaks" },
            { status: 500 }
        );
    }
}
