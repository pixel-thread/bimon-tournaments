import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { type NextRequest } from "next/server";

/**
 * GET /api/squads/audit?squadId=xxx
 * GET /api/squads/audit?playerId=xxx
 * Admin-only: fetch squad audit log entries.
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
            return ErrorResponse({ message: "Admin access required", status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const squadId = searchParams.get("squadId");
        const playerId = searchParams.get("playerId");

        if (!squadId && !playerId) {
            return ErrorResponse({ message: "squadId or playerId is required", status: 400 });
        }

        const where: Record<string, string> = {};
        if (squadId) where.squadId = squadId;
        if (playerId) where.playerId = playerId;

        const logs = await prisma.squadAuditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: 50,
        });

        // Resolve player names for display
        const playerIds = [...new Set(logs.flatMap(l => [l.playerId, l.actorId].filter(Boolean) as string[]))];
        const players = await prisma.player.findMany({
            where: { id: { in: playerIds } },
            select: { id: true, displayName: true, user: { select: { username: true } } },
        });
        const nameMap: Record<string, string> = {};
        for (const p of players) {
            nameMap[p.id] = p.displayName ?? p.user.username;
        }

        // Resolve squad names
        const squadIds = [...new Set(logs.map(l => l.squadId))];
        const squads = await prisma.squad.findMany({
            where: { id: { in: squadIds } },
            select: { id: true, name: true },
        });
        const squadNameMap: Record<string, string> = {};
        for (const s of squads) {
            squadNameMap[s.id] = s.name;
        }

        const enriched = logs.map(l => ({
            id: l.id,
            action: l.action,
            playerName: nameMap[l.playerId] ?? l.playerId,
            actorName: l.actorId ? (nameMap[l.actorId] ?? l.actorId) : null,
            squadName: squadNameMap[l.squadId] ?? l.squadId,
            details: l.details,
            createdAt: l.createdAt,
        }));

        return SuccessResponse({ data: enriched });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch audit log", error });
    }
}
