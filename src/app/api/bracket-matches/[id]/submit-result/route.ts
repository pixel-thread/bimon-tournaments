import { prisma } from "@/lib/database";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { advanceWinners } from "@/lib/logic/generateBracket";
import { type NextRequest } from "next/server";
import { GAME } from "@/lib/game-config";
import { getMatchDeadlineMs } from "@/lib/logic/koRolloverDeadline";
import { getSettings } from "@/lib/settings";

const FALLBACK_DISPUTE_WINDOW_MS = GAME.disputeWindowMinutes * 60 * 1000;

/**
 * POST /api/bracket-matches/[id]/submit-result
 * Winner submits score + optional screenshot.
 * Body: { score1: number, score2: number, screenshotUrl?: string }
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getAuthEmail();
        if (!userId) return ErrorResponse({ message: "Unauthorized", status: 401 });

        const { id: matchId } = await params;
        const body = await req.json();
        const { score1, score2, screenshotUrl, adminOverride, notes, mvpPlayerId } = body as {
            score1: number;
            score2: number;
            screenshotUrl?: string;
            adminOverride?: boolean;
            notes?: string;
            mvpPlayerId?: string;
        };

        if (score1 === undefined || score2 === undefined) {
            return ErrorResponse({ message: "score1 and score2 required", status: 400 });
        }

        // Screenshot required for non-admin submissions (walkovers identified by notes)
        const isWalkover = notes?.toLowerCase().includes("walkover");
        if (!adminOverride && !isWalkover && !screenshotUrl) {
            return ErrorResponse({ message: "Screenshot is required", status: 400 });
        }

        // Get the user + role
        const user = await prisma.user.findFirst({
            where: userWhereEmail(userId),
            select: {
                player: { select: { id: true } },
                role: true,
            },
        });
        if (!user?.player) {
            return ErrorResponse({ message: "Player not found", status: 404 });
        }
        const playerId = user.player.id;
        const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

        // Admin override check
        if (adminOverride && !isAdmin) {
            return ErrorResponse({ message: "Admin access required", status: 403 });
        }

        // Get the bracket match
        const match = await prisma.bracketMatch.findUnique({
            where: { id: matchId },
            select: {
                id: true,
                status: true,
                player1Id: true,
                player2Id: true,
                team1Id: true,
                team2Id: true,
                winnerId: true,
                winnerTeamId: true,
                tournamentId: true,
                round: true,
                createdAt: true,
            },
        });

        if (!match) {
            return ErrorResponse({ message: "Match not found", status: 404 });
        }

        // Admin can override any status; players can submit PENDING or re-edit their own SUBMITTED result
        if (!adminOverride && match.status !== "PENDING" && match.status !== "SUBMITTED") {
            return ErrorResponse({
                message: `Match is already ${match.status.toLowerCase()}`,
                status: 400,
            });
        }

        // If SUBMITTED, only the original submitter can re-edit
        if (!adminOverride && match.status === "SUBMITTED") {
            // The submitter is the player whose result determined the current winnerId
            // Find who submitted the original result
            const originalResult = await prisma.bracketResult.findFirst({
                where: { bracketMatchId: matchId, isDispute: false },
                orderBy: { createdAt: "desc" },
                select: { submittedById: true },
            });
            if (originalResult?.submittedById !== playerId) {
                return ErrorResponse({
                    message: "Only the original submitter can edit the result during confirmation window",
                    status: 403,
                });
            }
        }

        // Verify participant (skip for admin override)
        // TDM: check if player is a captain of either team
        const isTDMMatch = !!(match.team1Id && match.team2Id);
        if (!adminOverride) {
            if (isTDMMatch) {
                // For TDM, check if user is captain of either team's squad
                const tournament = await prisma.tournament.findUnique({
                    where: { id: match.tournamentId },
                    select: { poll: { select: { id: true } } },
                });
                const pollId = tournament?.poll?.id;
                if (!pollId) return ErrorResponse({ message: "Tournament poll not found", status: 400 });
                const squad = await prisma.squad.findFirst({
                    where: { pollId, captainId: playerId },
                });
                if (!squad) {
                    return ErrorResponse({
                        message: "Only team captains can submit results for TDM matches",
                        status: 403,
                    });
                }
            } else {
                const isPlayer1 = match.player1Id === playerId;
                const isPlayer2 = match.player2Id === playerId;
                if (!isPlayer1 && !isPlayer2) {
                    return ErrorResponse({
                        message: "You are not a participant in this match",
                        status: 403,
                    });
                }
            }
        }

        // Check tournament type to determine if draws are allowed
        const tournamentForType = await prisma.tournament.findUnique({
            where: { id: match.tournamentId },
            select: { type: true, isTDM: true },
        });
        const isLeague = tournamentForType?.type === "LEAGUE";
        const isGroupStage = tournamentForType?.type === "GROUP_KNOCKOUT" && match.round < 0;
        const drawsAllowed = isLeague || isGroupStage;

        // Determine winner from scores
        let claimedWinnerId: string | null = null;
        let claimedWinnerTeamId: string | null = null;
        if (score1 === score2) {
            if (!drawsAllowed) {
                return ErrorResponse({
                    message: "Draws are not allowed — there must be a winner",
                    status: 400,
                });
            }
        } else if (isTDMMatch) {
            claimedWinnerTeamId = score1 > score2 ? match.team1Id : match.team2Id;
        } else {
            claimedWinnerId = score1 > score2 ? match.player1Id : match.player2Id;
        }

        // Save the result submission
        await prisma.bracketResult.create({
            data: {
                bracketMatchId: matchId,
                submittedById: playerId,
                claimedScore1: score1,
                claimedScore2: score2,
                screenshotUrl: screenshotUrl || null,
                notes: notes?.trim().slice(0, 200) || null,
                isDispute: false,
                mvpPlayerId: mvpPlayerId || null,
            },
        });

        // Admin override: auto-confirm immediately (no dispute window)
        if (adminOverride) {
            await prisma.bracketMatch.update({
                where: { id: matchId },
                data: {
                    score1,
                    score2,
                    winnerId: claimedWinnerId,
                    winnerTeamId: claimedWinnerTeamId,
                    status: "CONFIRMED",
                    mvpPlayerId: mvpPlayerId || null,
                },
            });

            // Advance winners for knockout matches
            const isKnockoutMatch =
                tournamentForType?.type === "BRACKET_1V1" ||
                (tournamentForType?.type === "GROUP_KNOCKOUT" && match.round > 0);

            if (isKnockoutMatch) {
                await advanceWinners(match.tournamentId, match.round);
            }

            return SuccessResponse({
                data: { matchId, score1, score2, winnerId: claimedWinnerId },
                message: isKnockoutMatch
                    ? "Result confirmed by admin! Winner advances."
                    : "Result confirmed by admin!",
            });
        }

        // Self-forfeit walkover: auto-confirm instantly (player is voluntarily giving up)
        // Opponent-walkover claims go through normal SUBMITTED flow with dispute window
        const isSelfForfeit = notes?.toLowerCase().includes("i choose to walkover");
        if (isSelfForfeit) {
            await prisma.bracketMatch.update({
                where: { id: matchId },
                data: {
                    score1,
                    score2,
                    winnerId: claimedWinnerId,
                    winnerTeamId: claimedWinnerTeamId,
                    status: "CONFIRMED",
                    mvpPlayerId: mvpPlayerId || null,
                },
            });

            const isKnockoutMatch =
                tournamentForType?.type === "BRACKET_1V1" ||
                (tournamentForType?.type === "GROUP_KNOCKOUT" && match.round > 0);

            if (isKnockoutMatch) {
                await advanceWinners(match.tournamentId, match.round);
            }

            return SuccessResponse({
                data: { matchId, score1, score2, winnerId: claimedWinnerId },
                message: isKnockoutMatch
                    ? "Walkover confirmed! Opponent advances to the next round."
                    : "Walkover confirmed!",
            });
        }

        // Normal player flow: SUBMITTED status with dispute window
        // Compute dynamic dispute deadline based on tournament settings
        let disputeDeadline: Date;
        try {
            const settings = await getSettings();
            const deadlineMs = await getMatchDeadlineMs(
                match.tournamentId,
                tournamentForType?.type || "BRACKET_1V1",
                match.round,
                match.createdAt,
                settings,
            );
            // Ensure deadline is at least in the future (minimum fallback)
            const minDeadline = Date.now() + FALLBACK_DISPUTE_WINDOW_MS;
            disputeDeadline = new Date(Math.max(deadlineMs, minDeadline));
        } catch {
            disputeDeadline = new Date(Date.now() + FALLBACK_DISPUTE_WINDOW_MS);
        }

        await prisma.bracketMatch.update({
            where: { id: matchId },
            data: {
                score1,
                score2,
                winnerId: claimedWinnerId,
                winnerTeamId: claimedWinnerTeamId,
                status: "SUBMITTED",
                disputeDeadline,
            },
        });

        const remainingMs = disputeDeadline.getTime() - Date.now();
        const remainingHours = Math.ceil(remainingMs / 3600_000);
        const timeLabel = remainingHours >= 1 ? `${remainingHours}h` : `${Math.ceil(remainingMs / 60_000)}m`;

        return SuccessResponse({
            data: {
                matchId,
                score1,
                score2,
                winnerId: claimedWinnerId,
                disputeDeadline,
            },
            message: `Result submitted! Your opponent has ${timeLabel} to confirm or dispute.`,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to submit result", error });
    }
}

/**
 * PUT /api/bracket-matches/[id]/submit-result
 * Opponent confirms the result (or admin force-confirms).
 * This skips the dispute window and confirms immediately.
 */
