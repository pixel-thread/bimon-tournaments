import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { GAME } from "@/lib/game-config";

/**
 * GET /api/public/leaderboard
 * Public endpoint — no auth required.
 * Returns top 30 players with stats for public leaderboard display.
 */
export async function GET() {
    try {
        // Get active season
        const activeSeason = await prisma.season.findFirst({
            where: { status: "ACTIVE" },
            select: { id: true, name: true },
        });

        const seasonId = activeSeason?.id;

        // Aggregate stats from TeamPlayerStats
        const tpsAgg = await prisma.teamPlayerStats.groupBy({
            by: ["playerId"],
            where: {
                present: true,
                ...(seasonId ? { seasonId } : {}),
            },
            _count: { matchId: true },
            _sum: { kills: true },
            orderBy: { _sum: { kills: "desc" } },
            take: 50,
        });

        if (tpsAgg.length === 0) {
            return SuccessResponse({
                data: { season: activeSeason?.name ?? "Current", players: [] },
                cache: CACHE.LONG,
            });
        }

        const playerIds = tpsAgg.map((s) => s.playerId);

        // Fetch player info
        const players = await prisma.player.findMany({
            where: { id: { in: playerIds }, isBanned: false },
            select: {
                id: true,
                displayName: true,
                user: { select: { username: true } },
            },
        });

        const playerMap = new Map(players.map((p) => [p.id, p]));

        // Bracket wins (for PES)
        const bracketWins = GAME.features.hasBracket
            ? await prisma.bracketMatch.groupBy({
                by: ["winnerId"],
                where: { winnerId: { in: playerIds }, status: "CONFIRMED" },
                _count: { id: true },
            })
            : [];
        const winsMap = new Map(bracketWins.map((w) => [w.winnerId!, w._count.id]));

        const data = tpsAgg
            .map((s) => {
                const player = playerMap.get(s.playerId);
                if (!player) return null;
                const kills = s._sum.kills ?? 0;
                const matches = s._count.matchId;
                const kd = matches > 0 ? kills / matches : 0;
                return {
                    displayName: player.displayName,
                    kills,
                    matches,
                    kd: Number(kd.toFixed(2)),
                    wins: winsMap.get(player.id) ?? 0,
                };
            })
            .filter(Boolean)
            .sort((a, b) => b!.kd - a!.kd)
            .slice(0, 30);

        return SuccessResponse({
            data: { season: activeSeason?.name ?? "Current", players: data },
            cache: CACHE.LONG,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch leaderboard", error });
    }
}
