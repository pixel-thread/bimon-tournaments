import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { isBracketType } from "@/lib/bracket-types";

// BGMI placement points — must match standings-modal.tsx
const PLACEMENT_PTS: Record<number, number> = {
    1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1,
};

/**
 * GET /api/tournaments/[id]/rankings
 * Fetch team/player rankings for a tournament (admin only).
 * Handles both:
 *   - BR tournaments (uses TeamStats)
 *   - Bracket/League/GroupKnockout tournaments (uses BracketMatch)
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { id } = await params;

        const tournament = await prisma.tournament.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                fee: true,
                type: true,
                isWinnerDeclared: true,
            },
        });

        if (!tournament) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const isBR = tournament.type === "BR";

        // ─── BR tournaments: use TeamStats ───
        if (isBR) {
            return handleBRRankings(id, tournament);
        }

        // ─── Bracket/League/GroupKnockout/TDM: use BracketMatch ───
        if (isBracketType(tournament.type)) {
            return handleBracketRankings(id, tournament);
        }

        return NextResponse.json({ success: true, data: [], meta: buildMeta(tournament, 0, 0, "SOLO") });
    } catch (error) {
        console.error("Error fetching rankings:", error);
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }
}

// ─── BR Rankings (existing logic) ─────────────────────────────
async function handleBRRankings(tournamentId: string, tournament: any) {
    // Order by match number so lastMatchPosition is correctly set from the final match
    const teamStats = await prisma.teamStats.findMany({
        where: { tournamentId },
        include: {
            match: { select: { matchNumber: true } },
            team: {
                select: {
                    id: true,
                    name: true,
                    players: {
                        select: {
                            id: true,
                            displayName: true,
                            isUCExempt: true,
                            user: { select: { username: true } },
                        },
                    },
                },
            },
            teamPlayerStats: {
                select: {
                    playerId: true,
                    kills: true,
                    present: true,
                    player: {
                        select: {
                            id: true,
                            displayName: true,
                            isUCExempt: true,
                            user: { select: { username: true } },
                        },
                    },
                },
            },
        },
        orderBy: { match: { matchNumber: "asc" } },
    });

    const teamMap = new Map<string, {
        teamId: string; name: string; total: number; kills: number; pts: number;
        wins: number; lastMatchPosition: number;
        players: { id: string; name: string }[];
    }>();
    const allPlayerIds = new Set<string>();
    const ucExemptPlayerIds = new Set<string>();

    for (const stat of teamStats) {
        const kills = stat.teamPlayerStats.reduce((sum, ps) => sum + (ps.present !== false ? ps.kills : 0), 0);
        const pts = PLACEMENT_PTS[stat.position] ?? 0;
        const total = kills + pts;

        const existing = teamMap.get(stat.teamId);
        if (existing) {
            existing.kills += kills;
            existing.pts += pts;
            existing.total += total;
            if (stat.position === 1) existing.wins++;
            existing.lastMatchPosition = stat.position;
            for (const ps of stat.teamPlayerStats) {
                allPlayerIds.add(ps.playerId);
                if (!existing.players.some(p => p.id === ps.playerId)) {
                    existing.players.push({
                        id: ps.player.id,
                        name: ps.player.displayName || ps.player.user?.username || "Unknown",
                    });
                }
            }
        } else {
            const playerMap = new Map<string, string>();
            for (const p of stat.team.players) {
                playerMap.set(p.id, p.displayName || p.user?.username || "Unknown");
                allPlayerIds.add(p.id);
                if (p.isUCExempt) ucExemptPlayerIds.add(p.id);
            }
            for (const ps of stat.teamPlayerStats) {
                if (!playerMap.has(ps.playerId)) {
                    playerMap.set(ps.player.id, ps.player.displayName || ps.player.user?.username || "Unknown");
                }
                allPlayerIds.add(ps.playerId);
                if (ps.player.isUCExempt) ucExemptPlayerIds.add(ps.playerId);
            }
            const players = Array.from(playerMap.entries()).map(([pId, name]) => ({ id: pId, name }));
            teamMap.set(stat.teamId, {
                teamId: stat.teamId, name: stat.team.name, total, kills, pts,
                wins: stat.position === 1 ? 1 : 0,
                lastMatchPosition: stat.position,
                players,
            });
        }
    }

    // BGMI tiebreaker sort — must match standings-modal.tsx exactly
    const rankings = Array.from(teamMap.values()).sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;           // 1. Total points
        if (b.wins !== a.wins) return b.wins - a.wins;               // 2. Chicken dinners
        if (b.pts !== a.pts) return b.pts - a.pts;                   // 3. Placement points
        if (b.kills !== a.kills) return b.kills - a.kills;           // 4. Total kills
        return a.lastMatchPosition - b.lastMatchPosition;            // 5. Last match position (lower = better)
    });
    const teamCount = teamMap.size;
    const avgTeamSize = teamCount > 0 ? Math.round(allPlayerIds.size / teamCount) : 2;

    const [donations, pollForTournament] = await Promise.all([
        prisma.prizePoolDonation.findMany({
            where: { tournamentId },
            select: { amount: true },
        }),
        prisma.poll.findUnique({
            where: { tournamentId },
            select: { allowSquads: true, id: true },
        }),
    ]);
    const totalDonations = donations.reduce((sum: number, d: { amount: number }) => sum + d.amount, 0);
    const isSquadTournament = pollForTournament?.allowSquads ?? false;
    const entryFee = tournament.fee ?? 0;
    // Squad tournaments: captain pays per team, not per player
    const prizePool = isSquadTournament
        ? (entryFee * teamCount) + totalDonations
        : (entryFee * allPlayerIds.size) + totalDonations;

    // For squad tournaments: build captain map (teamId → captainId/captainName)
    let captainMap: Record<string, { id: string; name: string }> = {};
    if (isSquadTournament && pollForTournament) {
        const squads = await prisma.squad.findMany({
            where: { pollId: pollForTournament.id },
            select: {
                captainId: true,
                captain: { select: { id: true, displayName: true, user: { select: { username: true } } } },
                invites: {
                    where: { status: "ACCEPTED" },
                    select: { playerId: true },
                },
            },
        });
        // Map: for each squad member → find which team they're on → set captain
        for (const squad of squads) {
            const memberIds = squad.invites.map(i => i.playerId);
            const captainName = squad.captain.displayName || squad.captain.user.username || "Leader";
            for (const [teamId, team] of teamMap) {
                const hasSquadMember = team.players.some(p => memberIds.includes(p.id));
                if (hasSquadMember) {
                    captainMap[teamId] = { id: squad.captainId, name: captainName };
                    break;
                }
            }
        }
    }

    return NextResponse.json({
        success: true,
        data: rankings,
        meta: {
            entryFee,
            totalPlayers: allPlayerIds.size,
            teamCount,
            prizePool,
            donations: totalDonations,
            isSquadTournament,
            captainMap,
            teamType: avgTeamSize === 1 ? "SOLO" : avgTeamSize === 2 ? "DUO" : avgTeamSize === 3 ? "TRIO" : "SQUAD",
            isWinnerDeclared: tournament.isWinnerDeclared,
            ucExemptCount: isSquadTournament ? 0 : ucExemptPlayerIds.size,
        },
    });
}

// ─── Bracket/League Rankings (from BracketMatch data) ─────────
async function handleBracketRankings(tournamentId: string, tournament: any) {
    // Fetch all confirmed (or submitted) bracket matches
    const matches = await prisma.bracketMatch.findMany({
        where: {
            tournamentId,
            status: { in: ["CONFIRMED", "SUBMITTED"] },
            player1Id: { not: null },
            player2Id: { not: null },
        },
        select: {
            id: true,
            player1Id: true,
            player2Id: true,
            score1: true,
            score2: true,
            winnerId: true,
            round: true,
        },
    });

    // Aggregate per-player stats: wins, losses, draws, goalsFor, goalsAgainst
    const playerMap = new Map<string, {
        wins: number;
        losses: number;
        draws: number;
        goalsFor: number;
        goalsAgainst: number;
        matchesPlayed: number;
        points: number; // 3 for win, 1 for draw, 0 for loss
    }>();

    const ensurePlayer = (id: string) => {
        if (!playerMap.has(id)) {
            playerMap.set(id, { wins: 0, losses: 0, draws: 0, goalsFor: 0, goalsAgainst: 0, matchesPlayed: 0, points: 0 });
        }
        return playerMap.get(id)!;
    };

    for (const m of matches) {
        if (!m.player1Id || !m.player2Id) continue;
        const s1 = m.score1 ?? 0;
        const s2 = m.score2 ?? 0;

        const p1 = ensurePlayer(m.player1Id);
        const p2 = ensurePlayer(m.player2Id);

        p1.goalsFor += s1;
        p1.goalsAgainst += s2;
        p1.matchesPlayed += 1;

        p2.goalsFor += s2;
        p2.goalsAgainst += s1;
        p2.matchesPlayed += 1;

        if (s1 > s2) {
            p1.wins += 1; p1.points += 3;
            p2.losses += 1;
        } else if (s2 > s1) {
            p2.wins += 1; p2.points += 3;
            p1.losses += 1;
        } else {
            p1.draws += 1; p1.points += 1;
            p2.draws += 1; p2.points += 1;
        }
    }

    // Fetch player details
    const playerIds = Array.from(playerMap.keys());

    const players = playerIds.length > 0 ? await prisma.player.findMany({
        where: { id: { in: playerIds } },
        select: {
            id: true,
            displayName: true,
            isUCExempt: true,
            user: { select: { username: true } },
        },
    }) : [];

    // Build rankings sorted by: points desc, goal difference desc, goals for desc
    const rankings = playerIds.map(pid => {
        const stats = playerMap.get(pid)!;
        const player = players.find(p => p.id === pid);
        const name = player?.displayName || player?.user?.username || "Unknown";
        const goalDiff = stats.goalsFor - stats.goalsAgainst;

        return {
            teamId: pid, // For bracket, each player is their own "team"
            name,
            total: stats.points,
            kills: stats.goalsFor, // "kills" maps to "goals" for PES
            pts: goalDiff, // "pts" maps to goal difference
            players: [{ id: pid, name }],
            // Extra stats for display
            wins: stats.wins,
            losses: stats.losses,
            draws: stats.draws,
            goalsFor: stats.goalsFor,
            goalsAgainst: stats.goalsAgainst,
            goalDiff,
            matchesPlayed: stats.matchesPlayed,
        };
    }).sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total; // points
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff; // goal difference
        return b.goalsFor - a.goalsFor; // goals scored
    });

    const ucExemptCount = players.filter(p => p.isUCExempt).length;

    const donations = await prisma.prizePoolDonation.findMany({
        where: { tournamentId },
        select: { amount: true },
    });
    const totalDonations = donations.reduce((sum: number, d: { amount: number }) => sum + d.amount, 0);

    return NextResponse.json({
        success: true,
        data: rankings,
        meta: {
            entryFee: tournament.fee ?? 0,
            totalPlayers: playerIds.length,
            prizePool: ((tournament.fee ?? 0) * playerIds.length) + totalDonations,
            donations: totalDonations,
            teamType: "SOLO",
            isWinnerDeclared: tournament.isWinnerDeclared,
            ucExemptCount,
        },
    });
}

function buildMeta(tournament: any, totalPlayers: number, ucExemptCount: number, teamType: string) {
    return {
        entryFee: tournament.fee ?? 0,
        totalPlayers,
        prizePool: (tournament.fee ?? 0) * totalPlayers,
        teamType,
        isWinnerDeclared: tournament.isWinnerDeclared,
        ucExemptCount,
    };
}
