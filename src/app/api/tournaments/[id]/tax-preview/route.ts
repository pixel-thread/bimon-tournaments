import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { getTaxRate } from "@/lib/logic/repeatWinnerTax";
import { getSoloTaxRate } from "@/lib/logic/soloTax";
import { getSettings } from "@/lib/settings";

/**
 * GET /api/tournaments/[id]/tax-preview?playerIds=id1,id2,...&placements=pos:amount:p1|p2,pos:amount:p1|p2
 *
 * Returns tax preview data for winning players:
 * - Previous wins + tax rate (repeat winner tax)
 * - Solo status + solo tax rate
 * - Match participation rate
 * - Exact taxTotals matching declare-winners logic
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { id } = await params;
        const playerIdsParam = req.nextUrl.searchParams.get("playerIds");
        if (!playerIdsParam) {
            return NextResponse.json({ error: "playerIds required" }, { status: 400 });
        }

        const playerIds = playerIdsParam.split(",").filter(Boolean);
        if (playerIds.length === 0) {
            return NextResponse.json({ data: {} });
        }

        // Parse placements: "pos:amount:p1|p2,pos:amount:p1|p2"
        const placementsParam = req.nextUrl.searchParams.get("placements");

        const tournament = await prisma.tournament.findUnique({
            where: { id },
            select: { id: true, seasonId: true, fee: true, isWinnerDeclared: true, name: true },
        });
        if (!tournament) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        // Step 1: Get match IDs and poll data for this tournament
        const [matchesRaw, pollForTournament] = await Promise.all([
            prisma.match.findMany({
                where: { tournamentId: id },
                select: { id: true },
            }),
            prisma.poll.findUnique({
                where: { tournamentId: id },
                select: { allowSquads: true, enableFund: true },
            }),
        ]);
        const matchIds = matchesRaw.map(m => m.id);

        const totalMatches = matchIds.length;

        // Step 2: Parallel fetch using flat matchId filter (works for migrated data)
        const [recentWins, playerMatchCounts, teamPlayerData] = await Promise.all([
            getPlayerRecentWins(playerIds, tournament.seasonId || "", 6, id, pollForTournament?.allowSquads),
            // Count matches per player using flat matchId filter (no nested relation)
            prisma.teamPlayerStats.groupBy({
                by: ["playerId"],
                where: {
                    playerId: { in: playerIds },
                    matchId: { in: matchIds },
                    present: true,
                },
                _count: { matchId: true },
            }),
            // Get team composition via teamPlayerStats
            prisma.teamPlayerStats.findMany({
                where: {
                    playerId: { in: playerIds },
                    matchId: { in: matchIds },
                },
                select: {
                    playerId: true,
                    teamId: true,
                },
                distinct: ["playerId", "teamId"],
            }),
        ]);

        // Build maps
        const matchesPlayedMap = new Map<string, number>();
        for (const r of playerMatchCounts) matchesPlayedMap.set(r.playerId, r._count.matchId);

        // Detect solo players: count unique players per team from teamPlayerStats
        const teamPlayerCounts = new Map<string, Set<string>>();
        for (const tp of teamPlayerData) {
            if (!teamPlayerCounts.has(tp.teamId)) teamPlayerCounts.set(tp.teamId, new Set());
            teamPlayerCounts.get(tp.teamId)!.add(tp.playerId);
        }

        const playerSoloMap = new Map<string, boolean>();
        for (const tp of teamPlayerData) {
            const teamSize = teamPlayerCounts.get(tp.teamId)?.size ?? 0;
            playerSoloMap.set(tp.playerId, teamSize === 1);
        }

        // Build per-player result
        const result: Record<string, {
            previousWins: number;
            totalWins: number;
            taxRate: number;
            taxPercentage: string;
            repeatWinnerTaxRate: number;
            soloTaxRate: number;
            isSolo: boolean;
            matchesPlayed: number;
            totalMatches: number;
            participationRate: number;
        }> = {};

        // Check if fund is enabled (ranked-specific settings for squad tournaments)
        const settings = await getSettings();
        const isRanked = pollForTournament?.allowSquads ?? false;
        const enableFund = isRanked
            ? (settings.rankedEnableFund ?? false)
            : (settings.enableFund ?? false);

        for (const pid of playerIds) {
            const previousWins = recentWins.get(pid) || 0;
            const totalWins = previousWins + 1;
            const repeatRate = enableFund ? getTaxRate(totalWins) : 0;
            const isSolo = playerSoloMap.get(pid) || false;
            const soloRate = enableFund && isSolo ? getSoloTaxRate() : 0;
            const combinedRate = enableFund ? 1 - ((1 - repeatRate) * (1 - soloRate)) : 0;
            const matchesPlayed = matchesPlayedMap.get(pid) || 0;

            result[pid] = {
                previousWins,
                totalWins,
                taxRate: combinedRate,
                taxPercentage: `${Math.round(combinedRate * 100)}%`,
                repeatWinnerTaxRate: repeatRate,
                soloTaxRate: soloRate,
                isSolo,
                matchesPlayed,
                totalMatches,
                participationRate: totalMatches > 0 ? matchesPlayed / totalMatches : 1,
            };
        }

        // If declared, return stored values (no recalculation)
        let finalOrg: number | undefined;
        let finalFund: number | undefined;
        let storedPlayerAmounts: Record<string, number> | null = null;

        if (tournament.isWinnerDeclared) {
            const storedIncome = await prisma.income.findMany({
                where: { tournamentId: id },
                select: { amount: true, description: true },
            });
            for (const inc of storedIncome) {
                if (inc.description.startsWith("Org")) finalOrg = inc.amount;
                if (inc.description.startsWith("Fund")) finalFund = inc.amount;
            }

            const storedRewards = await prisma.pendingReward.findMany({
                where: {
                    playerId: { in: playerIds },
                    type: "WINNER",
                    message: { contains: tournament.name },
                },
                select: { playerId: true, amount: true },
            });
            storedPlayerAmounts = Object.fromEntries(
                storedRewards.map(r => [r.playerId, r.amount])
            );
        }

        return NextResponse.json({
            data: result,
            ...(finalOrg !== undefined ? { finalOrg, finalFund } : {}),
            ...(storedPlayerAmounts ? { storedPlayerAmounts } : {}),
        });
    } catch (error) {
        console.error("Error fetching tax preview:", error);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}

// Reuse the same logic from declare-winners
async function getPlayerRecentWins(
    playerIds: string[], seasonId: string, limit: number,
    excludeTournamentId?: string, isSquadMode?: boolean
): Promise<Map<string, number>> {
    if (!playerIds.length) return new Map();

    const where: Record<string, unknown> = { isWinnerDeclared: true };
    if (seasonId) where.seasonId = seasonId;
    if (excludeTournamentId) where.id = { not: excludeTournamentId };
    // Filter by mode: only count wins from same tournament type
    if (isSquadMode === true) {
        where.poll = { allowSquads: true };
    } else if (isSquadMode === false) {
        where.poll = { allowSquads: false };
    }

    const recent = await prisma.tournament.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
            id: true,
            winners: {
                select: { teamId: true },
            },
        },
    });

    const counts = new Map<string, number>();
    for (const pid of playerIds) counts.set(pid, 0);

    // Collect ALL winning team IDs (any position that received UC counts)
    const winningTeamIds = new Set<string>();
    for (const t of recent) {
        for (const w of t.winners) {
            winningTeamIds.add(w.teamId);
        }
    }

    if (winningTeamIds.size === 0) return counts;

    // Find which players were on winning teams via TeamPlayerStats
    const winningPlayerStats = await prisma.teamPlayerStats.findMany({
        where: {
            teamId: { in: Array.from(winningTeamIds) },
            playerId: { in: playerIds },
        },
        select: { playerId: true, teamId: true },
        distinct: ["playerId", "teamId"],
    });

    // Count distinct winning teams per player
    const playerTeams = new Map<string, Set<string>>();
    for (const ps of winningPlayerStats) {
        if (!playerTeams.has(ps.playerId)) playerTeams.set(ps.playerId, new Set());
        playerTeams.get(ps.playerId)!.add(ps.teamId);
    }

    for (const [pid, teams] of playerTeams) {
        counts.set(pid, teams.size);
    }

    return counts;
}
