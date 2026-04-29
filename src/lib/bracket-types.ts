/**
 * Shared bracket tournament type constants.
 * Import these instead of hardcoding ["BRACKET_1V1", "LEAGUE", ...] everywhere.
 */

/** All tournament types that use the BracketMatch system */
export const BRACKET_TYPES = ["BRACKET_1V1", "LEAGUE", "GROUP_KNOCKOUT"] as const;

/** Knockout-only types (single elimination — winners advance) */
export const KO_BRACKET_TYPES = ["BRACKET_1V1", "GROUP_KNOCKOUT"] as const;

/** All valid tournament types (including TDM enum for stats/filtering) */
export const ALL_TOURNAMENT_TYPES = ["BR", "BRACKET_1V1", "LEAGUE", "GROUP_KNOCKOUT", "TDM", "WOW"] as const;

/** Check if a tournament type uses the bracket system */
export function isBracketType(type: string | null | undefined): boolean {
    return BRACKET_TYPES.includes(type as typeof BRACKET_TYPES[number]);
}

/** Check if a tournament type uses knockout advancement (winner moves to next round) */
export function isKOType(type: string | null | undefined): boolean {
    return KO_BRACKET_TYPES.includes(type as typeof KO_BRACKET_TYPES[number]);
}
