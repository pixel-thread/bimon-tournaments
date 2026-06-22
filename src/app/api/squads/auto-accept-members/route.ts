import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { type NextRequest } from "next/server";

/**
 * GET /api/squads/auto-accept-members?squadId=xxx
 * Returns clan members who have autoAcceptSquadInvites enabled.
 * For each member, includes:
 *  - Whether they're already in this squad (alreadyInSquad)
 *  - If they're in another squad for this poll, the team name (existingTeamName)
 * Captain-only.
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Player profile required", status: 403 });
        }

        const squadId = request.nextUrl.searchParams.get("squadId");
        if (!squadId) {
            return ErrorResponse({ message: "squadId is required", status: 400 });
        }

        const currentPlayerId = user.player.id;

        // Fetch squad
        const squad = await prisma.squad.findUnique({
            where: { id: squadId },
            select: {
                id: true,
                captainId: true,
                clanId: true,
                pollId: true,
                status: true,
                invites: { select: { playerId: true, status: true } },
            },
        });

        if (!squad) {
            return ErrorResponse({ message: "Squad not found", status: 404 });
        }

        // Must be the captain or admin
        const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
        if (squad.captainId !== currentPlayerId && !isAdmin) {
            return ErrorResponse({ message: "Only the squad leader can view this", status: 403 });
        }

        // Must be a clan squad
        if (!squad.clanId) {
            return SuccessResponse({ data: [], cache: CACHE.NONE });
        }

        // Get all clan members with auto-accept ON (excluding the captain)
        const autoAcceptMembers = await prisma.clanMember.findMany({
            where: {
                clanId: squad.clanId,
                autoAcceptSquadInvites: true,
                role: { not: "LEADER" },
                playerId: { not: currentPlayerId },
                player: {
                    isBanned: false,
                },
            },
            select: {
                playerId: true,
                player: {
                    select: {
                        id: true,
                        displayName: true,
                        customProfileImageUrl: true,
                        user: { select: { username: true, imageUrl: true } },
                    },
                },
            },
        });

        // Check which are already in THIS squad
        const alreadyInSquadPlayerIds = new Set(
            squad.invites.filter((i) => i.status === "ACCEPTED" || i.status === "PENDING").map((i) => i.playerId)
        );

        // Check which are in OTHER squads for this poll — include the team name
        const otherSquadInvites = await prisma.squadInvite.findMany({
            where: {
                playerId: { in: autoAcceptMembers.map((m) => m.playerId) },
                status: { in: ["PENDING", "ACCEPTED"] },
                squad: {
                    pollId: squad.pollId,
                    status: { in: ["FORMING", "FULL"] },
                    id: { not: squadId },
                },
            },
            select: {
                playerId: true,
                squad: { select: { name: true } },
            },
        });
        const otherSquadMap = new Map<string, string>();
        for (const inv of otherSquadInvites) {
            otherSquadMap.set(inv.playerId, inv.squad.name);
        }

        const result = autoAcceptMembers.map((m) => ({
            id: m.player.id,
            displayName: m.player.displayName || m.player.user.username,
            imageUrl: m.player.customProfileImageUrl || m.player.user.imageUrl || "",
            alreadyInSquad: alreadyInSquadPlayerIds.has(m.playerId),
            existingTeamName: otherSquadMap.get(m.playerId) || null,
        }));

        return SuccessResponse({ data: result, cache: CACHE.NONE });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch auto-accept members", error });
    }
}
