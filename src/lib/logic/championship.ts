import { prisma } from "@/lib/database";

// ─── Types ───────────────────────────────────────────────────

// BGMI placement points — must match rankings/route.ts
const PLACEMENT_PTS: Record<number, number> = {
    1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1,
};

export interface PhaseRanking {
    teamId: string;
    teamName: string;
    group: string | null;
    totalPoints: number;
    kills: number;
    placementPts: number;
    wins: number;
    lastMatchPosition: number;
}

// ─── Confirmed Squad Cap ─────────────────────────────────────

/**
 * Calculate how many squads are "confirmed" (not waitlisted) based on total count.
 * - ≤16: all confirmed (regular match)
 * - 17-19: 16 confirmed (waiting to reach 20 for championship)
 * - ≥20: floor to nearest even (championship groups must be equal)
 */
export function getConfirmedSquadCap(totalSquads: number): number {
    if (totalSquads <= 16) return 16;
    if (totalSquads < 20) return 16;
    return totalSquads - (totalSquads % 2);
}

// ─── Assign Groups ───────────────────────────────────────────

/**
 * Randomly split teams into Group A and Group B.
 * Even count: split exactly in half (22 → 11+11).
 * Odd count: drop the last team, split evenly (21 → 10+10).
 * Excluded teams simply don't get championship entries.
 */
export function assignGroups(teamIds: string[]): {
    groupA: string[];
    groupB: string[];
} {
    // Shuffle
    const shuffled = [...teamIds].sort(() => Math.random() - 0.5);

    const maxTeams = 32;
    const capped = shuffled.slice(0, maxTeams);

    // Floor to even — odd team is excluded (no championship entry)
    const evenCount = capped.length - (capped.length % 2);
    const half = evenCount / 2;
    const groupA = capped.slice(0, half);
    const groupB = capped.slice(half, evenCount);

    return { groupA, groupB };
}

// ─── Phase Rankings ──────────────────────────────────────────

/**
 * Compute team rankings for a specific championship phase + group.
 * Uses the same tiebreaker logic as regular BR rankings.
 */
export async function getPhaseRankings(
    tournamentId: string,
    phase: string, // "HEATS_A", "HEATS_B", "WILDCARD", "FINALS"
): Promise<PhaseRanking[]> {
    const teamStats = await prisma.teamStats.findMany({
        where: {
            tournamentId,
            match: { phase },
        },
        include: {
            match: { select: { matchNumber: true } },
            team: { select: { id: true, name: true } },
            teamPlayerStats: {
                select: { kills: true, present: true },
            },
        },
        orderBy: { match: { matchNumber: "asc" } },
    });

    // Get championship entries for group info
    const entries = await prisma.championshipEntry.findMany({
        where: { tournamentId },
        select: { teamId: true, group: true },
    });
    const groupMap = new Map(entries.map(e => [e.teamId, e.group]));

    const teamMap = new Map<string, PhaseRanking>();

    for (const stat of teamStats) {
        const kills = stat.teamPlayerStats.reduce(
            (sum, ps) => sum + (ps.present !== false ? ps.kills : 0), 0
        );
        const pts = PLACEMENT_PTS[stat.position] ?? 0;
        const total = kills + pts;

        const existing = teamMap.get(stat.teamId);
        if (existing) {
            existing.kills += kills;
            existing.placementPts += pts;
            existing.totalPoints += total;
            if (stat.position === 1) existing.wins++;
            existing.lastMatchPosition = stat.position;
        } else {
            teamMap.set(stat.teamId, {
                teamId: stat.teamId,
                teamName: stat.team.name,
                group: groupMap.get(stat.teamId) ?? null,
                totalPoints: total,
                kills,
                placementPts: pts,
                wins: stat.position === 1 ? 1 : 0,
                lastMatchPosition: stat.position,
            });
        }
    }

    // BGMI tiebreaker sort
    return Array.from(teamMap.values()).sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.placementPts !== a.placementPts) return b.placementPts - a.placementPts;
        if (b.kills !== a.kills) return b.kills - a.kills;
        return a.lastMatchPosition - b.lastMatchPosition;
    });
}

