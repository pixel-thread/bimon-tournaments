import { prisma } from "@/lib/database";
import { requireAdmin } from "@/lib/auth";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { advanceWinners } from "@/lib/logic/generateBracket";
import { getSettings } from "@/lib/settings";
import { getMatchDeadlineMs, isTodayPaused } from "@/lib/logic/koRolloverDeadline";
import { GAME } from "@/lib/game-config";
import { BRACKET_TYPES } from "@/lib/bracket-types";

/**
 * POST /api/bracket-matches/deadline-check
 *
 * Two passes:
 *  1. PENDING matches past their play deadline  → random winner (1-0)
 *  2. SUBMITTED matches past dispute window     → auto-confirm the claimed result
 *
 * Run from Operations dashboard OR automate with Vercel cron:
 *   vercel.json → { "crons": [{ "path": "/api/bracket-matches/deadline-check", "schedule": "0,15,30,45 * * * *" }] }
 */
export async function POST() {
    try {
        await requireAdmin();

        const settings = await getSettings();
        const now = new Date();
        const CONFIRM_DEADLINE_MS = GAME.disputeWindowMinutes * 60 * 1000;

        // Skip all deadline enforcement on paused days (e.g. Sunday)
        if (isTodayPaused(settings.deadlinePausedDays)) {
            return SuccessResponse({ message: "Deadlines paused today — no enforcement.", data: { paused: true } });
        }

        // ── 1. Auto-resolve PENDING matches past their play deadline ────────
        const pendingMatches = await prisma.bracketMatch.findMany({
            where: {
                status: "PENDING",
                OR: [
                    // 1v1 matches
                    { player1Id: { not: null }, player2Id: { not: null } },
                    // TDM team matches
                    { team1Id: { not: null }, team2Id: { not: null } },
                ],
                tournament: {
                    status: "ACTIVE",
                    type: { in: [...BRACKET_TYPES] },
                },
            },
            select: {
                id: true, round: true, player1Id: true, player2Id: true,
                team1Id: true, team2Id: true,
                tournamentId: true, createdAt: true,
                tournament: { select: { type: true } },
            },
        });

        const resolved: string[] = [];
        const skipped: string[] = [];

        for (const match of pendingMatches) {
            const deadlineMs = await getMatchDeadlineMs(match.tournamentId, match.tournament.type, match.round, match.createdAt, settings);
            if (now.getTime() < deadlineMs) { skipped.push(match.id); continue; }

            // TDM match (team-based): pick a random team as winner
            if (match.team1Id && match.team2Id) {
                const winnerTeamId = Math.random() < 0.5 ? match.team1Id! : match.team2Id!;
                const winnerIsT1 = winnerTeamId === match.team1Id;
                await prisma.bracketMatch.update({
                    where: { id: match.id },
                    data: { winnerTeamId, score1: winnerIsT1 ? 1 : 0, score2: winnerIsT1 ? 0 : 1, status: "CONFIRMED" },
                });
                await advanceWinners(match.tournamentId, match.round);
                resolved.push(match.id);
                continue;
            }

            const winnerId = Math.random() < 0.5 ? match.player1Id! : match.player2Id!;
            const winnerIsP1 = winnerId === match.player1Id;

            await prisma.bracketMatch.update({
                where: { id: match.id },
                data: { winnerId, score1: winnerIsP1 ? 1 : 0, score2: winnerIsP1 ? 0 : 1, status: "CONFIRMED" },
            });
            await prisma.bracketResult.create({
                data: { bracketMatchId: match.id, submittedById: winnerId, claimedScore1: winnerIsP1 ? 1 : 0, claimedScore2: winnerIsP1 ? 0 : 1, notes: "Auto-forfeit: no result submitted, random winner selected" },
            }).catch(() => {});

            const isKO = match.tournament.type === "BRACKET_1V1" ||
                (match.tournament.type === "GROUP_KNOCKOUT" && match.round > 0);
            if (isKO) await advanceWinners(match.tournamentId, match.round);
            resolved.push(match.id);
        }

        // ── 2. Auto-confirm SUBMITTED matches when match deadline ≤ 30 min remaining ──
        //    Gives opponents the full deadline window to verify and dispute.
        const submittedMatches = await prisma.bracketMatch.findMany({
            where: {
                status: "SUBMITTED",
                tournament: {
                    status: "ACTIVE",
                    type: { in: [...BRACKET_TYPES] },
                },
            },
            select: {
                id: true, round: true, player1Id: true, player2Id: true, tournamentId: true,
                createdAt: true,
                tournament: { select: { type: true } },
                results: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: { claimedScore1: true, claimedScore2: true, notes: true },
                },
            },
        });

        const autoConfirmed: string[] = [];

        for (const match of submittedMatches) {
            const latest = match.results[0];
            if (!latest) continue;

            // Only auto-confirm when rollover deadline is nearly up (≤ 30 min left)
            const deadlineMs = await getMatchDeadlineMs(match.tournamentId, match.tournament.type, match.round, match.createdAt, settings);
            const timeLeftMs = deadlineMs - now.getTime();
            if (timeLeftMs > CONFIRM_DEADLINE_MS) continue; // Still has time — skip

            const isWalkover = latest.notes?.toLowerCase().includes("walkover") ?? false;
            const s1 = latest.claimedScore1;
            const s2 = latest.claimedScore2;
            const winnerId = s1 > s2 ? match.player1Id : match.player2Id;
            if (!winnerId) continue;

            await prisma.bracketMatch.update({
                where: { id: match.id },
                data: { score1: s1, score2: s2, winnerId, status: "CONFIRMED" },
            });
            await prisma.bracketResult.create({
                data: { bracketMatchId: match.id, submittedById: winnerId!, claimedScore1: s1, claimedScore2: s2, notes: isWalkover ? "Walkover confirmed: opponent did not respond before deadline" : "Auto-confirmed: opponent did not verify before deadline" },
            }).catch(() => {});

            const isKO = match.tournament.type === "BRACKET_1V1" ||
                (match.tournament.type === "GROUP_KNOCKOUT" && match.round > 0);
            if (isKO) await advanceWinners(match.tournamentId, match.round);

            autoConfirmed.push(match.id);
        }

        const total = resolved.length + autoConfirmed.length;
        return SuccessResponse({
            message: total > 0
                ? `Auto-resolved ${resolved.length} expired + auto-confirmed ${autoConfirmed.length} submitted match${total !== 1 ? "es" : ""}.`
                : "No expired or overdue submitted matches found.",
            data: { resolved: resolved.length, autoConfirmed: autoConfirmed.length, skipped: skipped.length },
        });
    } catch (error) {
        return ErrorResponse({ message: "Deadline check failed", error });
    }
}
