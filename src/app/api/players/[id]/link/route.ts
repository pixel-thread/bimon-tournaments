import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { requireAdmin } from "@/lib/auth";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";

/**
 * POST /api/players/[id]/link
 * Admin-only: Merge a legacy Player's data into a target User's Player.
 *
 * Body: { query: string }
 *
 * Scenario: A Season 1 player signs up again in Season 4.3 with a new
 * account. They now have two Player records:
 *   - Old Player (this one, [id]): has history from Seasons 1-4.2
 *   - New Player (on targetEmail's User): has data from Season 4.3
 *
 * This endpoint MERGES the old player's records INTO the new player,
 * then deletes the old player. The new player keeps all their data
 * and also gets the old data.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const admin = await requireAdmin();
        if (!admin) {
            return ErrorResponse({ message: "Admin access required", status: 403 });
        }

        const { id: oldPlayerId } = await params;
        const { query } = (await req.json()) as { query?: string };

        if (!query?.trim()) {
            return ErrorResponse({ message: "Email or player name is required", status: 400 });
        }

        const searchTerm = query.trim();

        // 1. Get the legacy (old) player
        const oldPlayer = await prisma.player.findUnique({
            where: { id: oldPlayerId },
            include: {
                user: { select: { id: true, email: true, username: true } },
                wallet: { select: { id: true, balance: true } },
            },
        });

        if (!oldPlayer) {
            return ErrorResponse({ message: "Player not found", status: 404 });
        }

        // 2. Find the target user by email, username, or player displayName
        const targetUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: { equals: searchTerm, mode: "insensitive" } },
                    { username: { equals: searchTerm, mode: "insensitive" } },
                    { player: { displayName: { equals: searchTerm, mode: "insensitive" } } },
                ],
            },
            include: {
                player: {
                    select: {
                        id: true,
                        displayName: true,
                        wallet: { select: { id: true, balance: true } },
                    },
                },
            },
        });

        if (!targetUser) {
            return ErrorResponse({
                message: `No user found matching: ${searchTerm}`,
                status: 404,
            });
        }

        // 3. Don't merge with self
        if (targetUser.id === oldPlayer.user.id) {
            return ErrorResponse({
                message: "Player is already linked to this user",
                status: 400,
            });
        }

        const newPlayer = targetUser.player;

        if (!newPlayer) {
            return ErrorResponse({
                message: `User "${targetUser.email}" doesn't have a player profile yet. They need to sign up and onboard first.`,
                status: 400,
            });
        }

        const newPlayerId = newPlayer.id;

        // 4. Merge: move all old player's records to the new player
        await prisma.$transaction(async (tx) => {
            // ── Phase 1: Gather data for unique-constraint conflict resolution ──
            const [
                newPlayerStats,
                newTPS,
                newPollVotes,
                newGameScore,
                newCPV,
                newRoyalPasses,
            ] = await Promise.all([
                tx.playerStats.findMany({ where: { playerId: newPlayerId }, select: { seasonId: true } }),
                tx.teamPlayerStats.findMany({ where: { playerId: newPlayerId }, select: { teamId: true, matchId: true } }),
                tx.playerPollVote.findMany({ where: { playerId: newPlayerId }, select: { pollId: true } }),
                tx.gameScore.findFirst({ where: { playerId: newPlayerId } }),
                tx.communityPollVote.findMany({ where: { playerId: newPlayerId }, select: { pollId: true } }),
                tx.royalPass.findMany({ where: { playerId: newPlayerId }, select: { seasonId: true } }),
            ]);

            // ── Phase 2: Many-to-many join tables via raw SQL ──
            // Replaces hundreds of individual Prisma disconnect/connect calls
            // with ~10 SQL statements regardless of record count.

            // 2a: Delete old-player join rows where new player already has the same association
            await Promise.all([
                // _PlayerToTeam (A=Player.id, B=Team.id)
                tx.$executeRaw`DELETE FROM "_PlayerToTeam" WHERE "A" = ${oldPlayerId} AND "B" IN (SELECT "B" FROM "_PlayerToTeam" WHERE "A" = ${newPlayerId})`,
                // _MatchToPlayer (A=Match.id, B=Player.id)
                tx.$executeRaw`DELETE FROM "_MatchToPlayer" WHERE "B" = ${oldPlayerId} AND "A" IN (SELECT "A" FROM "_MatchToPlayer" WHERE "B" = ${newPlayerId})`,
                // _PlayerSeason (A=Player.id, B=Season.id)
                tx.$executeRaw`DELETE FROM "_PlayerSeason" WHERE "A" = ${oldPlayerId} AND "B" IN (SELECT "B" FROM "_PlayerSeason" WHERE "A" = ${newPlayerId})`,
                // _PlayerToTeamStats (A=Player.id, B=TeamStats.id)
                tx.$executeRaw`DELETE FROM "_PlayerToTeamStats" WHERE "A" = ${oldPlayerId} AND "B" IN (SELECT "B" FROM "_PlayerToTeamStats" WHERE "A" = ${newPlayerId})`,
                // _PlayerToPoll (A=Player.id, B=Poll.id)
                tx.$executeRaw`DELETE FROM "_PlayerToPoll" WHERE "A" = ${oldPlayerId} AND "B" IN (SELECT "B" FROM "_PlayerToPoll" WHERE "A" = ${newPlayerId})`,
            ]);

            // 2b: Move remaining join rows to new player
            await Promise.all([
                tx.$executeRaw`UPDATE "_PlayerToTeam" SET "A" = ${newPlayerId} WHERE "A" = ${oldPlayerId}`,
                tx.$executeRaw`UPDATE "_MatchToPlayer" SET "B" = ${newPlayerId} WHERE "B" = ${oldPlayerId}`,
                tx.$executeRaw`UPDATE "_PlayerSeason" SET "A" = ${newPlayerId} WHERE "A" = ${oldPlayerId}`,
                tx.$executeRaw`UPDATE "_PlayerToTeamStats" SET "A" = ${newPlayerId} WHERE "A" = ${oldPlayerId}`,
                tx.$executeRaw`UPDATE "_PlayerToPoll" SET "A" = ${newPlayerId} WHERE "A" = ${oldPlayerId}`,
            ]);

            // ── Phase 3: Conflict-safe deletes for unique constraints ──
            const existingStatSeasons = newPlayerStats.map(s => s.seasonId).filter((s): s is string => s !== null);
            const existingPollVoteIds = new Set(newPollVotes.map(v => v.pollId));
            const existingRPSeasons = new Set(newRoyalPasses.map(rp => rp.seasonId));

            await Promise.all([
                // PlayerStats: @@unique([seasonId, playerId])
                ...(existingStatSeasons.length > 0
                    ? [tx.playerStats.deleteMany({ where: { playerId: oldPlayerId, seasonId: { in: existingStatSeasons } } })]
                    : []),
                ...(newPlayerStats.some(s => s.seasonId === null)
                    ? [tx.playerStats.deleteMany({ where: { playerId: oldPlayerId, seasonId: null } })]
                    : []),
                // TeamPlayerStats: @@unique([playerId, teamId, matchId])
                ...newTPS.map(tps => tx.teamPlayerStats.deleteMany({
                    where: { playerId: oldPlayerId, teamId: tps.teamId, matchId: tps.matchId },
                })),
                // PlayerPollVote: @@unique([playerId, pollId])
                ...(existingPollVoteIds.size > 0
                    ? [tx.playerPollVote.deleteMany({ where: { playerId: oldPlayerId, pollId: { in: [...existingPollVoteIds] } } })]
                    : []),
                // GameScore: @@unique([playerId, difficulty])
                ...(newGameScore
                    ? [tx.gameScore.deleteMany({ where: { playerId: oldPlayerId } })]
                    : []),
                // CommunityPollVote: @@unique([pollId, playerId])
                ...(newCPV.length > 0
                    ? [tx.communityPollVote.deleteMany({ where: { playerId: oldPlayerId, pollId: { in: newCPV.map(v => v.pollId) } } })]
                    : []),
                // CommunityVote: @@unique([messageId, playerId])
                tx.communityVote.deleteMany({ where: { playerId: oldPlayerId } }),
                // RoyalPass: @@unique([playerId, seasonId])
                ...(existingRPSeasons.size > 0
                    ? [tx.royalPass.deleteMany({ where: { playerId: oldPlayerId, seasonId: { in: [...existingRPSeasons] } } })]
                    : []),
            ]);

            // ── Phase 4: Bulk moves (all updateMany, independent) ──
            await Promise.all([
                tx.playerStats.updateMany({ where: { playerId: oldPlayerId }, data: { playerId: newPlayerId } }),
                tx.teamPlayerStats.updateMany({ where: { playerId: oldPlayerId }, data: { playerId: newPlayerId } }),
                tx.matchPlayerPlayed.updateMany({ where: { playerId: oldPlayerId }, data: { playerId: newPlayerId } }),
                tx.playerPollVote.updateMany({ where: { playerId: oldPlayerId }, data: { playerId: newPlayerId } }),
                ...(!newGameScore
                    ? [tx.gameScore.updateMany({ where: { playerId: oldPlayerId }, data: { playerId: newPlayerId } })]
                    : []),
                tx.transaction.updateMany({ where: { playerId: oldPlayerId }, data: { playerId: newPlayerId } }),
                tx.pendingReward.updateMany({ where: { playerId: oldPlayerId }, data: { playerId: newPlayerId } }),
                tx.prizePoolDonation.updateMany({ where: { playerId: oldPlayerId }, data: { playerId: newPlayerId } }),
                tx.communityMessage.updateMany({ where: { playerId: oldPlayerId }, data: { playerId: newPlayerId } }),
                tx.communityPollVote.updateMany({ where: { playerId: oldPlayerId }, data: { playerId: newPlayerId } }),
                tx.royalPass.updateMany({ where: { playerId: oldPlayerId }, data: { playerId: newPlayerId } }),
                tx.uCTransfer.updateMany({ where: { fromPlayerId: oldPlayerId }, data: { fromPlayerId: newPlayerId } }),
                tx.uCTransfer.updateMany({ where: { toPlayerId: oldPlayerId }, data: { toPlayerId: newPlayerId } }),
                tx.bracketMatch.updateMany({ where: { player1Id: oldPlayerId }, data: { player1Id: newPlayerId } }),
                tx.bracketMatch.updateMany({ where: { player2Id: oldPlayerId }, data: { player2Id: newPlayerId } }),
                tx.bracketMatch.updateMany({ where: { winnerId: oldPlayerId }, data: { winnerId: newPlayerId } }),
                tx.bracketMatch.updateMany({ where: { mvpPlayerId: oldPlayerId }, data: { mvpPlayerId: newPlayerId } }),
                tx.bracketResult.updateMany({ where: { submittedById: oldPlayerId }, data: { submittedById: newPlayerId } }),
                tx.bracketResult.updateMany({ where: { mvpPlayerId: oldPlayerId }, data: { mvpPlayerId: newPlayerId } }),
                tx.playerMeritRating.updateMany({ where: { fromPlayerId: oldPlayerId }, data: { fromPlayerId: newPlayerId } }),
                tx.playerMeritRating.updateMany({ where: { toPlayerId: oldPlayerId }, data: { toPlayerId: newPlayerId } }),
                // Community
                tx.communityPoll.updateMany({ where: { playerId: oldPlayerId }, data: { playerId: newPlayerId } }),
                tx.communityPollOption.updateMany({ where: { addedById: oldPlayerId }, data: { addedById: newPlayerId } }),
                // Clan
                tx.clanTransaction.updateMany({ where: { playerId: oldPlayerId }, data: { playerId: newPlayerId } }),
                tx.clanWithdrawRequest.updateMany({ where: { playerId: oldPlayerId }, data: { playerId: newPlayerId } }),
                tx.clanWithdrawRequest.updateMany({ where: { reviewerId: oldPlayerId }, data: { reviewerId: newPlayerId } }),
                // Sponsor coupons
                tx.sponsorCoupon.updateMany({ where: { createdById: oldPlayerId }, data: { createdById: newPlayerId } }),
                tx.sponsorCoupon.updateMany({ where: { claimedById: oldPlayerId }, data: { claimedById: newPlayerId } }),
                // Payments
                tx.payment.updateMany({ where: { playerId: oldPlayerId }, data: { playerId: newPlayerId } }),
            ]);

            // ── Phase 5: Wallet merge + cleanup ──
            const oldBalance = oldPlayer.wallet?.balance ?? 0;
            if (oldBalance !== 0 && newPlayer.wallet) {
                await tx.wallet.update({
                    where: { id: newPlayer.wallet.id },
                    data: { balance: { increment: oldBalance } },
                });
            }

            // Delete old player's unique dependents
            await Promise.all([
                tx.wallet.deleteMany({ where: { playerId: oldPlayerId } }),
                tx.playerStreak.deleteMany({ where: { playerId: oldPlayerId } }),
                tx.playerBan.deleteMany({ where: { playerId: oldPlayerId } }),
                tx.pushSubscription.deleteMany({ where: { playerId: oldPlayerId } }),
                tx.playerJobListing.deleteMany({ where: { playerId: oldPlayerId } }),
                tx.referral.deleteMany({ where: { referredPlayerId: oldPlayerId } }),
                tx.notification.deleteMany({ where: { playerId: oldPlayerId } }),
                tx.jobListingReaction.deleteMany({ where: { playerId: oldPlayerId } }),
                tx.gameScoreThreshold.deleteMany({ where: { playerId: oldPlayerId } }),
                tx.squadInvite.deleteMany({ where: { playerId: oldPlayerId } }),
                tx.squad.deleteMany({ where: { captainId: oldPlayerId } }),
                tx.clanMember.deleteMany({ where: { playerId: oldPlayerId } }),
                tx.clanInvite.deleteMany({ where: { playerId: oldPlayerId } }),
                tx.clan.deleteMany({ where: { leaderId: oldPlayerId } }),
                tx.welcomeBackCoupon.deleteMany({ where: { playerId: oldPlayerId } }),
                tx.playerSurvey.deleteMany({ where: { playerId: oldPlayerId } }),
            ]);

            // Delete the old player
            await tx.player.delete({ where: { id: oldPlayerId } });

            // Clear the orphaned User's unique fields so the email/username
            // don't block reuse (e.g. adding as secondary email on the target).
            // We keep the User row for Clerk sync + promoter referral history.
            await tx.user.update({
                where: { id: oldPlayer.user.id },
                data: {
                    email: null,
                    secondaryEmail: null,
                    username: `merged_${oldPlayer.user.id.slice(0, 8)}`,
                },
            });
        }, { timeout: 300_000 });

        return SuccessResponse({
            message: `Merged "${oldPlayer.displayName}" into "${newPlayer.displayName}" (${targetUser.email}). All history has been combined.`,
            data: {
                oldPlayerId,
                newPlayerId,
                targetEmail: targetUser.email,
            },
        });
    } catch (error) {
        console.error("Failed to merge player:", error);
        return ErrorResponse({ message: "Failed to merge player", error });
    }
}