// ─── Progress from Heats ─────────────────────────────────────

/**
 * After Heats phase (4 matches per group):
 * - Pos 1-4 per group → QUALIFIED (direct to Finals)
 * - Pos 5-12 per group → WILDCARD
 * - Pos 13-16 per group → ELIMINATED
 */
export async function progressFromHeats(tournamentId: string, seasonId: string) {
    // Validate all heat matches are scored
    const heatMatches = await prisma.match.findMany({
        where: { tournamentId, phase: { in: ["HEATS_A", "HEATS_B"] } },
        include: { _count: { select: { teamStats: true } } },
    });

    const unscoredMatches = heatMatches.filter(m => m._count.teamStats === 0);
    if (unscoredMatches.length > 0) {
        throw new Error(`${unscoredMatches.length} heat match(es) still need scores.`);
    }

    // Rank each group
    const [groupARankings, groupBRankings] = await Promise.all([
        getPhaseRankings(tournamentId, "HEATS_A"),
        getPhaseRankings(tournamentId, "HEATS_B"),
    ]);

    const updates: { teamId: string; status: string; phase: string }[] = [];

    // Get DQ'd team IDs so we skip them during qualification
    const dqTeams = await prisma.team.findMany({
        where: { tournamentId, disqualified: true },
        select: { id: true },
    });
    const dqTeamIds = new Set(dqTeams.map(t => t.id));

    // Get point deductions so rankings reflect penalties
    const teamsWithDeductions = await prisma.team.findMany({
        where: { tournamentId, pointDeduction: { gt: 0 } },
        select: { id: true, pointDeduction: true },
    });
    const deductionMap = new Map(teamsWithDeductions.map(t => [t.id, t.pointDeduction]));

    // Apply deductions and re-sort each group
    for (const rankings of [groupARankings, groupBRankings]) {
        for (const team of rankings) {
            const deduction = deductionMap.get(team.teamId) ?? 0;
            if (deduction > 0) {
                team.totalPoints -= deduction;
            }
        }
        rankings.sort((a, b) => {
            if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.placementPts !== a.placementPts) return b.placementPts - a.placementPts;
            if (b.kills !== a.kills) return b.kills - a.kills;
            return a.lastMatchPosition - b.lastMatchPosition;
        });
    }

    for (const rankings of [groupARankings, groupBRankings]) {
        let qualifiedCount = 0;
        rankings.forEach((team) => {
            if (dqTeamIds.has(team.teamId)) return; // Skip DQ'd
            qualifiedCount++;
            if (qualifiedCount <= 4) {
                updates.push({ teamId: team.teamId, status: "QUALIFIED", phase: "FINALS" });
            } else if (qualifiedCount <= 12) {
                updates.push({ teamId: team.teamId, status: "WILDCARD", phase: "WILDCARD" });
            } else {
                updates.push({ teamId: team.teamId, status: "ELIMINATED", phase: "HEATS" });
            }
        });
    }

    // Update championship entries
    for (const u of updates) {
        await prisma.championshipEntry.updateMany({
            where: { tournamentId, teamId: u.teamId },
            data: {
                status: u.status as any,
                phase: u.phase as any,
            },
        });
    }

    // Create Wildcard matches (4 matches)
    const wildcardTeams = updates.filter(u => u.status === "WILDCARD");
    for (let i = 1; i <= 4; i++) {
        const existingCount = await prisma.match.count({ where: { tournamentId } });
        const match = await prisma.match.create({
            data: {
                tournamentId,
                seasonId,
                matchNumber: existingCount + 1,
                phase: "WILDCARD",
            },
        });

        // Connect wildcard teams to the match
        await prisma.match.update({
            where: { id: match.id },
            data: {
                teams: {
                    connect: wildcardTeams.map(t => ({ id: t.teamId })),
                },
            },
        });

        // Create TeamStats for each team in this match
        for (const t of wildcardTeams) {
            await prisma.teamStats.create({
                data: {
                    teamId: t.teamId,
                    matchId: match.id,
                    seasonId,
                    tournamentId,
                },
            });
        }
    }

    return {
        directQualifiers: updates.filter(u => u.status === "QUALIFIED").length,
        wildcardTeams: wildcardTeams.length,
        eliminated: updates.filter(u => u.status === "ELIMINATED").length,
        groupARankings,
        groupBRankings,
    };
}

