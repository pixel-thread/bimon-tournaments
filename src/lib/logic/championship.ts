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

    for (const rankings of [groupARankings, groupBRankings]) {
        rankings.forEach((team, index) => {
            const pos = index + 1;
            if (pos <= 4) {
                updates.push({ teamId: team.teamId, status: "QUALIFIED", phase: "FINALS" });
            } else if (pos <= 12) {
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

    for (const rankings of [groupARankings, groupBRankings]) {
        rankings.forEach((team, index) => {
            const pos = index + 1;
            if (pos <= QUALIFY_CUTOFF) {
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

    rankings.forEach((team, index) => {
        if (index < 8) {
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

    return {
        currentPhase,
        isLite,
        entries: entries.map(e => ({
            teamId: e.teamId,
            teamName: e.team.name,
            group: e.group,
            phase: e.phase,
            status: e.status,
        })),
        matches: matches.map(m => ({
            id: m.id,
            matchNumber: m.matchNumber,
            phase: m.phase,
            hasStats: m._count.teamStats > 0,
        })),
    };
}
