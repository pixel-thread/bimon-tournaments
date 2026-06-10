import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";

/**
 * GET /api/push/team-status?tournamentId=xxx
 * Returns teams with push notification status per player.
 * Admin only.
 */
export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return ErrorResponse({ message: "Admin only", status: 403 });
        }

        const tournamentId = new URL(req.url).searchParams.get("tournamentId");
        if (!tournamentId) {
            return ErrorResponse({ message: "tournamentId required", status: 400 });
        }

        // Fetch teams with players for this tournament
        const teams = await prisma.team.findMany({
            where: { tournamentId, disqualified: false },
            orderBy: { teamNumber: "asc" },
            select: {
                id: true,
                name: true,
                teamNumber: true,
                players: {
                    select: {
                        id: true,
                        displayName: true,
                        customProfileImageUrl: true,
                        user: { select: { imageUrl: true } },
                    },
                },
            },
        });

        // Get all player IDs in one query
        const allPlayerIds = teams.flatMap((t) => t.players.map((p) => p.id));

        // Find which players have push subscriptions
        const pushSubs = await prisma.pushSubscription.groupBy({
            by: ["playerId"],
            where: { playerId: { in: allPlayerIds } },
            _count: { id: true },
        });
        const pushMap = new Map(pushSubs.map((s) => [s.playerId, s._count.id]));

        // Build response
        const result = teams.map((team) => ({
            id: team.id,
            name: team.name,
            teamNumber: team.teamNumber,
            players: team.players.map((p) => ({
                id: p.id,
                displayName: p.displayName,
                avatar: p.customProfileImageUrl || p.user?.imageUrl || null,
                pushEnabled: pushMap.has(p.id),
                deviceCount: pushMap.get(p.id) || 0,
            })),
            pushCount: team.players.filter((p) => pushMap.has(p.id)).length,
            totalPlayers: team.players.length,
        }));

        const totalPlayers = allPlayerIds.length;
        const totalWithPush = pushMap.size;

        return SuccessResponse({
            message: "Team push status",
            data: {
                teams: result,
                summary: { totalPlayers, totalWithPush, percentage: totalPlayers > 0 ? Math.round((totalWithPush / totalPlayers) * 100) : 0 },
            },
            cache: CACHE.SHORT,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch team push status", error });
    }
}
