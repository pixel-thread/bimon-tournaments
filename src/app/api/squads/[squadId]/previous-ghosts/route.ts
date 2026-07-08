import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { type NextRequest } from "next/server";

/**
 * GET /api/squads/[squadId]/previous-ghosts
 * 
 * Returns ghost players this captain has previously added to any squad.
 * Used for "Quick Add" — one tap to re-add a familiar teammate.
 * Filters out players already in a squad for this tournament.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ squadId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        const { squadId } = await params;
        const currentPlayerId = user.player.id;

        // Get this squad's pollId
        const squad = await prisma.squad.findUnique({
            where: { id: squadId },
            select: { captainId: true, pollId: true },
        });

        const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
        if (!squad || (squad.captainId !== currentPlayerId && !isAdmin)) {
            return ErrorResponse({ message: "Squad not found or not captain", status: 404 });
        }

        // Find all squads this captain has ever led
        const captainSquads = await prisma.squad.findMany({
            where: { captainId: currentPlayerId },
            select: { id: true },
        });

        const squadIds = captainSquads.map((s) => s.id);

        if (squadIds.length === 0) {
            return SuccessResponse({ data: [], cache: CACHE.NONE });
        }

        // Find all ghost players that were in this captain's squads
        const ghostInvites = await prisma.squadInvite.findMany({
            where: {
                squadId: { in: squadIds },
                player: { isGhost: true },
            },
            include: {
                player: {
                    select: {
                        id: true,
                        displayName: true,
                        phoneNumber: true,
                        isGhost: true,
                    },
                },
            },
            distinct: ["playerId"],
            orderBy: { createdAt: "desc" },
        });

        if (ghostInvites.length === 0) {
            return SuccessResponse({ data: [], cache: CACHE.NONE });
        }

        // Filter out ghosts already in a squad for this tournament
        const ghostPlayerIds = ghostInvites.map((g) => g.playerId);
        const alreadyInTournament = await prisma.squadInvite.findMany({
            where: {
                playerId: { in: ghostPlayerIds },
                status: { in: ["ACCEPTED", "PENDING"] },
                squad: {
                    pollId: squad.pollId,
                    status: "FORMING",
                },
            },
            select: { playerId: true },
        });

        const inTournamentIds = new Set(alreadyInTournament.map((s) => s.playerId));

        const data = ghostInvites
            .filter((g) => !inTournamentIds.has(g.playerId))
            .map((g) => ({
                id: g.player.id,
                displayName: g.player.displayName || "Unknown",
                phone: g.player.phoneNumber
                    ? `${g.player.phoneNumber.slice(0, 4)}****${g.player.phoneNumber.slice(-2)}`
                    : null,
            }));

        return SuccessResponse({ data, cache: CACHE.NONE });
    } catch (error) {
        console.error("Failed to fetch previous ghosts:", error);
        return ErrorResponse({ message: "Failed to fetch previous teammates", error });
    }
}
