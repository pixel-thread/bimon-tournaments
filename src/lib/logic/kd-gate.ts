import { prisma } from "@/lib/database";

/**
 * KD Gate — Check if a player's KD is within a poll's allowed range.
 *
 * Returns `{ allowed: true }` or `{ allowed: false, message, playerKd }`.
 *
 * Skips check when:
 * - Poll has no KD restriction (both kdMin and kdMax are null)
 * - Player is a ghost
 * - Caller is admin (opt-in via `opts.isAdmin`)
 */

export interface KdGateResult {
    allowed: boolean;
    message?: string;
    playerKd?: number;
}

export async function checkKdGate(
    playerId: string,
    pollId: string,
    opts?: { isAdmin?: boolean; isGhost?: boolean }
): Promise<KdGateResult> {
    // Admins bypass
    if (opts?.isAdmin) {
        return { allowed: true };
    }

    // Fetch poll's KD range
    const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        select: {
            kdMin: true,
            kdMax: true,
            tournament: { select: { seasonId: true } },
        },
    });

    if (!poll) {
        return { allowed: true }; // Poll not found — let other validation handle it
    }

    // No restriction set → allow everyone (including ghosts)
    if (poll.kdMin == null && poll.kdMax == null) {
        return { allowed: true };
    }

    // Ghost players are blocked on KD-restricted tournaments (no verifiable stats)
    if (opts?.isGhost) {
        return {
            allowed: false,
            playerKd: 0,
            message: `🎯 Ghost players are not allowed in KD-restricted tournaments (KD ${poll.kdMin ?? 0}–${poll.kdMax ?? "∞"})`,
        };
    }

    // Compute player's KD from TeamPlayerStats (source of truth).
    // The PlayerStats.kd field is NOT kept up-to-date — the real KD is
    // kills / matches aggregated from TeamPlayerStats, matching the
    // computation used in /api/players, /api/profile, etc.
    const seasonId = poll.tournament?.seasonId;

    const tpsWhere: Record<string, unknown> = {
        playerId,
        present: true,
    };
    if (seasonId) {
        tpsWhere.seasonId = seasonId;
    }

    const agg = await prisma.teamPlayerStats.aggregate({
        where: tpsWhere,
        _count: { matchId: true },
        _sum: { kills: true },
    });

    const totalKills = agg._sum.kills ?? 0;
    const totalMatches = agg._count.matchId;
    const playerKd = totalMatches > 0 ? Number((totalKills / totalMatches).toFixed(2)) : 0;

    // Check range
    if (poll.kdMin != null && playerKd < poll.kdMin) {
        return {
            allowed: false,
            playerKd,
            message: `🎯 Your KD (${playerKd.toFixed(2)}) is below the minimum (${poll.kdMin}) for this tournament`,
        };
    }

    if (poll.kdMax != null && playerKd > poll.kdMax) {
        return {
            allowed: false,
            playerKd,
            message: `🎯 Your KD (${playerKd.toFixed(2)}) is above the maximum (${poll.kdMax}) for this tournament`,
        };
    }

    return { allowed: true, playerKd };
}
