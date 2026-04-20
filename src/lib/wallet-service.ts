/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "./database";
import { GAME } from "./game-config";

/**
 * Wallet Service
 * 
 * All wallet operations go through here.
 * Each game instance has its own local wallet in the game DB.
 */

// ─── Helpers ────────────────────────────────────────────────

/**
 * Get a player's email from their game DB player ID.
 */
export async function getEmailByPlayerId(playerId: string, tx?: any): Promise<string | null> {
    const db = tx || prisma;
    const player = await db.player.findUnique({
        where: { id: playerId },
        include: { user: { select: { email: true } } },
    });
    return player?.user?.email ?? null;
}

/**
 * Find a player's local wallet by email.
 */
async function getLocalPlayerByEmail(email: string) {
    return prisma.user.findFirst({
        where: { OR: [{ email }, { secondaryEmail: email }] },
        include: { player: { include: { wallet: true } } },
    });
}

// ─── Read Operations ────────────────────────────────────────

/**
 * Get wallet balance for a user by email.
 */
export async function getBalance(email: string): Promise<number> {
    const user = await getLocalPlayerByEmail(email);
    return user?.player?.wallet?.balance ?? 0;
}

/**
 * Get the total UC reserved by active tournament votes AND squad invites.
 * Reserved = poll vote reservations + squad invite reservations.
 *
 * Poll votes: sum of (entryFee × voteCount) for active polls where player voted IN/SOLO.
 * Squad invites: sum of entryFee for ACCEPTED invites on FORMING/FULL squads with active polls.
 */
export async function getReservedBalance(playerId: string): Promise<number> {
    const [activeVotes, squadInvites] = await Promise.all([
        prisma.playerPollVote.findMany({
            where: {
                playerId,
                vote: { in: ["IN", "SOLO"] },
                poll: {
                    isActive: true,
                    tournament: {
                        status: "ACTIVE",
                        bracketMatches: { none: {} }, // bracket not generated yet
                    },
                },
            },
            include: {
                poll: {
                    include: {
                        tournament: {
                            select: { fee: true },
                        },
                    },
                },
            },
        }),
        prisma.squadInvite.findMany({
            where: {
                playerId,
                status: "ACCEPTED",
                squad: {
                    status: { in: ["FORMING", "FULL"] },
                    poll: {
                        isActive: true,
                        tournament: { status: "ACTIVE" },
                    },
                },
            },
            include: {
                squad: { select: { entryFee: true } },
            },
        }),
    ]);

    const pollReserved = activeVotes.reduce((sum, v) => sum + (v.poll.tournament?.fee ?? 0) * v.voteCount, 0);
    const squadReserved = squadInvites.reduce((sum, inv) => sum + inv.squad.entryFee, 0);
    return pollReserved + squadReserved;
}

/**
 * Get available balance = total balance − reserved balance.
 * This is what the player can actually spend (transfer, buy, etc.).
 */
export async function getAvailableBalance(email: string): Promise<{ balance: number; reserved: number; available: number; diamondBalance: number }> {
    const user = await getLocalPlayerByEmail(email);
    const balance = user?.player?.wallet?.balance ?? 0;
    const diamondBalance = user?.player?.wallet?.diamondBalance ?? 0;
    const reserved = user?.player ? await getReservedBalance(user.player.id) : 0;
    return { balance, reserved, available: balance - reserved, diamondBalance };
}

/**
 * Batch-fetch wallet balances for multiple emails.
 * Much faster than calling getBalance per player.
 */
export async function getBalancesBatch(emails: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (emails.length === 0) return map;

    const users = await prisma.user.findMany({
        where: { OR: [{ email: { in: emails } }, { secondaryEmail: { in: emails } }] },
        include: { player: { include: { wallet: true } } },
    });
    for (const u of users) {
        // Map both primary and secondary email to the balance
        if (u.email && emails.includes(u.email)) map.set(u.email, u.player?.wallet?.balance ?? 0);
        if (u.secondaryEmail && emails.includes(u.secondaryEmail)) map.set(u.secondaryEmail, u.player?.wallet?.balance ?? 0);
    }
    return map;
}

/**
 * Get recent transactions for a user.
 */
