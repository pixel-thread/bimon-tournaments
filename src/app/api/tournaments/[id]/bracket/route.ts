import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getSettings } from "@/lib/settings";
import { advanceWinners } from "@/lib/logic/generateBracket";
import { advanceGroupToKnockout } from "@/lib/logic/generateGroupKnockout";
import { getMatchDeadlineMs, isTodayPaused } from "@/lib/logic/koRolloverDeadline";
import { GAME } from "@/lib/game-config";

const CONFIRM_DEADLINE_MS = GAME.disputeWindowMinutes * 60 * 1000;

/**
 * Silently auto-confirm any SUBMITTED matches in a tournament
 * that the opponent has ignored for more than 30 minutes.
 * Called on every bracket page load — no admin needed.
 */
async function silentAutoConfirm(tournamentId: string, tournamentType: string) {
    try {
        const now = new Date();
        const settings = await getSettings();

        // Skip all deadline enforcement on paused days (e.g. Sunday)
        if (isTodayPaused(settings.deadlinePausedDays)) return;

        // 1. SUBMITTED matches → auto-confirm only when match deadline has ≤ 30 min left
        //    This gives opponents the full deadline window to verify and dispute.
        const stale = await prisma.bracketMatch.findMany({
            where: { tournamentId, status: "SUBMITTED" },
            select: {
                id: true, round: true, player1Id: true, player2Id: true, createdAt: true,
                results: { orderBy: { createdAt: "desc" }, take: 1, select: { claimedScore1: true, claimedScore2: true, notes: true } },
            },
        });
        for (const match of stale) {
            const latest = match.results[0];
            if (!latest) continue;

            // Only auto-confirm when rollover deadline is nearly up (≤ 30 min left)
            const deadlineMs = await getMatchDeadlineMs(tournamentId, tournamentType, match.round, match.createdAt, settings);
            const timeLeftMs = deadlineMs - now.getTime();
            if (timeLeftMs > CONFIRM_DEADLINE_MS) continue; // Still has time — skip

            const isWalkover = latest.notes?.toLowerCase().includes("walkover") ?? false;
            const { claimedScore1: s1, claimedScore2: s2 } = latest;
            const winnerId = s1 > s2 ? match.player1Id : match.player2Id;
            if (!winnerId) continue;
            await prisma.bracketMatch.update({ where: { id: match.id }, data: { score1: s1, score2: s2, winnerId, status: "CONFIRMED" } });
            await prisma.bracketResult.create({
                data: { bracketMatchId: match.id, submittedById: winnerId!, claimedScore1: s1, claimedScore2: s2, notes: isWalkover ? "Walkover confirmed: opponent did not respond before deadline" : "Auto-confirmed: opponent did not verify before deadline" },
            }).catch(() => {});
            const isKO = tournamentType === "BRACKET_1V1" || (tournamentType === "GROUP_KNOCKOUT" && match.round > 0);
            if (isKO) await advanceWinners(tournamentId, match.round);
        }

        // 2. PENDING past play deadline → random winner (1-0)
        const pending = await prisma.bracketMatch.findMany({
            where: { tournamentId, status: "PENDING", player1Id: { not: null }, player2Id: { not: null } },
            select: { id: true, round: true, player1Id: true, player2Id: true, createdAt: true },
        });
        for (const match of pending) {
            const deadlineMs = await getMatchDeadlineMs(tournamentId, tournamentType, match.round, match.createdAt, settings);
            if (now.getTime() < deadlineMs) continue;
            const winnerId = Math.random() < 0.5 ? match.player1Id! : match.player2Id!;
            const winnerIsP1 = winnerId === match.player1Id;
            await prisma.bracketMatch.update({
                where: { id: match.id },
                data: { winnerId, score1: winnerIsP1 ? 1 : 0, score2: winnerIsP1 ? 0 : 1, status: "CONFIRMED" },
            });
            // Create a result record so the UI can show how the match was resolved
            await prisma.bracketResult.create({
                data: { bracketMatchId: match.id, submittedById: winnerId, claimedScore1: winnerIsP1 ? 1 : 0, claimedScore2: winnerIsP1 ? 0 : 1, notes: "Auto-forfeit: no result submitted, random winner selected" },
            }).catch(() => {});
            const isKO = tournamentType === "BRACKET_1V1" || (tournamentType === "GROUP_KNOCKOUT" && match.round > 0);
            if (isKO) await advanceWinners(tournamentId, match.round);
        }
        // 3. GROUP_KNOCKOUT: if ALL group stage matches are now CONFIRMED
        //    (and none are DISPUTED), silently seed the knockout bracket.
        if (tournamentType === "GROUP_KNOCKOUT") {
            const blockingGroupMatches = await prisma.bracketMatch.count({
                where: {
                    tournamentId,
                    round: { lt: 0 },                         // group stage only
                    status: { not: "CONFIRMED" },             // anything unfinished
                },
            });
            if (blockingGroupMatches === 0) {
                // Check KO slots aren't already filled (idempotency)
                const koFilled = await prisma.bracketMatch.count({
                    where: { tournamentId, round: 1, player1Id: { not: null } },
                });
                if (koFilled === 0) {
                    await advanceGroupToKnockout(tournamentId).catch(() => {
                        // Swallow — DISPUTED or already advanced
                    });
                }
            }
        }
    } catch {
        // Silently swallow — never break the main response
    }
}