// ─── Progress from Heats (Lite) ──────────────────────────────

/**
 * Championship Lite: After Heats phase (4 matches per group):
 * - Top 8 per group → QUALIFIED (direct to Finals)
 * - Remaining per group → ELIMINATED
 *
 * Used when total teams ≤ 22 — skips the Wildcard phase entirely.
 */
export async function progressFromHeatsLite(tournamentId: string, seasonId: string) {
    // Validate all heat matches are scored
    const heatMatches = await prisma.match.findMany({
        where: { tournamentId, phase: { in: ["HEATS_A", "HEATS_B"] } },
        include: { _count: { select: { teamStats: true } } },
    });

    const unscoredMatches = heatMatches.filter(m => m._count.teamStats === 0);
    if (unscoredMatches.length > 0) {
        throw new Error(`${unscoredMatches.length} heat match(es) still need scores.`);
    }

    // Rank each group
    const [groupARankings, groupBRankings] = await Promise.all([
        getPhaseRankings(tournamentId, "HEATS_A"),
        getPhaseRankings(tournamentId, "HEATS_B"),
    ]);

    const QUALIFY_CUTOFF = 8; // Top 8 per group advance to Finals
    const updates: { teamId: string; status: string; phase: string }[] = [];

    // Get DQ'd team IDs so we skip them during qualification
    const dqTeams = await prisma.team.findMany({
        where: { tournamentId, disqualified: true },
        select: { id: true },
    });
    const dqTeamIds = new Set(dqTeams.map(t => t.id));

    // Get point deductions so rankings reflect penalties
    const teamsWithDeductions = await prisma.team.findMany({
        where: { tournamentId, pointDeduction: { gt: 0 } },
        select: { id: true, pointDeduction: true },
    });
    const deductionMap = new Map(teamsWithDeductions.map(t => [t.id, t.pointDeduction]));

    // Apply deductions and re-sort each group
    for (const rankings of [groupARankings, groupBRankings]) {
        for (const team of rankings) {
            const deduction = deductionMap.get(team.teamId) ?? 0;
            if (deduction > 0) {
                team.totalPoints -= deduction;
            }
        }
        // Re-sort with deductions applied (same tiebreaker logic)
        rankings.sort((a, b) => {
            if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.placementPts !== a.placementPts) return b.placementPts - a.placementPts;
            if (b.kills !== a.kills) return b.kills - a.kills;
            return a.lastMatchPosition - b.lastMatchPosition;
        });
    }

    for (const rankings of [groupARankings, groupBRankings]) {
        let qualifiedCount = 0;
        rankings.forEach((team) => {
            if (dqTeamIds.has(team.teamId)) {
                // Keep DQ'd — don't change status
                return;
            }
            qualifiedCount++;
            if (qualifiedCount <= QUALIFY_CUTOFF) {
                updates.push({ teamId: team.teamId, status: "QUALIFIED", phase: "FINALS" });
            } else {
                updates.push({ teamId: team.teamId, status: "ELIMINATED", phase: "HEATS" });
            }
        });
    }

    // Update championship entries
    for (const u of updates) {
        await prisma.championshipEntry.updateMany({
            where: { tournamentId, teamId: u.teamId },
            data: {
                status: u.status as any,
                phase: u.phase as any,
            },
        });
    }

    // Get all finalists
    const finalists = updates.filter(u => u.status === "QUALIFIED");

    // Create Finals matches (4 matches) — skip Wildcard entirely
    for (let i = 1; i <= 4; i++) {
        const existingCount = await prisma.match.count({ where: { tournamentId } });
        const match = await prisma.match.create({
            data: {
                tournamentId,
                seasonId,
                matchNumber: existingCount + 1,
                phase: "FINALS",
            },
        });

        // Connect finalist teams to the match
        await prisma.match.update({
            where: { id: match.id },
            data: {
                teams: {
                    connect: finalists.map(f => ({ id: f.teamId })),
                },
            },
        });

        // Create TeamStats for each finalist in this match
        for (const f of finalists) {
            await prisma.teamStats.create({
                data: {
                    teamId: f.teamId,
                    matchId: match.id,
                    seasonId,
                    tournamentId,
                },
            });
        }
    }

    // Mark qualified teams as ACTIVE for finals
    await prisma.championshipEntry.updateMany({
        where: {
            tournamentId,
            status: "QUALIFIED",
            phase: "FINALS",
        },
        data: { status: "ACTIVE" },
    });

    return {
        directQualifiers: finalists.length,
        eliminated: updates.filter(u => u.status === "ELIMINATED").length,
        totalFinalists: finalists.length,
        groupARankings,
        groupBRankings,
        isLite: true,
    };
}

