/**
 * Profanity filter for user-generated content (team names, display names, etc.)
 *
 * Uses a curated list of common slurs, sexual terms, and offensive words.
 * Checks against normalized input (lowercase, stripped of special chars/numbers).
 */

// Common substitutions: l33t speak, symbol replacements
const LEET_MAP: Record<string, string> = {
    "0": "o", "1": "i", "3": "e", "4": "a", "5": "s",
    "7": "t", "8": "b", "@": "a", "$": "s", "!": "i",
    "€": "e", "×": "x", "々": "",  "❤️": "", "❤": "",
    "♥": "", "♡": "", "★": "", "☆": "",
};

/** Normalize text: strip special chars, apply leet-speak reversal */
function normalize(text: string): string {
    let result = text.toLowerCase();
    // Apply leet substitutions
    for (const [char, replacement] of Object.entries(LEET_MAP)) {
        result = result.split(char).join(replacement);
    }
    // Remove all non-alpha characters
    return result.replace(/[^a-z]/g, "");
}

/**
 * Curated word list — common English profanity, slurs, and sexual terms.
 * Kept minimal to avoid false positives. Add more as needed.
 */
const BLOCKED_WORDS = new Set([
    // Sexual / explicit
    "milf", "dilf", "porn", "pussy", "penis", "vagina", "dildo",
    "boobs", "titties", "tits", "cum", "cumshot", "jizz",
    "blowjob", "handjob", "rimjob", "anal", "anus", "orgasm",
    "hentai", "bdsm", "fetish", "erotic",
    // Profanity
    "fuck", "fucker", "fucking", "motherfucker", "fck",
    "shit", "bullshit", "shitty",
    "bitch", "bitches",
    "ass", "asshole", "arsehole",
    "dick", "dickhead",
    "cunt", "twat",
    "bastard", "whore", "slut", "skank",
    "crap", "damn", "piss",
    // Slurs (racial, homophobic, ableist)
    "nigger", "nigga", "negro", "chink", "gook", "spic",
    "kike", "wetback", "beaner",
    "faggot", "fag", "dyke", "tranny",
    "retard", "retarded",
    // Violence
    "rape", "rapist",
    // Drug-related (context-dependent, but safer to block)
    "cocaine", "heroin", "meth",
]);

/**
 * Check if a string contains profanity.
 * Returns the matched word if found, or null if clean.
 */
export function containsProfanity(text: string): string | null {
    const normalized = normalize(text);

    // Exact full-text match
    if (BLOCKED_WORDS.has(normalized)) return normalized;

    // Substring match — check if any blocked word appears within the text
    for (const word of BLOCKED_WORDS) {
        if (word.length >= 3 && normalized.includes(word)) {
            return word;
        }
    }

    return null;
}

/**
 * Returns true if the text is clean (no profanity detected).
 */
export function isCleanText(text: string): boolean {
    return containsProfanity(text) === null;
}
