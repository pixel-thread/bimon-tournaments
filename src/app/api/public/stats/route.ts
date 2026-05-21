import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";

/**
 * GET /api/public/stats
 * Public endpoint — no auth required.
 * Returns aggregate platform stats for the about page.
 */
export async function GET() {
    try {
        const [
            totalPlayers,
            totalTournaments,
            totalMatches,
            totalTeams,
            prizePoolData,
        ] = await Promise.all([
            prisma.player.count(),
            prisma.tournament.count({ where: { isWinnerDeclared: true } }),
            prisma.match.count(),
            prisma.team.count(),
            prisma.tournamentWinner.aggregate({ _sum: { amount: true } }),
        ]);

        return SuccessResponse({
            data: {
                totalPlayers,
                totalTournaments,
                totalMatches,
                totalTeams,
                totalPrizeDistributed: prizePoolData._sum.amount ?? 0,
            },
            cache: CACHE.LONG,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch stats", error });
    }
}