// ─── Progress from Wildcard ──────────────────────────────────

/**
 * After Wildcard phase (4 matches, points reset):
 * - Top 8 → QUALIFIED (to Finals)
 * - Bottom 8 → ELIMINATED
 */
export async function progressFromWildcard(tournamentId: string, seasonId: string) {
    // Validate all wildcard matches are scored
    const wildcardMatches = await prisma.match.findMany({
        where: { tournamentId, phase: "WILDCARD" },
        include: { _count: { select: { teamStats: true } } },
    });

    const unscoredMatches = wildcardMatches.filter(m => m._count.teamStats === 0);
    if (unscoredMatches.length > 0) {
        throw new Error(`${unscoredMatches.length} wildcard match(es) still need scores.`);
    }

    const rankings = await getPhaseRankings(tournamentId, "WILDCARD");

    const updates: { teamId: string; status: string }[] = [];

    // Get DQ'd team IDs
    const dqTeams = await prisma.team.findMany({
        where: { tournamentId, disqualified: true },
        select: { id: true },
    });
    const dqTeamIds = new Set(dqTeams.map(t => t.id));

    // Get point deductions
    const teamsWithDeductions = await prisma.team.findMany({
        where: { tournamentId, pointDeduction: { gt: 0 } },
        select: { id: true, pointDeduction: true },
    });
    const deductionMap = new Map(teamsWithDeductions.map(t => [t.id, t.pointDeduction]));

    // Apply deductions and re-sort
    for (const team of rankings) {
        const deduction = deductionMap.get(team.teamId) ?? 0;
        if (deduction > 0) {
            team.totalPoints -= deduction;
        }
    }
    rankings.sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.placementPts !== a.placementPts) return b.placementPts - a.placementPts;
        if (b.kills !== a.kills) return b.kills - a.kills;
        return a.lastMatchPosition - b.lastMatchPosition;
    });

    let qualifiedCount = 0;
    rankings.forEach((team) => {
        if (dqTeamIds.has(team.teamId)) return; // Skip DQ'd
        qualifiedCount++;
        if (qualifiedCount <= 8) {
            updates.push({ teamId: team.teamId, status: "QUALIFIED" });
        } else {
            updates.push({ teamId: team.teamId, status: "ELIMINATED" });
        }
    });

    // Update championship entries
    for (const u of updates) {
        await prisma.championshipEntry.updateMany({
            where: { tournamentId, teamId: u.teamId },
            data: {
                status: u.status as any,
                phase: u.status === "QUALIFIED" ? "FINALS" : "WILDCARD",
            },
        });
    }

    // Get all finalists (8 direct from heats + 8 from wildcard)
    const finalists = await prisma.championshipEntry.findMany({
        where: {
            tournamentId,
            status: "QUALIFIED",
            phase: "FINALS",
        },
        select: { teamId: true },
    });

    // Create Finals matches (4 matches)
    for (let i = 1; i <= 4; i++) {
        const existingCount = await prisma.match.count({ where: { tournamentId } });
        const match = await prisma.match.create({
            data: {
                tournamentId,
                seasonId,
                matchNumber: existingCount + 1,
                phase: "FINALS",
            },
        });

        // Connect finalist teams to the match
        await prisma.match.update({
            where: { id: match.id },
            data: {
                teams: {
                    connect: finalists.map(f => ({ id: f.teamId })),
                },
            },
        });

        // Create TeamStats for each finalist in this match
        for (const f of finalists) {
            await prisma.teamStats.create({
                data: {
                    teamId: f.teamId,
                    matchId: match.id,
                    seasonId,
                    tournamentId,
                },
            });
        }
    }

    // Mark qualified teams as ACTIVE for finals
    await prisma.championshipEntry.updateMany({
        where: {
            tournamentId,
            status: "QUALIFIED",
            phase: "FINALS",
        },
        data: { status: "ACTIVE" },
    });

    return {
        qualifiedToFinals: updates.filter(u => u.status === "QUALIFIED").length,
        eliminated: updates.filter(u => u.status === "ELIMINATED").length,
        totalFinalists: finalists.length,
        wildcardRankings: rankings,
    };
}

