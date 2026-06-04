import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";

/**
 * GET /api/tournaments/unlinked-leaders?tournamentId=xxx
 * Returns team leaders who don't have Discord linked,
 * plus the WhatsApp group link from the poll.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const tournamentId = searchParams.get("tournamentId");

        if (!tournamentId) {
            return ErrorResponse({ message: "tournamentId is required", status: 400 });
        }

        // Get the poll for this tournament
        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            select: {
                name: true,
                poll: {
                    select: {
                        id: true,
                        allowSquads: true,
                        whatsappGroupLink: true,
                    },
                },
            },
        });

        const whatsappGroupLink = tournament?.poll?.whatsappGroupLink || null;

        // Build captain map for squad teams
        const captainMap = new Map<string, boolean>();
        if (tournament?.poll?.id && tournament.poll.allowSquads) {
            const squads = await prisma.squad.findMany({
                where: { pollId: tournament.poll.id, status: "REGISTERED" },
                select: { captainId: true },
            });
            for (const s of squads) {
                captainMap.set(s.captainId, true);
            }
        }

        // Get all teams with their players
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
                    },
                    orderBy: { createdAt: "asc" },
                },
            },
            orderBy: { teamNumber: "asc" },
        });

        const unlinkedLeaders = teams
            .filter(t => t.players.length > 0)
            .map(t => {
                const leader = t.players.find(p => captainMap.has(p.id)) || t.players[0];
                return {
                    teamName: t.name,
                    teamNumber: t.teamNumber,
                    playerName: leader.displayName || "Unknown",
                    phoneNumber: leader.phoneNumber || null,
                    hasDiscord: !!leader.discordId,
                };
            })
            .filter(l => !l.hasDiscord);

        return SuccessResponse({
            data: unlinkedLeaders,
            whatsappGroupLink,
            tournamentName: tournament?.name || "",
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch unlinked leaders", error });
    }
}
