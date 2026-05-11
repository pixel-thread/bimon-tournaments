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
 * Award XP to a player and auto-update the level.
 * Uses atomic increment to prevent race conditions.
 */
export async function awardPlayerXP(
    playerId: string,
    amount: number,
    prismaClient: PrismaClient | any,
): Promise<void> {
    if (amount <= 0) return;

    const player = await prismaClient.player.update({
        where: { id: playerId },
        data: { xp: { increment: amount } },
        select: { xp: true, level: true },
    });

    const { level: newLevel } = getLevelFromXP(player.xp);
    if (newLevel !== player.level) {
        await prismaClient.player.update({
            where: { id: playerId },
            data: { level: newLevel },
        });
    }
}

/**
 * Award XP for match stats — handles BOTH player and clan XP in one pass.
 * Call this after bulk stats are saved.
 *
 * Player XP: +25 per match, +5 per kill, +15 for chicken dinner
 * Clan XP:   +10 per match, +5 per kill, +8 for 1st, +4 for top 3
 */
export async function awardMatchXP(
    stats: { playerId: string; kills: number | null; position: number | null; teamId: string }[],
    prismaClient: PrismaClient | any,
): Promise<void> {
    const playerIds = stats.map((s) => s.playerId);

    // Get clan memberships for players in this match
    const memberships = await prismaClient.clanMember.findMany({
        where: { playerId: { in: playerIds } },
        select: { playerId: true, clanId: true },
    });
    const playerClanMap = new Map<string, string>();
    for (const m of memberships) {
        playerClanMap.set(m.playerId, m.clanId);
    }

    // Group stats by team for position bonuses
    const teamPositions = new Map<string, number | null>();
    for (const s of stats) {
        if (s.position !== null) teamPositions.set(s.teamId, s.position);
    }

    // Accumulate XP
    const playerXP = new Map<string, number>();
    const clanXP = new Map<string, number>();
    const addPlayerXP = (pid: string, amount: number) => {
        playerXP.set(pid, (playerXP.get(pid) ?? 0) + amount);
    };
    const addClanXP = (cid: string, amount: number) => {
        clanXP.set(cid, (clanXP.get(cid) ?? 0) + amount);
    };

    for (const s of stats) {
        const clanId = playerClanMap.get(s.playerId);
        const isPresent = s.kills !== null;

        if (isPresent) {
            // Player XP: +25 per match
            addPlayerXP(s.playerId, 25);
            // Clan XP: +10 per match
            if (clanId) addClanXP(clanId, 10);
        }

        // Kill XP (same for both)
        if (s.kills && s.kills > 0) {
            addPlayerXP(s.playerId, s.kills * 5);
            if (clanId) addClanXP(clanId, s.kills * 5);
        }

        // Position bonuses
        const pos = teamPositions.get(s.teamId);
        if (pos !== null && pos !== undefined) {
            if (pos === 1) {
                addPlayerXP(s.playerId, 15); // Chicken dinner
                if (clanId) addClanXP(clanId, 8);
            } else if (pos <= 3) {
                if (clanId) addClanXP(clanId, 4);
            }
        }
    }

    // Award all XP
    const awards: Promise<void>[] = [];
    for (const [playerId, amount] of playerXP) {
        awards.push(awardPlayerXP(playerId, amount, prismaClient));
    }
    for (const [clanId, amount] of clanXP) {
        awards.push(awardClanXP(clanId, amount, prismaClient));
    }
    await Promise.all(awards);
}
