/**
 * Reusable player search filter for Prisma WHERE clauses.
 * Searches across: displayName, username, realName, email, secondaryEmail, phoneNumber, uid.
 * Use this everywhere players are searched (squad invite, clan invite, admin, public, etc.)
 *
 * @param q - The search query string
 * @param options.includeEmail - Whether to include email/secondaryEmail in search (default: false for player-facing, true for admin)
 * @returns Prisma OR filter array for Player model, or for User model (depending on context)
 */

/** For queries on the Player model (most common) */
export function playerSearchFilter(q: string, options?: { includeEmail?: boolean }) {
    const filters: Record<string, unknown>[] = [
        { displayName: { contains: q, mode: "insensitive" } },
        { realName: { contains: q, mode: "insensitive" } },
        { phoneNumber: { contains: q, mode: "insensitive" } },
        { uid: { contains: q, mode: "insensitive" } },
        { user: { username: { contains: q, mode: "insensitive" } } },
    ];

    if (options?.includeEmail) {
        filters.push(
            { user: { email: { contains: q, mode: "insensitive" } } },
            { user: { secondaryEmail: { contains: q, mode: "insensitive" } } },
        );
    }

    return filters;
}

/** For queries on the User model (admin user list, etc.) */
export function userSearchFilter(q: string) {
    return [
        { username: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { secondaryEmail: { contains: q, mode: "insensitive" } },
        { player: { displayName: { contains: q, mode: "insensitive" } } },
        { player: { realName: { contains: q, mode: "insensitive" } } },
        { player: { phoneNumber: { contains: q, mode: "insensitive" } } },
        { player: { uid: { contains: q, mode: "insensitive" } } },
    ];
}
