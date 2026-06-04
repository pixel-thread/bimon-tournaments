import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";

/**
 * GET /api/tournaments/unlinked-leaders?tournamentId=xxx
 * Returns team leaders (first player) who don't have Discord linked,
 * along with their phone number for WhatsApp fallback.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const tournamentId = searchParams.get("tournamentId");

        if (!tournamentId) {
            return ErrorResponse({ message: "tournamentId is required", status: 400 });
        }

        // Get all teams for this tournament with their players
        const teams = await prisma.team.findMany({
            where: { tournamentId },
            select: {
                id: true,
                name: true,
                teamNumber: true,
                players: {
                    select: {
                        id: true,
                        displayName: true,
                        phoneNumber: true,
                        discordId: true,
                        discordUsername: true,
                    },
                },
            },
            orderBy: { teamNumber: "asc" },
        });

        // For each team, leader = first player. Filter to unlinked only.
        const unlinkedLeaders = teams
            .filter(t => t.players.length > 0)
            .map(t => {
                const leader = t.players[0];
                return {
                    teamName: t.name,
                    teamNumber: t.teamNumber,
                    playerName: leader.displayName || "Unknown",
                    phoneNumber: leader.phoneNumber || null,
                    hasDiscord: !!leader.discordId,
                };
            })
            .filter(l => !l.hasDiscord);

        return SuccessResponse({ data: unlinkedLeaders });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch unlinked leaders", error });
    }
}
