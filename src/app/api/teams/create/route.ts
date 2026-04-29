import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { type NextRequest } from "next/server";
import { GAME } from "@/lib/game-config";
import { debitWallet, getEmailByPlayerId } from "@/lib/wallet-service";
import { getActiveCoupon, redeemCoupon } from "@/lib/logic/welcomeBack";

/**
 * POST /api/teams/create
 * Creates a new team for a tournament + match with selected players.
 * Optionally deducts UC entry fees.
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return ErrorResponse({ message: "Unauthorized", status: 403 });
        }

        const body = await request.json();
        const {
            tournamentId,
            matchId,
            playerIds,
            deductUC = false,
        } = body as {
            tournamentId: string;
            matchId: string;
            playerIds: string[];
            deductUC?: boolean;
        };

        if (!tournamentId || !matchId || !playerIds?.length) {
            return ErrorResponse({ message: "tournamentId, matchId, and playerIds are required", status: 400 });
        }

        // 1. Validate tournament, match, and players in parallel
        const [tournament, match, players] = await Promise.all([
            prisma.tournament.findUnique({
                where: { id: tournamentId },
                select: { id: true, name: true, fee: true, seasonId: true },
            }),
            prisma.match.findUnique({
                where: { id: matchId },
                select: { id: true },
            }),
            prisma.player.findMany({
                where: { id: { in: playerIds } },
                select: {
                    id: true,
                    user: { select: { username: true } },
                    wallet: { select: { balance: true } },
                },
            }),
        ]);

        if (!tournament) return ErrorResponse({ message: "Tournament not found", status: 404 });
        if (!match) return ErrorResponse({ message: "Match not found", status: 404 });
        if (players.length !== playerIds.length) {
            return ErrorResponse({ message: "One or more players not found", status: 404 });
        }

        // 2. Check for duplicate team assignments
        const existing = await prisma.team.findMany({
            where: { tournamentId, players: { some: { id: { in: playerIds } } } },
            select: { players: { select: { id: true }, where: { id: { in: playerIds } } } },
        });
        const alreadyAssigned = existing.flatMap((t) => t.players.map((p) => p.id));
        if (alreadyAssigned.length > 0) {
            return ErrorResponse({
                message: `Players already on a team: ${alreadyAssigned.join(", ")}`,
                status: 400,
            });
        }

        // 3. Create team
        const teamCount = await prisma.team.count({ where: { tournamentId } });

        const teamName = `Team ${teamCount + 1}`;

        const team = await prisma.team.create({
            data: {
                name: teamName,
                teamNumber: teamCount + 1,
                tournament: { connect: { id: tournamentId } },
                matches: { connect: { id: matchId } },
                players: { connect: playerIds.map((id) => ({ id })) },
                ...(tournament.seasonId ? { season: { connect: { id: tournament.seasonId } } } : {}),
            },
        });

        // 4. Create TeamStats + TeamPlayerStats for this match
        const targetMatch = await prisma.match.findUnique({
            where: { id: matchId },
            select: { matchNumber: true },
        });

        const teamStats = await prisma.teamStats.create({
            data: {
                teamId: team.id,
                matchId,
                position: 0,
                ...(tournament.seasonId ? { seasonId: tournament.seasonId } : {}),
                tournamentId,
            },
        });

        await prisma.teamPlayerStats.createMany({
            data: playerIds.map((playerId) => ({
                playerId,
                teamId: team.id,
                matchId,
                teamStatsId: teamStats.id,
                kills: 0,
                present: true,
                ...(tournament.seasonId ? { seasonId: tournament.seasonId } : {}),
            })),
        });

        // 5. Create MatchPlayerPlayed records
        await prisma.matchPlayerPlayed.createMany({
            data: playerIds.map((playerId) => ({
                matchId,
                playerId,
                tournamentId,
                teamId: team.id,
                ...(tournament.seasonId ? { seasonId: tournament.seasonId } : {}),
            })),
        });

        // 6. Propagate team to all matches with higher matchNumber
        let propagatedCount = 0;
        if (targetMatch) {
            const higherMatches = await prisma.match.findMany({
                where: {
                    tournamentId,
                    matchNumber: { gt: targetMatch.matchNumber },
                },
                select: { id: true, matchNumber: true },
                orderBy: { matchNumber: "asc" },
            });

            for (const hm of higherMatches) {
                // Connect team to this match
                await prisma.match.update({
                    where: { id: hm.id },
                    data: { teams: { connect: { id: team.id } } },
                });

                const hmTeamStats = await prisma.teamStats.create({
                    data: {
                        teamId: team.id,
                        matchId: hm.id,
                        position: 0,
                        tournamentId,
                        ...(tournament.seasonId ? { seasonId: tournament.seasonId } : {}),
                    },
                });

                await prisma.teamPlayerStats.createMany({
                    data: playerIds.map((playerId) => ({
                        playerId,
                        teamId: team.id,
                        matchId: hm.id,
                        teamStatsId: hmTeamStats.id,
                        kills: 0,
                        present: true,
                        ...(tournament.seasonId ? { seasonId: tournament.seasonId } : {}),
                    })),
                });

                propagatedCount++;
            }
        }

        // 6. UC deduction via wallet (optional) — with welcome back coupon support
        const entryFee = tournament.fee || 0;
        let couponAppliedCount = 0;
        if (deductUC && entryFee > 0) {
            for (const playerId of playerIds) {
                const email = await getEmailByPlayerId(playerId);
                if (email) {
                    try {
                        const coupon = await getActiveCoupon(playerId);
                        if (coupon) {
                            const discount = Math.min(coupon.amount, entryFee);
                            const remaining = entryFee - discount;
                            await redeemCoupon(coupon.id, tournament.id);
                            if (remaining > 0) {
                                await debitWallet(email, remaining, `Entry fee for ${tournament.name} (${discount} ${GAME.currency} welcome back coupon applied)`, "TOURNAMENT_ENTRY");
                            }
                            couponAppliedCount++;
                        } else {
                            await debitWallet(email, entryFee, `Entry fee for ${tournament.name}`, "TOURNAMENT_ENTRY");
                        }
                    } catch (err) {
                        console.error(`[teams/create] Failed to debit ${playerId}:`, err);
                    }
                }
            }
        }

        const baseMsg = deductUC && entryFee > 0
            ? `Team created. ${entryFee} ${GAME.currency} debited from each player.${couponAppliedCount > 0 ? ` (${couponAppliedCount} welcome back coupon(s) applied)` : ""}`
            : "Team created successfully";
        const propagateMsg = propagatedCount > 0
            ? ` Also added to ${propagatedCount} more match${propagatedCount > 1 ? "es" : ""}.`
            : "";

        return SuccessResponse({
            data: { id: team.id, name: team.name, teamNumber: team.teamNumber },
            message: baseMsg + propagateMsg,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to create team", error });
    }
}
