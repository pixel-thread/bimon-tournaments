import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/polls/pending-merit
 * Returns teammates the current player has NOT yet rated from the most recent
 * completed tournament they participated in.
 *
 * Logic:
 *  1. Find the last tournament where winners were declared AND the player participated.
 *  2. Find teammates the player was on a team with in that tournament.
 *  3. Exclude any teammates already rated for that tournament.
 */
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return SuccessResponse({ data: { pending: [], tournamentId: null, tournamentName: null } });
        }

        // Rating is always required after winner declaration.
        // The "merit_rating_enabled" toggle only controls whether low scores
        // trigger bans/penalties — it does NOT skip the rating step.

        const playerId = user.player.id;

        // Find last completed tournament this player participated in
        const lastTournamentMatch = await prisma.matchPlayerPlayed.findFirst({
            where: {
                playerId,
                tournament: { isWinnerDeclared: true },
            },
            orderBy: { createdAt: "desc" },
            select: {
                tournamentId: true,
                tournament: {
                    select: {
                        name: true,
                        poll: { select: { allowSquads: true } },
                    },
                },
            },
        });

        if (!lastTournamentMatch) {
            return SuccessResponse({ data: { pending: [], tournamentId: null, tournamentName: null } });
        }

        // Skip rating for squad tournaments — players chose their own teammates
        if (lastTournamentMatch.tournament.poll?.allowSquads) {
            return SuccessResponse({ data: { pending: [], tournamentId: null, tournamentName: null } });
        }

        const tournamentId = lastTournamentMatch.tournamentId;
        const tournamentName = lastTournamentMatch.tournament.name;

        // Find teammates in this tournament
        // Get this player's team IDs
        const playerTeams = await prisma.matchPlayerPlayed.findMany({
            where: { playerId, tournamentId },
            select: { teamId: true },
            distinct: ["teamId"],
        });
        const teamIds = playerTeams.map((t) => t.teamId);

        if (teamIds.length === 0) {
            return SuccessResponse({ data: { pending: [], tournamentId, tournamentName } });
        }

        // Find all teammates on those teams (excluding self)
        const teammates = await prisma.matchPlayerPlayed.findMany({
            where: {
                teamId: { in: teamIds },
                tournamentId,
                playerId: { not: playerId },
            },
            select: { playerId: true },
            distinct: ["playerId"],
        });
        const teammateIds = teammates.map((t) => t.playerId);

        if (teammateIds.length === 0) {
            return SuccessResponse({ data: { pending: [], tournamentId, tournamentName } });
        }

        // Find which teammates have already been rated for this tournament
        const existingRatings = await prisma.playerMeritRating.findMany({
            where: {
                fromPlayerId: playerId,
                tournamentId,
                toPlayerId: { in: teammateIds },
            },
            select: { toPlayerId: true },
        });
        const alreadyRatedIds = new Set(existingRatings.map((r) => r.toPlayerId));

        // Filter out already-rated teammates
        const pendingIds = teammateIds.filter((id) => !alreadyRatedIds.has(id));

        if (pendingIds.length === 0) {
            return SuccessResponse({ data: { pending: [], tournamentId, tournamentName } });
        }

        // Fetch player details for pending teammates
        const pendingPlayers = await prisma.player.findMany({
            where: { id: { in: pendingIds } },
            select: {
                id: true,
                displayName: true,
                customProfileImageUrl: true,
                user: {
                    select: {
                        username: true,
                        imageUrl: true,
                    },
                },
            },
        });

        const pending = pendingPlayers.map((p) => ({
            id: p.id,
            displayName: p.displayName ?? p.user?.username ?? "Unknown",
            imageUrl: p.customProfileImageUrl ?? p.user?.imageUrl ?? "",
        }));

        return SuccessResponse({
            data: { pending, tournamentId, tournamentName },
            cache: CACHE.NONE,
        });
    } catch (error) {
        console.error("[GET /api/polls/pending-merit] Error:", error);
        return ErrorResponse({ message: "Failed to fetch pending merit ratings", error });
    }
}
