/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from "@prisma/client";

/**
 * Extract the "base" username by stripping the trailing random digits.
 * Our usernames are: `lowercased_google_name + 4_random_digits`
 * e.g. "milkysyiemunbroken4103" → "milkysyiemunbroken"
 */
function getUsernameBase(username: string): string {
    // Strip trailing digits (the 4-digit random suffix)
    return username.replace(/\d+$/, "");
}

/**
 * Normalize a player pair so the smaller ID is always first.
 * This prevents creating both A→B and B→A alerts.
 */
function normalizePair(id1: string, id2: string): [string, string] {
    return id1 < id2 ? [id1, id2] : [id2, id1];
}

/**
 * Normalize a display name for similarity comparison.
 * Strips special chars, diacritics, emoji, and lowercases.
 * e.g. "tmx♡pukhleiñ" → "tmxpukhlein", "tmxpukhlien" → "tmxpukhlien"
 */
function normalizeDisplayName(name: string): string {
    return name
        .normalize("NFD")                    // decompose diacritics (ñ → n + combining tilde)
        .replace(/[\u0300-\u036f]/g, "")     // strip combining characters
        .replace(/[^a-zA-Z0-9]/g, "")        // strip emoji, symbols, spaces
        .toLowerCase();
}

/**
 * Check a single player against all other players for duplicate signals.
 * Creates DuplicateAlert records for any matches found.
 *
 * Signals:
 *   1. Same phone number
 *   2. Same email ↔ secondary email overlap
 *   3. Same username base (Google name match)
 */
export async function checkPlayerForDuplicates(
    playerId: string,
    db: PrismaClient,
): Promise<number> {
    // Fetch the player + user info
    const player = await db.player.findUnique({
        where: { id: playerId },
        include: {
            user: {
                select: { id: true, email: true, secondaryEmail: true, username: true },
            },
        },
    });

    if (!player || !player.user) return 0;

    const { phoneNumber, displayName } = player;
    const { email, secondaryEmail, username } = player.user;
    const usernameBase = getUsernameBase(username);

    // Collect all matches as: { otherPlayerId, matchType, matchValue }
    type Signal = { otherPlayerId: string; matchType: string; matchValue: string };
    const signals: Signal[] = [];

    // ── 1. Phone number match ─────────────────────────────────
    if (phoneNumber) {
        const phoneMatches = await db.player.findMany({
            where: { phoneNumber, id: { not: playerId } },
            select: { id: true },
        });
        for (const match of phoneMatches) {
            signals.push({ otherPlayerId: match.id, matchType: "PHONE", matchValue: phoneNumber });
        }
    }

    // ── 2. Email ↔ Secondary email overlap ────────────────────
    if (email) {
        const emailMatches = await db.user.findMany({
            where: { secondaryEmail: email, id: { not: player.user.id } },
            include: { player: { select: { id: true } } },
        });
        for (const match of emailMatches) {
            if (match.player) {
                signals.push({ otherPlayerId: match.player.id, matchType: "EMAIL", matchValue: email });
            }
        }
    }

    if (secondaryEmail) {
        const secMatches = await db.user.findMany({
            where: { email: secondaryEmail, id: { not: player.user.id } },
            include: { player: { select: { id: true } } },
        });
        for (const match of secMatches) {
            if (match.player) {
                signals.push({ otherPlayerId: match.player.id, matchType: "EMAIL", matchValue: secondaryEmail });
            }
        }
    }

    // ── 3. Username base match ────────────────────────────────
    if (usernameBase && usernameBase.length >= 3) {
        const allUsers = await db.user.findMany({
            where: { id: { not: player.user.id } },
            select: { id: true, username: true, player: { select: { id: true } } },
        });

        for (const match of allUsers) {
            if (!match.player) continue;
            const otherBase = getUsernameBase(match.username);
            if (otherBase === usernameBase && otherBase.length >= 3) {
                signals.push({ otherPlayerId: match.player.id, matchType: "USERNAME", matchValue: `${username} ↔ ${match.username}` });
            }
        }
    }

    // ── 4. Display name similarity ────────────────────────
    if (displayName && displayName.length >= 3) {
        const normalizedName = normalizeDisplayName(displayName);
        if (normalizedName.length >= 3) {
            const allPlayers = await db.player.findMany({
                where: { id: { not: playerId } },
                select: { id: true, displayName: true },
            });

            for (const match of allPlayers) {
                if (!match.displayName) continue;
                if (normalizeDisplayName(match.displayName) === normalizedName) {
                    signals.push({ otherPlayerId: match.id, matchType: "DISPLAY_NAME", matchValue: `${displayName} ↔ ${match.displayName}` });
                }
            }
        }
    }

    // ── Deduplicate: group by pair, create ONE alert per pair ──
    const pairMap = new Map<string, { p1: string; p2: string; types: string[]; values: string[] }>();

    for (const sig of signals) {
        const [p1, p2] = normalizePair(playerId, sig.otherPlayerId);
        const key = `${p1}:${p2}`;
        if (!pairMap.has(key)) {
            pairMap.set(key, { p1, p2, types: [], values: [] });
        }
        const entry = pairMap.get(key)!;
        if (!entry.types.includes(sig.matchType)) {
            entry.types.push(sig.matchType);
            entry.values.push(sig.matchValue);
        }
    }

    let alertsCreated = 0;

    for (const { p1, p2, types, values } of pairMap.values()) {
        // Use the most specific match type, or combine them
        const matchType = types.length === 1 ? types[0] : types.join("+");
        const matchValue = values.join(" | ");

        // Check if ANY alert already exists for this pair (any match type)
        const existing = await db.duplicateAlert.findFirst({
            where: { player1Id: p1, player2Id: p2 },
        });

        if (existing) {
            // Update if we found new match types
            if (!existing.matchType.includes(types[0]) || types.length > 1) {
                const combinedTypes = new Set([...existing.matchType.split("+"), ...types]);
                const combinedValue = existing.matchValue === matchValue ? matchValue : `${existing.matchValue} | ${matchValue}`;
                await db.duplicateAlert.update({
                    where: { id: existing.id },
                    data: {
                        matchType: Array.from(combinedTypes).join("+"),
                        matchValue: combinedValue,
                    },
                });
            }
            // Don't count as new
        } else {
            try {
                await db.duplicateAlert.create({
                    data: { player1Id: p1, player2Id: p2, matchType, matchValue },
                });
                alertsCreated++;
            } catch {
                // unique constraint violation = already flagged, skip
            }
        }
    }

    return alertsCreated;
}

/**
 * Full scan: check ALL players for duplicates.
 * Used by the admin "Scan All" button.
 */
export async function scanAllPlayersForDuplicates(
    db: PrismaClient,
): Promise<number> {
    const players = await db.player.findMany({
        select: { id: true },
    });

    let total = 0;
    for (const player of players) {
        total += await checkPlayerForDuplicates(player.id, db);
    }
    return total;
}