/**
 * GET /api/tournaments/[id]/bracket
 * Fetch bracket matches for a tournament, grouped by round.
 * Also returns deadline settings so the player UI can show countdowns.
 * Public — any authenticated user can view brackets.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const [tournament, settings] = await Promise.all([
            prisma.tournament.findUnique({
                where: { id },
                select: { id: true, type: true, fee: true, maxPlacements: true, isTDM: true },
            }),
            getSettings(),
        ]);

        if (!tournament) {
            return ErrorResponse({ message: "Tournament not found", status: 404 });
        }

        // Auto-confirm any SUBMITTED matches that the opponent has ignored >30 min
        await silentAutoConfirm(id, tournament.type);

        const matches = await prisma.bracketMatch.findMany({
            where: { tournamentId: id },
            include: {
                player1: {
                    select: {
                        id: true,
                        displayName: true,
                        phoneNumber: true,
                        customProfileImageUrl: true,
                        user: { select: { imageUrl: true } },
                    },
                },
                player2: {
                    select: {
                        id: true,
                        displayName: true,
                        phoneNumber: true,
                        customProfileImageUrl: true,
                        user: { select: { imageUrl: true } },
                    },
                },
                team1: {
                    select: {
                        id: true,
                        name: true,
                        players: {
                            select: { id: true, displayName: true },
                        },
                    },
                },
                team2: {
                    select: {
                        id: true,
                        name: true,
                        players: {
                            select: { id: true, displayName: true },
                        },
                    },
                },
                winner: {
                    select: { id: true, displayName: true },
                },
                winnerTeam: {
                    select: { id: true, name: true },
                },
                mvpPlayer: {
                    select: { id: true, displayName: true },
                },
                results: {
                    select: {
                        id: true,
                        submittedById: true,
                        claimedScore1: true,
                        claimedScore2: true,
                        screenshotUrl: true,
                        notes: true,
                        isDispute: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: "desc" },
                },
            },
            orderBy: [{ round: "asc" }, { position: "asc" }],
        });

        if (matches.length === 0) {
            return SuccessResponse({ data: { rounds: [], totalRounds: 0, totalPlayers: 0 } });
        }

        // Group by round
        const roundMap = new Map<number, typeof matches>();
        for (const m of matches) {
            const existing = roundMap.get(m.round) || [];
            existing.push(m);
            roundMap.set(m.round, existing);
        }

        const totalRounds = Math.max(...Array.from(roundMap.keys()));

        // Count unique players or teams
        const playerIds = new Set<string>();
        const teamIds = new Set<string>();
        for (const m of matches) {
            if (m.player1Id) playerIds.add(m.player1Id);
            if (m.player2Id) playerIds.add(m.player2Id);
            if (m.team1Id) teamIds.add(m.team1Id);
            if (m.team2Id) teamIds.add(m.team2Id);
        }

        // Generate round names
        function getRoundName(round: number, total: number, type: string): string {
            if (type === "LEAGUE") return `Match Day ${round}`;
            if (type === "GROUP_KNOCKOUT") return `Round ${round}`;
            if (round === total) return "Final";
            if (round === total - 1) return "Semi-Final";
            if (round === total - 2) return "Quarter-Final";
            return `Round ${round}`;
        }

        const serverNow = Date.now();
        const rounds = Array.from(roundMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([round, roundMatches]) => ({
                round,
                name: getRoundName(round, totalRounds, tournament.type),
                matches: roundMatches.map((m) => ({
                    id: m.id,
                    round: m.round,
                    position: m.position,
                    player1Id: m.player1Id,
                    player2Id: m.player2Id,
                    team1Id: m.team1Id,
                    team2Id: m.team2Id,
                    winnerId: m.winnerId,
                    winnerTeamId: m.winnerTeamId,
                    score1: m.score1,
                    score2: m.score2,
                    status: m.status,
                    disputeDeadline: m.disputeDeadline,
                    disputeRemainingMs: m.disputeDeadline ? Math.max(0, new Date(m.disputeDeadline).getTime() - serverNow) : null,
                    createdAt: m.createdAt,          // for deadline countdown on /bracket
                    player1: m.player1
                        ? { displayName: m.player1.displayName, phoneNumber: m.player1.phoneNumber }
                        : null,
                    player2: m.player2
                        ? { displayName: m.player2.displayName, phoneNumber: m.player2.phoneNumber }
                        : null,
                    team1: m.team1
                        ? { id: m.team1.id, name: m.team1.name, players: m.team1.players }
                        : null,
                    team2: m.team2
                        ? { id: m.team2.id, name: m.team2.name, players: m.team2.players }
                        : null,
                    player1Avatar:
                        m.player1?.customProfileImageUrl ??
                        m.player1?.user?.imageUrl ??
                        null,
                    player2Avatar:
                        m.player2?.customProfileImageUrl ??
                        m.player2?.user?.imageUrl ??
                        null,
                    results: m.results,
                    mvpPlayerId: m.mvpPlayerId,
                    mvpPlayerName: m.mvpPlayer?.displayName ?? null,
                    winnerTeam: m.winnerTeam ?? null,
                })),
            }));

        // Check if there's a final winner (position 0 = Final, position 1 = 3rd Place)
        const finalMatch = matches.find((m) => m.round === totalRounds && m.position === 0 && (m.winnerId || m.winnerTeamId));
        const winner = tournament.isTDM
            ? (finalMatch?.winnerTeam ? { displayName: finalMatch.winnerTeam.name } : null)
            : (finalMatch?.winner ? { displayName: finalMatch.winner.displayName } : null);

        // Compute prize pool for bracket mode
        const donations = await prisma.prizePoolDonation.findMany({
            where: { tournamentId: id },
            select: { amount: true },
        });
        const totalDonations = donations.reduce((s, d) => s + d.amount, 0);
        const entryFee = tournament.fee ?? 0;
        // TDM: prize pool = entryFee × teams; 1v1: entryFee × players
        const participantCount = tournament.isTDM ? teamIds.size : playerIds.size;
        const prizePool = entryFee * participantCount + totalDonations;

        return SuccessResponse({
            data: {
                rounds,
                totalRounds,
                totalPlayers: playerIds.size,
                totalTeams: teamIds.size,
                isTDM: tournament.isTDM,
                winner,
                entryFee,
                prizePool,
                maxPlacements: tournament.maxPlacements ?? 3,
                // Deadline settings — player UI shows countdown for PENDING matches
                deadlines: {
                    groupHours: settings.matchDeadlineGroupHours,
                    koHours: settings.matchDeadlineKOHours,
                    cutoffTime: settings.deadlineCutoffTime || "",
                    pausedDays: settings.deadlinePausedDays || [],
                },
            },
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch bracket", error });
    }
}
