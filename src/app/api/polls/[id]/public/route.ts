import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { type NextRequest } from "next/server";

/**
 * GET /api/polls/[id]/public
 * Public endpoint — returns poll + tournament info for the registration share page.
 * Also returns whether the current user (if signed in) already has a squad.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: pollId } = await params;
        if (!pollId) {
            return ErrorResponse({ message: "Poll ID is required", status: 400 });
        }

        const poll = await prisma.poll.findUnique({
            where: { id: pollId },
            select: {
                id: true,
                question: true,
                isActive: true,
                allowSquads: true,
                isChampionship: true,
                scheduledDate: true,
                scheduledTime: true,
                matchSchedule: true,
                days: true,
                expectedPrizePool: true,
                whatsappGroupLink: true,
                tournament: {
                    select: {
                        id: true,
                        name: true,
                        fee: true,
                        type: true,
                        isTDM: true,
                        isWoW: true,
                        season: { select: { name: true } },
                    },
                },
                _count: {
                    select: {
                        squads: { where: { status: { in: ["FORMING", "FULL"] } } },
                    },
                },
            },
        });

        if (!poll) {
            return ErrorResponse({ message: "Tournament not found", status: 404 });
        }

        // Check if current user already has a squad or individual vote on this poll
        let hasSquad = false;
        let mySquadName: string | null = null;
        let hasVotedIn = false;
        try {
            const user = await getCurrentUser();
            if (user?.player?.id) {
                const existing = await prisma.squad.findFirst({
                    where: {
                        pollId,
                        status: { in: ["FORMING", "FULL"] },
                        OR: [
                            { captainId: user.player.id },
                            { invites: { some: { playerId: user.player.id, status: { in: ["PENDING", "ACCEPTED"] } } } },
                        ],
                    },
                    select: { name: true },
                });
                hasSquad = !!existing;
                mySquadName = existing?.name ?? null;

                // Check for existing individual vote (IN or SOLO)
                const existingVote = await prisma.playerPollVote.findFirst({
                    where: {
                        pollId,
                        playerId: user.player.id,
                        vote: { in: ["IN", "SOLO"] },
                    },
                    select: { id: true },
                });
                hasVotedIn = !!existingVote;
            }
        } catch {
            // Not signed in — that's fine
        }

        const maxSquads = poll.isChampionship ? 32 : GAME.maxSquadTeams;

        return SuccessResponse({
            data: {
                id: poll.id,
                tournamentName: poll.tournament.name,
                seasonName: poll.tournament.season?.name ?? null,
                entryFee: poll.tournament.fee ?? 0,
                expectedPrizePool: poll.expectedPrizePool,
                isActive: poll.isActive,
                allowSquads: poll.allowSquads,
                isChampionship: poll.isChampionship,
                isTDM: poll.tournament.isTDM,
                isWoW: poll.tournament.isWoW,
                scheduledDate: poll.scheduledDate,
                scheduledTime: poll.scheduledTime,
                matchSchedule: poll.matchSchedule ?? null,
                days: poll.days,
                squadCount: poll._count.squads,
                maxSquads,
                teamSize: GAME.squadSize,
                maxTeamSize: GAME.maxSquadSize,
                hasSquad,
                mySquadName,
                hasVotedIn,
                whatsappGroupLink: poll.whatsappGroupLink ?? null,
            },
            cache: CACHE.NONE,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch tournament info", error });
    }
}
