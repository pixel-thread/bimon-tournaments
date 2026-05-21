import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";

/**
 * GET /api/public/tournaments
 * Public endpoint — no auth required.
 * Returns completed tournaments with winner data for public display.
 */
export async function GET() {
    try {
        const tournaments = await prisma.tournament.findMany({
            where: { isWinnerDeclared: true },
            orderBy: { startDate: "desc" },
            take: 30,
            select: {
                id: true,
                name: true,
                startDate: true,
                type: true,
                isTDM: true,
                isWoW: true,
                fee: true,
                _count: { select: { teams: true, matches: true } },
                winners: {
                    orderBy: { position: "asc" },
                    take: 3,
                    select: {
                        position: true,
                        amount: true,
                        team: {
                            select: {
                                name: true,
                                players: {
                                    select: {
                                        displayName: true,
                                    },
                                    take: 4,
                                },
                            },
                        },
                    },
                },
                poll: {
                    select: {
                        teamType: true,
                        allowSquads: true,
                    },
                },
            },
        });

        const data = tournaments.map((t) => ({
            id: t.id,
            name: t.name,
            date: t.startDate.toISOString(),
            type: t.isTDM ? "TDM" : t.isWoW ? "WoW" : t.type,
            teamType: t.poll?.teamType ?? "SQUAD",
            isSquad: t.poll?.allowSquads ?? false,
            entryFee: t.fee ?? 0,
            teamCount: t._count.teams,
            matchCount: t._count.matches,
            totalPrizePool: t.winners.reduce((sum, w) => sum + w.amount, 0),
            winners: t.winners.map((w) => ({
                position: w.position,
                amount: w.amount,
                teamName: w.team.name,
                players: w.team.players.map((p) => p.displayName),
            })),
        }));

        return SuccessResponse({ data, cache: CACHE.LONG });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch tournaments", error });
    }
}