export async function PUT(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getAuthEmail();
        if (!userId) return ErrorResponse({ message: "Unauthorized", status: 401 });

        const { id: matchId } = await params;

        const user = await prisma.user.findFirst({
            where: userWhereEmail(userId),
            select: {
                player: { select: { id: true } },
                role: true,
            },
        });
        if (!user?.player) {
            return ErrorResponse({ message: "Player not found", status: 404 });
        }

        const match = await prisma.bracketMatch.findUnique({
            where: { id: matchId },
            select: {
                id: true,
                status: true,
                player1Id: true,
                player2Id: true,
                team1Id: true,
                team2Id: true,
                winnerId: true,
                winnerTeamId: true,
                tournamentId: true,
                round: true,
            },
        });

        if (!match) {
            return ErrorResponse({ message: "Match not found", status: 404 });
        }

        if (match.status === "CONFIRMED") {
            // Already confirmed (e.g. by auto-confirm cron) — treat as success
            return SuccessResponse({ message: "Match already confirmed!" });
        }

        if (match.status !== "SUBMITTED") {
            return ErrorResponse({
                message: `Cannot confirm — match is ${match.status.toLowerCase()}`,
                status: 400,
            });
        }

        // Must be the OTHER player/captain (the one who didn't submit) or an admin
        const playerId = user.player.id;
        const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
        const isTDMMatch = !!(match.team1Id && match.team2Id);

        let isOpponent = false;
        if (isTDMMatch) {
            // For TDM: check if player is captain of the OPPOSING team
            const tournament = await prisma.tournament.findUnique({
                where: { id: match.tournamentId },
                select: { poll: { select: { id: true } } },
            });
            if (tournament?.poll?.id) {
                const squad = await prisma.squad.findFirst({
                    where: { pollId: tournament.poll.id, captainId: playerId },
                });
                // Is a captain AND not from the winning team
                if (squad) {
                    isOpponent = true; // Captain of opposing team can confirm
                }
            }
        } else {
            const isParticipant = match.player1Id === playerId || match.player2Id === playerId;
            isOpponent = isParticipant && match.winnerId !== playerId;
        }

        if (!isAdmin && !isOpponent) {
            return ErrorResponse({
                message: "Only the opponent or an admin can confirm this result",
                status: 403,
            });
        }

        // Copy MVP from original submission
        const originalResult = await prisma.bracketResult.findFirst({
            where: { bracketMatchId: matchId, isDispute: false },
            orderBy: { createdAt: "desc" },
            select: { mvpPlayerId: true },
        });

        // Confirm the match
        await prisma.bracketMatch.update({
            where: { id: matchId },
            data: {
                status: "CONFIRMED",
                mvpPlayerId: originalResult?.mvpPlayerId || null,
            },
        });

        // Record who confirmed — fetch confirmer name for the note
        const confirmerPlayer = await prisma.player.findUnique({
            where: { id: playerId },
            select: { displayName: true },
        });
        const confirmerName = confirmerPlayer?.displayName || "opponent";
        const latestResult = await prisma.bracketResult.findFirst({
            where: { bracketMatchId: matchId },
            orderBy: { createdAt: "desc" },
            select: { claimedScore1: true, claimedScore2: true },
        });
        await prisma.bracketResult.create({
            data: {
                bracketMatchId: matchId,
                submittedById: playerId,
                claimedScore1: latestResult?.claimedScore1 ?? 0,
                claimedScore2: latestResult?.claimedScore2 ?? 0,
                notes: isAdmin
                    ? "Confirmed by admin"
                    : `Confirmed by ${confirmerName}`,
            },
        });

        // Only advance winners for knockout-style matches
        // Skip for: League (all matches), Group+KO group stage (negative rounds)
        const tournament = await prisma.tournament.findUnique({
            where: { id: match.tournamentId },
            select: { type: true },
        });
        const isKnockoutMatch =
            tournament?.type === "BRACKET_1V1" ||
            (tournament?.type === "GROUP_KNOCKOUT" && match.round > 0);

        if (isKnockoutMatch) {
            await advanceWinners(match.tournamentId, match.round);
        }

        const msg = isKnockoutMatch
            ? "Result confirmed! Winner advances to next round."
            : "Result confirmed!";

        return SuccessResponse({ message: msg });
    } catch (error) {
        return ErrorResponse({ message: "Failed to confirm result", error });
    }
}
