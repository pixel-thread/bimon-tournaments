import { PrismaClient } from "@prisma/client";

/**
 * Clan XP & Level System
 *
 * XP is awarded silently — players only see level + progress bar.
 * Formula: XP to next level = floor(10 × 1.1^currentLevel)
 *
 * Level 1→50: Easy, ~2-3 months of active play
 * Level 50→100: Exponentially harder, nearly impossible
 */

/** XP required to go from `level` to `level + 1` */
export function xpForNextLevel(level: number): number {
    return Math.floor(10 * Math.pow(1.1, level));
}

/** Cumulative XP required to reach a given level (from level 1) */
export function cumulativeXpForLevel(level: number): number {
    let total = 0;
    for (let i = 1; i < level; i++) {
        total += xpForNextLevel(i);
    }
    return total;
}

/**
 * Calculate level + progress percentage from raw XP.
 * Returns { level, progress } where progress is 0–100.
 */
export function getLevelFromXP(xp: number): { level: number; progress: number } {
    let level = 1;
    let remaining = xp;
    while (level < 100) {
        const needed = xpForNextLevel(level);
        if (remaining < needed) break;
        remaining -= needed;
        level++;
    }
    if (level >= 100) return { level: 100, progress: 100 };
    const needed = xpForNextLevel(level);
    return { level, progress: Math.min(Math.floor((remaining / needed) * 100), 99) };
}

/**
 * Award XP to a clan and auto-update the level.
 * Uses atomic increment to prevent race conditions.
 */
export async function awardClanXP(
    clanId: string,
    amount: number,
    prismaClient: PrismaClient | any,
): Promise<void> {
    if (amount <= 0) return;

    const clan = await prismaClient.clan.update({
        where: { id: clanId },
        data: { xp: { increment: amount } },
        select: { xp: true, level: true },
    });

    const { level: newLevel } = getLevelFromXP(clan.xp);
    if (newLevel !== clan.level) {
        await prismaClient.clan.update({
            where: { id: clanId },
            data: { level: newLevel },
        });
    }
}

/**
 * Calculate and award XP for match stats.
 * Call this after bulk stats are saved.
 *
 * @param stats - Array of { playerId, kills, position } for the match
 * @param prismaClient - Prisma instance (or transaction client)
 */
export async function awardMatchXP(
    stats: { playerId: string; kills: number | null; position: number | null; teamId: string }[],
    prismaClient: PrismaClient | any,
): Promise<void> {
    // Get clan memberships for all players in this match
    const playerIds = stats.map((s) => s.playerId);
    const memberships = await prismaClient.clanMember.findMany({
        where: { playerId: { in: playerIds } },
        select: { playerId: true, clanId: true },
    });

    if (memberships.length === 0) return;

    const playerClanMap = new Map<string, string>();
    for (const m of memberships) {
        playerClanMap.set(m.playerId, m.clanId);
    }

    // Accumulate XP per clan
    const clanXP = new Map<string, number>();
    const addXP = (clanId: string, amount: number) => {
        clanXP.set(clanId, (clanXP.get(clanId) ?? 0) + amount);
    };

    // Group stats by team to check for chicken dinner / top 3
    const teamPositions = new Map<string, number | null>();
    for (const s of stats) {
        if (s.position !== null) teamPositions.set(s.teamId, s.position);
    }

    for (const s of stats) {
        const clanId = playerClanMap.get(s.playerId);
        if (!clanId) continue;

        // +10 XP for playing a match (if not absent — kills !== null)
        if (s.kills !== null) {
            addXP(clanId, 10);
        }

        // +5 XP per kill
        if (s.kills && s.kills > 0) {
            addXP(clanId, s.kills * 5);
        }

        // Team-based bonuses (only award once per clan per team)
        const pos = teamPositions.get(s.teamId);
        if (pos !== null && pos !== undefined) {
            if (pos === 1) {
                addXP(clanId, 12); // 50 XP total split ~4 ways ≈ 12 per member
            } else if (pos <= 3) {
                addXP(clanId, 6);  // 25 XP total split ~4 ways ≈ 6 per member
            }
        }
    }

    // Award XP to each clan
    for (const [clanId, amount] of clanXP) {
        await awardClanXP(clanId, amount, prismaClient);
    }
}
