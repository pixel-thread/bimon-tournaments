import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";

/**
 * GET /api/winners/recent
 * Returns last 6 tournament results with winners, player leaderboard,
 * and total fund amount for the public winners page.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const mode = searchParams.get("mode") || "casual"; // casual | ranked | tdm | wow

        // Find the current active season
        const activeSeason = await prisma.season.findFirst({
            where: { status: "ACTIVE" },
            select: { id: true },
        });

        // Build mode-specific where clause
        const modeFilter: any = {};
        if (mode === "tdm") {
            modeFilter.isTDM = true;
            modeFilter.isWoW = false;
        } else if (mode === "wow") {
            modeFilter.isWoW = true;
        } else if (mode === "ranked") {
            modeFilter.isTDM = false;
            modeFilter.isWoW = false;
            modeFilter.poll = { allowSquads: true };
        } else {
            // casual (default)
            modeFilter.isTDM = false;
            modeFilter.isWoW = false;
            modeFilter.poll = { allowSquads: false };
        }

        // 1. Fetch last 6 tournaments that have declared winners (active season only)
        const tournaments = await prisma.tournament.findMany({
            where: {
                isWinnerDeclared: true,
                ...(activeSeason ? { seasonId: activeSeason.id } : {}),
                ...modeFilter,
            },
            orderBy: { startDate: "desc" },
            take: 6,
            select: {
                id: true,
                name: true,
                createdAt: true,
                winners: {
                    orderBy: { position: "asc" },
                    select: {
                        position: true,
                        team: {
                            select: {
                                players: {
                                    select: {
                                        displayName: true,
                                        user: {
                                            select: { username: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        // 2. Transform tournaments into the expected format
        const tournamentResults = tournaments.map((t) => {
            const places = t.winners.map((w) => ({
                position: w.position,
                players: w.team.players.map(
                    (p) => p.displayName || p.user.username
                ),
            }));

            return {
                id: t.id,
                name: t.name,
                createdAt: t.createdAt.toISOString(),
                places,
            };
        });

        // 3. Build player placement leaderboard from these tournaments
        const placementMap = new Map<
            string,
            { first: number; second: number; third: number }
        >();

        for (const t of tournaments) {
            for (const w of t.winners) {
                if (w.position > 4) continue;
                for (const p of w.team.players) {
                    const name = p.displayName || p.user.username;
                    const entry = placementMap.get(name) || {
                        first: 0,
                        second: 0,
                        third: 0,
                    };
                    if (w.position === 1) entry.first++;
                    else if (w.position === 2) entry.second++;
                    else if (w.position === 3) entry.third++;
                    placementMap.set(name, entry);
                }
            }
        }

        const playerPlacements = Array.from(placementMap.entries())
            .map(([name, counts]) => ({
                name,
                firstPlaceCount: counts.first,
                secondPlaceCount: counts.second,
                thirdPlaceCount: counts.third,
                totalPlacements: counts.first + counts.second + counts.third,
            }))
            .sort((a, b) => {
                // Sort by total placements first, then by 1st > 2nd > 3rd as tiebreakers
                const diff = b.totalPlacements - a.totalPlacements;
                if (diff !== 0) return diff;
                if (b.firstPlaceCount !== a.firstPlaceCount) return b.firstPlaceCount - a.firstPlaceCount;
                if (b.secondPlaceCount !== a.secondPlaceCount) return b.secondPlaceCount - a.secondPlaceCount;
                return b.thirdPlaceCount - a.thirdPlaceCount;
            });

        // 4. Calculate total funds from Income records with "Fund" description
        const fundIncome = await prisma.income.aggregate({
            where: {
                description: { startsWith: "Fund" },
                isSubIncome: false,
            },
            _sum: { amount: true },
        });

        const totalFunds = fundIncome._sum.amount || 0;

        return SuccessResponse({
            data: {
                tournaments: tournamentResults,
                playerPlacements,
                totalFunds,
            },
            cache: CACHE.MEDIUM,
        });
    } catch (error) {
        return ErrorResponse({
            message: "Failed to fetch recent winners",
            error,
        });
    }
}
