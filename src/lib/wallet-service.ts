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
        // Squad reservations: only captains pay, so only reserve for captains
        prisma.squadInvite.findMany({
            where: {
                playerId,
                status: "ACCEPTED",
                squad: {
                    captainId: playerId, // Only the captain's fee is reserved
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
 * Uses atomic increment to prevent race conditions on concurrent updates.
 */
export async function creditWallet(
    email: string,
    amount: number,
    description: string,
    _reason: string = "OTHER",
): Promise<{ balance: number; transaction: unknown }> {
    const user = await getLocalPlayerByEmail(email);
    if (!user?.player) throw new Error("Player not found");
    const playerId = user.player.id;
    const [wallet, tx] = await prisma.$transaction([
        prisma.wallet.upsert({
            where: { playerId },
            create: { playerId, balance: amount },
            update: { balance: { increment: amount } },
        }),
        prisma.transaction.create({
            data: { playerId, amount, type: "CREDIT", description },
        }),
    ]);
    // After crediting, check if this player captains any unconfirmed squads
    checkAndConfirmSquads(playerId, wallet.balance).catch(() => {});
    return { balance: wallet.balance, transaction: tx };
}

/**
 * After a wallet credit, check if this player is a captain of any active squad
 * that hasn't been confirmed yet. If balance >= entryFee, stamp confirmedAt.
 */
async function checkAndConfirmSquads(playerId: string, newBalance: number) {
    const unconfirmedSquads = await prisma.squad.findMany({
        where: {
            captainId: playerId,
            status: { in: ["FORMING", "FULL", "REGISTERED"] },
            confirmedAt: null,
            entryFee: { gt: 0 },
        },
        select: { id: true, entryFee: true },
    });
    if (unconfirmedSquads.length === 0) return;

    // Check captain isTrusted — trusted captains don't need balance check
    const captain = await prisma.player.findUnique({
        where: { id: playerId },
        select: { isTrusted: true },
    });
    if (captain?.isTrusted) {
        // Trusted captains: confirm all their squads immediately
        await prisma.squad.updateMany({
            where: { id: { in: unconfirmedSquads.map(s => s.id) } },
            data: { confirmedAt: new Date() },
        });
        return;
    }

    // Non-trusted: confirm squads where balance >= entryFee
    const toConfirm = unconfirmedSquads.filter(s => newBalance >= s.entryFee);
    if (toConfirm.length > 0) {
        await prisma.squad.updateMany({
            where: { id: { in: toConfirm.map(s => s.id) } },
            data: { confirmedAt: new Date() },
        });
    }
}

/**
 * Debit currency from a user's wallet.
 * Uses atomic decrement to prevent race conditions on concurrent updates.
 */
export async function debitWallet(
    email: string,
    amount: number,
    description: string,
    _reason: string = "OTHER",
): Promise<{ balance: number; transaction: unknown }> {
    const user = await getLocalPlayerByEmail(email);
    if (!user?.player) throw new Error("Player not found");
    const playerId = user.player.id;
    const [wallet, tx] = await prisma.$transaction([
        prisma.wallet.upsert({
            where: { playerId },
            create: { playerId, balance: -amount },
            update: { balance: { decrement: amount } },
        }),
        prisma.transaction.create({
            data: { playerId, amount, type: "DEBIT", description },
        }),
    ]);
    return { balance: wallet.balance, transaction: tx };
}

/**
 * Transfer currency between two users.
 * Uses atomic increment/decrement to prevent race conditions.
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
    const fromPlayerId = fromUser.player.id;
    const toPlayerId = toUser.player.id;
    const [, toWallet] = await prisma.$transaction([
        prisma.wallet.upsert({
            where: { playerId: fromPlayerId },
            create: { playerId: fromPlayerId, balance: -amount },
            update: { balance: { decrement: amount } },
        }),
        prisma.wallet.upsert({
            where: { playerId: toPlayerId },
            create: { playerId: toPlayerId, balance: amount },
            update: { balance: { increment: amount } },
        }),
        prisma.transaction.create({
            data: { playerId: fromPlayerId, amount, type: "DEBIT", description: description || "Transfer to player" },
        }),
        prisma.transaction.create({
            data: { playerId: toPlayerId, amount, type: "CREDIT", description: description || "Transfer from player" },
        }),
    ]);
    // After transfer, check if recipient captains any unconfirmed squads
    checkAndConfirmSquads(toPlayerId, toWallet.balance).catch(() => {});
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
 * Uses atomic increment.
 */
export async function creditDiamond(
    email: string,
    amount: number,
    description: string,
): Promise<{ diamondBalance: number; transaction: unknown }> {
    const user = await getLocalPlayerByEmail(email);
    if (!user?.player) throw new Error("Player not found");
    const playerId = user.player.id;
    const [wallet, tx] = await prisma.$transaction([
        prisma.wallet.upsert({
            where: { playerId },
            create: { playerId, balance: 0, diamondBalance: amount },
            update: { diamondBalance: { increment: amount } },
        }),
        prisma.transaction.create({
            data: { playerId, amount, type: "CREDIT", currency: "DIAMOND", description },
        }),
    ]);
    return { diamondBalance: wallet.diamondBalance, transaction: tx };
}

/**
 * Debit Diamond from a user's wallet (admin use).
 * Uses atomic decrement.
 */
export async function debitDiamond(
    email: string,
    amount: number,
    description: string,
): Promise<{ diamondBalance: number; transaction: unknown }> {
    const user = await getLocalPlayerByEmail(email);
    if (!user?.player) throw new Error("Player not found");
    const playerId = user.player.id;
    const [wallet, tx] = await prisma.$transaction([
        prisma.wallet.upsert({
            where: { playerId },
            create: { playerId, balance: 0, diamondBalance: -amount },
            update: { diamondBalance: { decrement: amount } },
        }),
        prisma.transaction.create({
            data: { playerId, amount, type: "DEBIT", currency: "DIAMOND", description },
        }),
    ]);
    return { diamondBalance: wallet.diamondBalance, transaction: tx };
}

/**
 * Helper: get the display label for the primary (entry fee) currency.
 */
export function getEntryCurrencyLabel(): string {
    return GAME.hasDualCurrency ? (GAME.entryCurrency ?? GAME.currency) : GAME.currency;
}