// ─── Get Championship Status ─────────────────────────────────

export type ChampionshipStatus = {
    currentPhase: "HEATS" | "WILDCARD" | "FINALS" | "COMPLETE";
    isLite: boolean; // true = ≤22 teams, skip Wildcard (Heats → Finals)
    entries: {
        teamId: string;
        teamName: string;
        group: string | null;
        phase: string;
        status: string;
        pointDeduction?: number;
    }[];
    matches: {
        id: string;
        matchNumber: number;
        phase: string | null;
        hasStats: boolean;
    }[];
};

/**
 * Get the current state of a championship tournament.
 */
export async function getChampionshipStatus(tournamentId: string): Promise<ChampionshipStatus> {
    const [entries, matches] = await Promise.all([
        prisma.championshipEntry.findMany({
            where: { tournamentId },
            include: { team: { select: { name: true } } },
            orderBy: [{ group: "asc" }, { registeredAt: "asc" }],
        }),
        prisma.match.findMany({
            where: { tournamentId, phase: { not: null } },
            include: { _count: { select: { teamStats: true } } },
            orderBy: { matchNumber: "asc" },
        }),
    ]);

    // Determine current phase
    let currentPhase: ChampionshipStatus["currentPhase"] = "HEATS";

    const finalsMatches = matches.filter(m => m.phase === "FINALS");
    const wildcardMatches = matches.filter(m => m.phase === "WILDCARD");
    const heatsMatches = matches.filter(m => m.phase?.startsWith("HEATS"));

    if (finalsMatches.length > 0) {
        const allFinalsScored = finalsMatches.every(m => m._count.teamStats > 0);
        currentPhase = allFinalsScored ? "COMPLETE" : "FINALS";
    } else if (wildcardMatches.length > 0) {
        currentPhase = "WILDCARD";
    } else if (heatsMatches.length > 0) {
        currentPhase = "HEATS";
    }

    // Lite mode: ≤22 active (non-standby) entries → skip Wildcard
    const activeEntryCount = entries.filter(e => e.status !== "STANDBY").length;
    const isLite = activeEntryCount > 0 && activeEntryCount <= 22;

    // Build ranked entries — sort by actual standings when match data exists
    // Also fetch DQ status from teams
    const dqTeams = await prisma.team.findMany({
        where: { tournamentId, disqualified: true },
        select: { id: true },
    });
    const dqTeamIdSet = new Set(dqTeams.map(t => t.id));

    // Fetch point deductions
    const teamsWithDeductions = await prisma.team.findMany({
        where: { tournamentId, pointDeduction: { gt: 0 } },
        select: { id: true, pointDeduction: true },
    });
    const deductionMap = new Map(teamsWithDeductions.map(t => [t.id, t.pointDeduction]));

    let rankedEntries = entries.map(e => ({
        teamId: e.teamId,
        teamName: e.team.name,
        group: e.group,
        phase: e.phase,
        status: e.status,
        disqualified: dqTeamIdSet.has(e.teamId),
        totalPoints: 0,
        kills: 0,
        pointDeduction: 0 as number | undefined,
    }));

    // If heats have been scored, sort entries per group by actual standings rank
    const scoredHeats = heatsMatches.filter(m => m._count.teamStats > 0);
    // Build a points map from all available rankings
    const pointsMap = new Map<string, { totalPoints: number; kills: number }>();

    if (scoredHeats.length > 0) {
        try {
            // Get rankings per group
            const [groupARanks, groupBRanks] = await Promise.all([
                getPhaseRankings(tournamentId, "HEATS_A"),
                getPhaseRankings(tournamentId, "HEATS_B"),
            ]);

            // Apply deductions and re-sort before building rank map
            for (const ranks of [groupARanks, groupBRanks]) {
                for (const t of ranks) {
                    const deduction = deductionMap.get(t.teamId) ?? 0;
                    if (deduction > 0) t.totalPoints -= deduction;
                }
                ranks.sort((a, b) => {
                    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
                    if (b.wins !== a.wins) return b.wins - a.wins;
                    if (b.placementPts !== a.placementPts) return b.placementPts - a.placementPts;
                    if (b.kills !== a.kills) return b.kills - a.kills;
                    return a.lastMatchPosition - b.lastMatchPosition;
                });
            }

            // Build rank map: teamId → rank position (now with deductions applied)
            const rankMap = new Map<string, number>();
            groupARanks.forEach((t, i) => {
                rankMap.set(t.teamId, i + 1);
                pointsMap.set(t.teamId, { totalPoints: t.totalPoints, kills: t.kills });
            });
            groupBRanks.forEach((t, i) => {
                rankMap.set(t.teamId, i + 1);
                pointsMap.set(t.teamId, { totalPoints: t.totalPoints, kills: t.kills });
            });

            // Sort entries: by group first, then by rank within group
            // DQ'd teams go to end of their group
            rankedEntries.sort((a, b) => {
                // Group ordering: A before B, then null
                const groupOrder = (g: string | null) => g === "A" ? 0 : g === "B" ? 1 : 2;
                const gDiff = groupOrder(a.group) - groupOrder(b.group);
                if (gDiff !== 0) return gDiff;

                // DQ'd teams go to end of their group
                const aDQ = a.disqualified ? 1 : 0;
                const bDQ = b.disqualified ? 1 : 0;
                if (aDQ !== bDQ) return aDQ - bDQ;

                // Sort by rank within group
                const aRank = rankMap.get(a.teamId) ?? 999;
                const bRank = rankMap.get(b.teamId) ?? 999;
                return aRank - bRank;
            });
        } catch {
            // If ranking fails, keep registration order
        }
    }

    // Fetch finals rankings if in finals/complete phase
    if (currentPhase === "FINALS" || currentPhase === "COMPLETE") {
        try {
            const finalsRanks = await getPhaseRankings(tournamentId, "FINALS");
            finalsRanks.forEach(t => {
                pointsMap.set(t.teamId, { totalPoints: t.totalPoints, kills: t.kills });
            });
        } catch {
            // Ignore — finals may not have scores yet
        }
    }

    // Fetch wildcard rankings if in wildcard/later phase
    if (currentPhase === "WILDCARD" || currentPhase === "FINALS" || currentPhase === "COMPLETE") {
        try {
            const wcRanks = await getPhaseRankings(tournamentId, "WILDCARD");
            wcRanks.forEach(t => {
                // Only set if not already set by finals
                if (!pointsMap.has(t.teamId) || currentPhase === "WILDCARD") {
                    pointsMap.set(t.teamId, { totalPoints: t.totalPoints, kills: t.kills });
                }
            });
        } catch {
            // Ignore
        }
    }

    // Merge points data into entries
    // Note: heats pointsMap already has deductions applied from the re-sort above
    for (const entry of rankedEntries) {
        const pts = pointsMap.get(entry.teamId);
        if (pts) {
            entry.totalPoints = pts.totalPoints;
            entry.kills = pts.kills;
        }
        const deduction = deductionMap.get(entry.teamId) ?? 0;
        if (deduction > 0) {
            entry.pointDeduction = deduction;
            // Only apply deduction if not already applied via pointsMap
            if (!pts) {
                entry.totalPoints -= deduction;
            }
        }
    }

    return {
        currentPhase,
        isLite,
        entries: rankedEntries,
        matches: matches.map(m => ({
            id: m.id,
            matchNumber: m.matchNumber,
            phase: m.phase,
            hasStats: m._count.teamStats > 0,
        })),
    };
}
