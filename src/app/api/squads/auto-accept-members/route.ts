import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { type NextRequest } from "next/server";

/**
 * GET /api/squads/auto-accept-members?squadId=xxx
 * Returns clan members who have autoAcceptSquadInvites enabled and are
 * eligible to be invited to this squad (same clan, not already in a squad
 * for this poll, not banned, etc.).
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

        // Must be the captain
        if (squad.captainId !== currentPlayerId) {
            return ErrorResponse({ message: "Only the squad leader can view this", status: 403 });
        }

        // Must be a clan squad
        if (!squad.clanId) {
            return SuccessResponse({ data: [], cache: CACHE.NONE });
        }

        // Get all clan members with auto-accept ON (excluding the captain and leader)
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

        // Filter out members who are already in this squad or in another squad for this poll
        const alreadyInSquadPlayerIds = new Set(squad.invites.map((i) => i.playerId));

        const inOtherSquads = await prisma.squadInvite.findMany({
            where: {
                playerId: { in: autoAcceptMembers.map((m) => m.playerId) },
                status: { in: ["PENDING", "ACCEPTED"] },
                squad: {
                    pollId: squad.pollId,
                    status: { in: ["FORMING", "FULL"] },
                },
            },
            select: { playerId: true },
        });
        const inOtherSquadPlayerIds = new Set(inOtherSquads.map((i) => i.playerId));

        const eligible = autoAcceptMembers
            .filter((m) => !alreadyInSquadPlayerIds.has(m.playerId) && !inOtherSquadPlayerIds.has(m.playerId))
            .map((m) => ({
                id: m.player.id,
                displayName: m.player.displayName || m.player.user.username,
                imageUrl: m.player.customProfileImageUrl || m.player.user.imageUrl || "",
            }));

        return SuccessResponse({ data: eligible, cache: CACHE.NONE });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch auto-accept members", error });
    }
}
