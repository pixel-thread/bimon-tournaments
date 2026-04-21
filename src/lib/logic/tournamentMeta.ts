import { prisma } from "@/lib/database";

/**
 * Get tournament pool metadata — used by both declare-winners and tax-preview
 * to ensure identical Org/Fund/Prize calculations.
 *
 * Data source: teamStats → team.players (same as declare-winners teamMap)
 */
export interface TournamentPoolMeta {
    totalPlayers: number;
    teamCount: number;
    teamSize: number;
    ucExemptCount: number;
    entryFee: number;
    prizePool: number;
}

export async function getTournamentPoolMeta(tournamentId: string): Promise<TournamentPoolMeta> {
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { fee: true },
    });

    const entryFee = tournament?.fee ?? 0;

    // Same query as declare-winners: teamStats → team.players
    const teamStats = await prisma.teamStats.findMany({
        where: { tournamentId },
        include: {
            team: {
                include: {
                    players: {
                        select: { id: true, isUCExempt: true },
                    },
                },
            },
        },
    });

    // Same aggregation as declare-winners (lines 124-135)
    const allPlayerIds = new Set<string>();
    let ucExemptCount = 0;
    const teamMap = new Map<string, { players: { id: string; isUCExempt: boolean }[] }>();

    for (const stat of teamStats) {
        if (!teamMap.has(stat.teamId)) {
            teamMap.set(stat.teamId, { players: stat.team.players });
        }
    }

    for (const team of teamMap.values()) {
        for (const p of team.players) {
            allPlayerIds.add(p.id);
            if (p.isUCExempt) ucExemptCount++;
        }
    }

    const totalPlayers = allPlayerIds.size;
    const teamCount = teamMap.size;
    const teamSize = teamCount > 0 ? Math.round(totalPlayers / teamCount) : 2;
    const prizePool = entryFee * totalPlayers;

    // UC exempt doesn't apply in squad polls — everyone pays their share
    const poll = await prisma.poll.findFirst({
        where: { tournamentId },
        select: { allowSquads: true },
    });
    const effectiveUcExemptCount = poll?.allowSquads ? 0 : ucExemptCount;

    return { totalPlayers, teamCount, teamSize, ucExemptCount: effectiveUcExemptCount, entryFee, prizePool };
}
