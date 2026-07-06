import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { type NextRequest } from "next/server";
import { GAME } from "@/lib/game-config";

/**
 * DELETE /api/matches/[id]
 *
 * - Match #1 → Full tournament reset (delete ALL matches, teams, stats,
 *   refund entry fees, reactivate poll, set tournament ACTIVE).
 * - Any other match → Delete only that match (cascade via schema).
 */
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return ErrorResponse({ message: "Unauthorized", status: 403 });
        }

        const { id } = await params;

        const match = await prisma.match.findUnique({
            where: { id },
            select: { id: true, matchNumber: true, tournamentId: true },
        });

        if (!match) return ErrorResponse({ message: "Match not found", status: 404 });

        // ── Match #1 → Full tournament reset (only if it has teams) ──
        const teamCountForMatch = await prisma.team.count({
            where: { tournamentId: match.tournamentId, matches: { some: { id: match.id } } },
        });
        const isMatchWithTeams = teamCountForMatch > 0;

        if (match.matchNumber === 1 && isMatchWithTeams) {
            const tournamentId = match.tournamentId;

            const tournament = await prisma.tournament.findUnique({
                where: { id: tournamentId },
                select: {
                    name: true,
                    matches: { select: { id: true, matchNumber: true } },
                    poll: { select: { id: true } },
                    squads: { where: { status: "REGISTERED" }, select: { id: true } },
                },
            });

            if (!tournament) {
                return ErrorResponse({ message: "Tournament not found", status: 404 });
            }

            // Find ALL entry fee debit transactions to refund
            // Covers both regular ("Entry fee for ...") and squad ("Squad entry fee for ...") patterns
            const entryFeeTransactions = await prisma.transaction.findMany({
                where: {
                    type: "DEBIT",
                    OR: [
                        { description: { startsWith: `Entry fee for ${tournament.name}` } },
                        { description: { startsWith: `Squad entry fee for ${tournament.name}` } },
                    ],
                },
                select: { id: true, playerId: true, amount: true, description: true },
            });

            // Find clan treasury debits to refund (squads that used clan treasury)
            const clanTreasuryDebits = await prisma.clanTransaction.findMany({
                where: {
                    type: "DEBIT",
                    description: { startsWith: `Squad entry fee for ${tournament.name}` },
                },
                select: { id: true, clanId: true, amount: true },
            });

            await prisma.$transaction(
                async (tx) => {
                    // 1. Delete TournamentWinners
                    await tx.tournamentWinner.deleteMany({ where: { tournamentId } });

                    // 2. Delete MatchPlayerPlayed
                    await tx.matchPlayerPlayed.deleteMany({ where: { tournamentId } });

                    // 3. Delete TeamPlayerStats for all matches
                    for (const m of tournament.matches) {
                        await tx.teamPlayerStats.deleteMany({ where: { matchId: m.id } });
                    }

                    // 4. Delete TeamStats
                    await tx.teamStats.deleteMany({ where: { tournamentId } });

                    // 5. Delete all Matches
                    await tx.match.deleteMany({ where: { tournamentId } });

                    // 6. Delete all Teams
                    await tx.team.deleteMany({ where: { tournamentId } });

                    // 7. Reverse entry fees — silent restore (no transaction history)
                    if (entryFeeTransactions.length > 0) {
                        const refundsByPlayer = new Map<string, number>();
                        for (const txn of entryFeeTransactions) {
                            refundsByPlayer.set(
                                txn.playerId,
                                (refundsByPlayer.get(txn.playerId) || 0) + txn.amount,
                            );
                        }

                        // Directly restore wallet balances — no credit transaction created
                        for (const [playerId, amount] of refundsByPlayer) {
                            const player = await tx.player.findUnique({
                                where: { id: playerId },
                                include: { wallet: true },
                            });
                            if (player?.wallet) {
                                await tx.wallet.update({
                                    where: { playerId },
                                    data: { balance: player.wallet.balance + amount },
                                });
                            }
                        }

                        // Delete original debit transactions — clean slate, no trace
                        await tx.transaction.deleteMany({
                            where: { id: { in: entryFeeTransactions.map((t) => t.id) } },
                        });
                    }

                    // 7b. Reverse clan treasury debits — restore clan balances
                    if (clanTreasuryDebits.length > 0) {
                        const refundsByClan = new Map<string, number>();
                        for (const ct of clanTreasuryDebits) {
                            refundsByClan.set(
                                ct.clanId,
                                (refundsByClan.get(ct.clanId) || 0) + ct.amount,
                            );
                        }

                        for (const [clanId, amount] of refundsByClan) {
                            await tx.clan.update({
                                where: { id: clanId },
                                data: { balance: { increment: amount } },
                            });
                        }

                        // Delete original clan debit transactions
                        await tx.clanTransaction.deleteMany({
                            where: { id: { in: clanTreasuryDebits.map((t) => t.id) } },
                        });
                    }

                    // 8. Reset tournament flags
                    await tx.tournament.update({
                        where: { id: tournamentId },
                        data: {
                            isWinnerDeclared: false,
                            status: "ACTIVE",
                        },
                    });

                    // 9. Reactivate the poll
                    if (tournament.poll) {
                        await tx.poll.update({
                            where: { id: tournament.poll.id },
                            data: { isActive: true },
                        });
                    }

                    // 10. Reset REGISTERED squads back to FULL + clear confirmedAt (fees were refunded)
                    if (tournament.squads.length > 0) {
                        await tx.squad.updateMany({
                            where: { id: { in: tournament.squads.map(s => s.id) } },
                            data: { status: "FULL", confirmedAt: null },
                        });
                    }
                },
                { maxWait: 30000, timeout: 120000 },
            );

            const refundTotal = entryFeeTransactions.reduce((s, t) => s + t.amount, 0);
            const clanRefundTotal = clanTreasuryDebits.reduce((s, t) => s + t.amount, 0);
            const refundParts: string[] = [];
            if (refundTotal > 0) refundParts.push(`Refunded ${refundTotal} ${GAME.currency} to wallets.`);
            if (clanRefundTotal > 0) refundParts.push(`Refunded ${clanRefundTotal} ${GAME.currency} to clan treasuries.`);
            return SuccessResponse({
                message: `Tournament fully reset! Deleted ${tournament.matches.length} match(es), all teams & stats.${refundParts.length > 0 ? ` ${refundParts.join(" ")}` : ""} Poll reactivated.`,
            });
        }

        // ── Any other match → normal single-match delete ─────────
        await prisma.match.delete({ where: { id } });

        // Renumber remaining matches to close gaps (e.g. if match 2 of 4 is deleted → 1,3,4 becomes 1,2,3)
        const remaining = await prisma.match.findMany({
            where: { tournamentId: match.tournamentId },
            orderBy: { matchNumber: "asc" },
            select: { id: true, matchNumber: true },
        });
        for (let i = 0; i < remaining.length; i++) {
            const expected = i + 1;
            if (remaining[i].matchNumber !== expected) {
                await prisma.match.update({
                    where: { id: remaining[i].id },
                    data: { matchNumber: expected },
                });
            }
        }

        return SuccessResponse({ message: `Match #${match.matchNumber} deleted` });
    } catch (error) {
        return ErrorResponse({ message: "Failed to delete match", error });
    }
}
