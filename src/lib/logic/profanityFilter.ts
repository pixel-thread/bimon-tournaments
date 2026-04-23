/**
 * Simple profanity filter for player bios and display names.
 * Replaces bad words with asterisks of matching length.
 */

// Common profanity words (English + common variants)
const BAD_WORDS = [
    // English
    "fuck", "shit", "ass", "asshole", "bitch", "dick", "cock", "pussy",
    "bastard", "damn", "cunt", "whore", "slut", "nigger", "nigga", "faggot",
    "retard", "penis", "vagina", "boob", "boobs", "tits", "titties", "tit",
    "blowjob", "handjob", "dildo", "wank", "wanker", "twat", "prick",
    "motherfucker", "fucker", "fucking", "fucked", "shitty", "bullshit",
    "dumbass", "jackass", "dickhead", "fag", "hoe", "cum", "jizz",
    "anal", "anus", "nude", "nudes", "porn", "sex", "sexy",
    // Leet/variant spellings
    "fuk", "fck", "sht", "btch", "dck", "psy", "cnt",
    "phuck", "phuk", "azz", "a$$",
    // Khasi profanity
    "stud", "liah", "bew", "tud", "suid", "thoh", "pylleng", "jnir", "dohlap",
];

// Build regex: each letter can be repeated (e.g. "titsss" matches "tits")
function buildPattern(words: string[]): RegExp {
    const parts = words.map(w => {
        const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // Allow each letter to repeat: t+ i+ t+ s+ catches "titsss", "tiits", etc.
        return escaped.split("").map(ch => /[a-zA-Z]/.test(ch) ? `${ch}+` : ch).join("");
    });
    return new RegExp(parts.join("|"), "gi");
}

const pattern = buildPattern(BAD_WORDS);

/**
 * Replace profanity in text with asterisks.
 * Each bad word is replaced with '*' of the same length.
 */
export function censorProfanity(text: string): string {
    if (!text) return text;
    return text.replace(pattern, (match) => "*".repeat(match.length));
}

/**
 * Check if text contains profanity.
 */
export function containsProfanity(text: string): boolean {
    if (!text) return false;
    return pattern.test(text);
}
