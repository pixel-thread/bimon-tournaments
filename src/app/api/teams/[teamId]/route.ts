import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { GAME } from "@/lib/game-config";
import { creditWallet, debitWallet, getEmailByPlayerId } from "@/lib/wallet-service";
import { getActiveCoupon, redeemCoupon } from "@/lib/logic/welcomeBack";
import { grantChannelAccess, revokeChannelAccess } from "@/lib/discord-service";

/**
 * PATCH /api/teams/[teamId]
 * Update team players — add or remove players from a team.
 * Body: { addPlayerIds?: string[], removePlayerIds?: string[] }
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ teamId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { teamId } = await params;
        const body = await req.json();
        const {
            addPlayerIds = [],
            removePlayerIds = [],
            deductUC = false,
            refund = false,
        } = body as {
            addPlayerIds?: string[];
            removePlayerIds?: string[];
            deductUC?: boolean;
            refund?: boolean;
        };

        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: {
                players: { select: { id: true } },
                tournament: { select: { id: true, fee: true, name: true, seasonId: true, discordChannelId: true } },
                matches: { select: { id: true } },
            },
        });

        if (!team) {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }

        const entryFee = team.tournament?.fee ?? 0;
        const tournamentName = team.tournament?.name ?? "tournament";

        const tournamentId = team.tournamentId;
        const seasonId = team.tournament?.seasonId ?? null;
        const matchIds = team.matches.map(m => m.id);

        await prisma.$transaction(async (tx) => {
            // Add players
            if (addPlayerIds.length > 0) {
                await tx.team.update({
                    where: { id: teamId },
                    data: {
                        players: {
                            connect: addPlayerIds.map(id => ({ id })),
                        },
                    },
                });

                // Create MatchPlayerPlayed + TeamPlayerStats for each match
                if (tournamentId && matchIds.length > 0) {
                    // Get existing TeamStats for this team (one per match)
                    const teamStatsList = await tx.teamStats.findMany({
                        where: { teamId },
                        select: { id: true, matchId: true },
                    });
                    const teamStatsByMatch = new Map(teamStatsList.map(ts => [ts.matchId, ts.id]));

                    for (const playerId of addPlayerIds) {
                        for (const matchId of matchIds) {
                            // MatchPlayerPlayed (one per player per match — use first match only for dedup)
                            if (matchId === matchIds[0]) {
                                await tx.matchPlayerPlayed.create({
                                    data: {
                                        matchId,
                                        playerId,
                                        tournamentId,
                                        teamId,
                                        ...(seasonId ? { seasonId } : {}),
                                    },
                                }).catch(() => {}); // Ignore if already exists
                            }

                            // TeamPlayerStats
                            const teamStatsId = teamStatsByMatch.get(matchId);
                            if (teamStatsId) {
                                await tx.teamPlayerStats.create({
                                    data: {
                                        playerId,
                                        teamId,
                                        matchId,
                                        teamStatsId,
                                        kills: 0,
                                        present: true,
                                        ...(seasonId ? { seasonId } : {}),
                                    },
                                }).catch(() => {}); // Ignore if already exists
                            }
                        }
                    }
                }
            }

            // Remove players
            if (removePlayerIds.length > 0) {
                await tx.team.update({
                    where: { id: teamId },
                    data: {
                        players: {
                            disconnect: removePlayerIds.map(id => ({ id })),
                        },
                    },
                });

                // Clean up MatchPlayerPlayed + TeamPlayerStats for removed players
                await tx.matchPlayerPlayed.deleteMany({
                    where: { teamId, playerId: { in: removePlayerIds } },
                });
                await tx.teamPlayerStats.deleteMany({
                    where: { teamId, playerId: { in: removePlayerIds } },
                });
            }
        });

        // Wallet operations — done AFTER transaction to avoid timeout
        // (these are cross-DB / external service calls that are too slow for the 5s tx window)
        if (addPlayerIds.length > 0 && deductUC && entryFee > 0) {
            for (const playerId of addPlayerIds) {
                const email = await getEmailByPlayerId(playerId);
                if (email) {
                    try {
                        const coupon = await getActiveCoupon(playerId);
                        if (coupon) {
                            const discount = Math.min(coupon.amount, entryFee);
                            const remaining = entryFee - discount;
                            await redeemCoupon(coupon.id, team.tournament?.id ?? "");
                            if (remaining > 0) {
                                await debitWallet(email, remaining, `Entry fee: Added to team in ${tournamentName} (${discount} ${GAME.currency} coupon applied)`, "TOURNAMENT_ENTRY");
                            }
                        } else {
                            await debitWallet(email, entryFee, `Entry fee: Added to team in ${tournamentName}`, "TOURNAMENT_ENTRY");
                        }
                    } catch (err) {
                        console.error(`[teams/PATCH] Failed to debit ${playerId}:`, err);
                    }
                }
            }
        }

        if (removePlayerIds.length > 0 && refund && entryFee > 0) {
            for (const playerId of removePlayerIds) {
                const email = await getEmailByPlayerId(playerId);
                if (email) {
                    await creditWallet(email, entryFee, `Refund: Removed from team in ${tournamentName}`, "TOURNAMENT_ENTRY");
                }
            }
        }

        // Discord channel access — grant added, revoke removed (fire-and-forget)
        const discordChannelId = team.tournament?.discordChannelId;
        if (discordChannelId) {
            if (addPlayerIds.length > 0) {
                const addedPlayers = await prisma.player.findMany({
                    where: { id: { in: addPlayerIds }, discordId: { not: null } },
                    select: { discordId: true },
                });
                for (const p of addedPlayers) {
                    if (p.discordId) grantChannelAccess(discordChannelId, p.discordId).catch(() => {});
                }
            }
            if (removePlayerIds.length > 0) {
                const removedPlayers = await prisma.player.findMany({
                    where: { id: { in: removePlayerIds }, discordId: { not: null } },
                    select: { discordId: true },
                });
                for (const p of removedPlayers) {
                    if (p.discordId) revokeChannelAccess(discordChannelId, p.discordId).catch(() => {});
                }
            }
        }

        // Fetch updated team
        const updated = await prisma.team.findUnique({
            where: { id: teamId },
            include: {
                players: {
                    select: {
                        id: true,
                        displayName: true,
                        user: { select: { username: true } },
                    },
                },
            },
        });

        const parts: string[] = [];
        if (addPlayerIds.length > 0) parts.push(`+${addPlayerIds.length} added${deductUC && entryFee > 0 ? ` (${entryFee} ${GAME.currency} deducted each)` : ""}`);
        if (removePlayerIds.length > 0) parts.push(`-${removePlayerIds.length} removed${refund && entryFee > 0 ? ` (${entryFee} ${GAME.currency} refunded each)` : ""}`);

        return NextResponse.json({
            success: true,
            message: `Team updated: ${parts.join(", ")}`,
            data: {
                id: updated?.id,
                playerCount: updated?.players.length ?? 0,
                players: updated?.players.map(p => ({
                    id: p.id,
                    name: p.displayName || p.user.username,
                })),
            },
        });
    } catch (error) {
        console.error("Error updating team:", error);
        return NextResponse.json({ error: "Failed to update team" }, { status: 500 });
    }
}

/**
 * DELETE /api/teams/[teamId]
 * Delete a team and all associated records.
 * Body: { refund?: boolean }
 * If refund is true, the tournament entry fee is credited back to each player's wallet.
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ teamId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== "SUPER_ADMIN") {
            return ErrorResponse({ message: "Unauthorized", status: 403 });
        }

        const { teamId } = await params;

        let refund = false;
        try {
            const body = await req.json();
            refund = !!body.refund;
        } catch {
            // No body or invalid JSON — default to no refund
        }

        // Fetch the team with players and tournament info
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: {
                players: {
                    select: { id: true, discordId: true, user: { select: { username: true } } },
                },
                tournament: {
                    select: { id: true, name: true, fee: true, discordChannelId: true },
                },
            },
        });

        if (!team) {
            return ErrorResponse({ message: "Team not found", status: 404 });
        }

        const entryFee = team.tournament?.fee ?? 0;
        const playerIds = team.players.map((p) => p.id);
        const refundedPlayers: string[] = [];

        // Run all delete operations in a transaction
        await prisma.$transaction(async (tx) => {
            // 1. Delete related records
            await tx.teamPlayerStats.deleteMany({ where: { teamId } });
            await tx.teamStats.deleteMany({ where: { teamId } });
            await tx.matchPlayerPlayed.deleteMany({ where: { teamId } });
            await tx.tournamentWinner.deleteMany({ where: { teamId } });

            // 2. Disconnect team from matches and players, then delete
            await tx.team.update({
                where: { id: teamId },
                data: {
                    matches: { set: [] },
                    players: { set: [] },
                },
            });

            await tx.team.delete({ where: { id: teamId } });
        });

        // Wallet refunds — done AFTER transaction to avoid timeout
        if (refund && entryFee > 0 && playerIds.length > 0) {
            for (const playerId of playerIds) {
                const email = await getEmailByPlayerId(playerId);
                if (email) {
                    await creditWallet(email, entryFee, `Refund: Team deleted from ${team.tournament?.name ?? "tournament"}`, "TOURNAMENT_ENTRY");
                }
            }
            refundedPlayers.push(...playerIds);
        }

        const refundMsg =
            refund && entryFee > 0 && refundedPlayers.length > 0
                ? ` ${entryFee} ${GAME.currency} refunded to ${refundedPlayers.length} player(s).`
                : "";

        // Revoke Discord channel access for all team members (fire-and-forget)
        const discordChannelId = team.tournament?.discordChannelId;
        if (discordChannelId) {
            for (const p of team.players) {
                if (p.discordId) revokeChannelAccess(discordChannelId, p.discordId).catch(() => {});
            }
        }

        return SuccessResponse({
            message: `Team "${team.name}" deleted.${refundMsg}`,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to delete team", error });
    }
}