export async function getTransactions(
    email: string,
    options?: { game?: string; limit?: number; cursor?: string }
) {
    const user = await getLocalPlayerByEmail(email);
    if (!user?.player) return { transactions: [], hasMore: false };
    const limit = options?.limit ?? 20;
    const rows = await prisma.transaction.findMany({
        where: { playerId: user.player.id },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(options?.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();
    return { transactions: rows, hasMore };
}

// ─── Write Operations ───────────────────────────────────────

/**
 * Credit currency to a user's wallet.
 */
export async function creditWallet(
    email: string,
    amount: number,
    description: string,
    _reason: string = "OTHER",
    _metadata?: Record<string, unknown>,
    _name?: string | null,
    _imageUrl?: string | null,
): Promise<{ balance: number; transaction: any }> {
    const user = await getLocalPlayerByEmail(email);
    if (!user?.player) throw new Error("Player not found");
    const currentBalance = user.player.wallet?.balance ?? 0;
    const newBalance = currentBalance + amount;
    const [, tx] = await prisma.$transaction([
        prisma.wallet.upsert({
            where: { playerId: user.player.id },
            create: { playerId: user.player.id, balance: newBalance },
            update: { balance: newBalance },
        }),
        prisma.transaction.create({
            data: { playerId: user.player.id, amount, type: "CREDIT", description },
        }),
    ]);
    return { balance: newBalance, transaction: tx };
}

/**
 * Debit currency from a user's wallet.
 */
export async function debitWallet(
    email: string,
    amount: number,
    description: string,
    _reason: string = "OTHER",
    _metadata?: Record<string, unknown>,
): Promise<{ balance: number; transaction: any }> {
    const user = await getLocalPlayerByEmail(email);
    if (!user?.player) throw new Error("Player not found");
    const currentBalance = user.player.wallet?.balance ?? 0;
    const newBalance = currentBalance - amount;
    const [, tx] = await prisma.$transaction([
        prisma.wallet.upsert({
            where: { playerId: user.player.id },
            create: { playerId: user.player.id, balance: newBalance },
            update: { balance: newBalance },
        }),
        prisma.transaction.create({
            data: { playerId: user.player.id, amount, type: "DEBIT", description },
        }),
    ]);
    return { balance: newBalance, transaction: tx };
}

/**
 * Transfer currency between two users.
 */
export async function transferWallet(
    fromEmail: string,
    toEmail: string,
    amount: number,
    description?: string,
): Promise<void> {
    const [fromUser, toUser] = await Promise.all([
        getLocalPlayerByEmail(fromEmail),
        getLocalPlayerByEmail(toEmail),
    ]);
    if (!fromUser?.player || !toUser?.player) throw new Error("Player not found");
    const fromBalance = fromUser.player.wallet?.balance ?? 0;
    const toBalance = toUser.player.wallet?.balance ?? 0;
    await prisma.$transaction([
        prisma.wallet.upsert({
            where: { playerId: fromUser.player.id },
            create: { playerId: fromUser.player.id, balance: fromBalance - amount },
            update: { balance: fromBalance - amount },
        }),
        prisma.wallet.upsert({
            where: { playerId: toUser.player.id },
            create: { playerId: toUser.player.id, balance: toBalance + amount },
            update: { balance: toBalance + amount },
        }),
        prisma.transaction.create({
            data: { playerId: fromUser.player.id, amount, type: "DEBIT", description: description || "Transfer to player" },
        }),
        prisma.transaction.create({
            data: { playerId: toUser.player.id, amount, type: "CREDIT", description: description || "Transfer from player" },
        }),
    ]);
}

// ─── Diamond Currency (MLBB reward-only) ────────────────────

/**
 * Get Diamond balance for a user by email.
 */
export async function getDiamondBalance(email: string): Promise<number> {
    const user = await getLocalPlayerByEmail(email);
    return user?.player?.wallet?.diamondBalance ?? 0;
}

/**
 * Credit Diamond to a user's wallet (reward-only, admin use).
 */
export async function creditDiamond(
    email: string,
    amount: number,
    description: string,
): Promise<{ diamondBalance: number; transaction: any }> {
    const user = await getLocalPlayerByEmail(email);
    if (!user?.player) throw new Error("Player not found");
    const currentBalance = user.player.wallet?.diamondBalance ?? 0;
    const newBalance = currentBalance + amount;
    const [, tx] = await prisma.$transaction([
        prisma.wallet.upsert({
            where: { playerId: user.player.id },
            create: { playerId: user.player.id, balance: 0, diamondBalance: newBalance },
            update: { diamondBalance: newBalance },
        }),
        prisma.transaction.create({
            data: { playerId: user.player.id, amount, type: "CREDIT", currency: "DIAMOND", description },
        }),
    ]);
    return { diamondBalance: newBalance, transaction: tx };
}

/**
 * Debit Diamond from a user's wallet (admin use).
 */
export async function debitDiamond(
    email: string,
    amount: number,
    description: string,
): Promise<{ diamondBalance: number; transaction: any }> {
    const user = await getLocalPlayerByEmail(email);
    if (!user?.player) throw new Error("Player not found");
    const currentBalance = user.player.wallet?.diamondBalance ?? 0;
    const newBalance = currentBalance - amount;
    const [, tx] = await prisma.$transaction([
        prisma.wallet.upsert({
            where: { playerId: user.player.id },
            create: { playerId: user.player.id, balance: 0, diamondBalance: newBalance },
            update: { diamondBalance: newBalance },
        }),
        prisma.transaction.create({
            data: { playerId: user.player.id, amount, type: "DEBIT", currency: "DIAMOND", description },
        }),
    ]);
    return { diamondBalance: newBalance, transaction: tx };
}

/**
 * Helper: get the display label for the primary (entry fee) currency.
 */
export function getEntryCurrencyLabel(): string {
    return GAME.hasDualCurrency ? (GAME.entryCurrency ?? GAME.currency) : GAME.currency;
}
