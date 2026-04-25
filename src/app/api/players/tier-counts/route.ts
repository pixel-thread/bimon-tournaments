import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCategoryFromKDValue } from "@/lib/logic/categoryUtils";
import { type NextRequest } from "next/server";

/**
 * GET /api/players/tier-counts?season=<id>
 * Returns count of non-banned players grouped by dynamically computed category.
 * Category is computed from per-season KD (same logic as the players list).
 */
export async function GET(request: NextRequest) {
    try {
        const season = request.nextUrl.searchParams.get("season") ?? "";

        // Resolve season id
        let seasonId = season === "all" ? "" : season;
        if (!seasonId) {
            const active = await prisma.season.findFirst({
                where: { status: "ACTIVE" },
                select: { id: true },
            });
            if (active) seasonId = active.id;
        }

        // Get all non-banned players
        const players = await prisma.player.findMany({
            where: { isBanned: false },
            select: { id: true },
        });
        const playerIds = players.map((p) => p.id);

        // Get per-season stats
        const tpsWhere: Record<string, unknown> = { playerId: { in: playerIds }, present: true };
        if (seasonId) tpsWhere.seasonId = seasonId;

        const tpsAgg = await prisma.teamPlayerStats.groupBy({
            by: ["playerId"],
            where: tpsWhere,
            _count: { matchId: true },
            _sum: { kills: true },
        });
        const statsMap = new Map(
            tpsAgg.map((s) => [s.playerId, { kills: s._sum.kills ?? 0, matches: s._count.matchId }])
        );

        // Compute tier counts dynamically (no "All" key — frontend sums them)
        const data: Record<string, number> = {};
        for (const pid of playerIds) {
            const st = statsMap.get(pid);
            const kd = st && st.matches > 0 ? st.kills / st.matches : 0;
            const category = getCategoryFromKDValue(kd);
            data[category] = (data[category] ?? 0) + 1;
        }

        return SuccessResponse({ data, cache: CACHE.MEDIUM });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch tier counts", error });
    }
}
