/**
 * Centralized translation strings for English ↔ Khasi.
 * Only includes entries where Khasi text actually differs from English.
 * Everything else stays English in both languages.
 */

export const translations = {
    // ─── Vote / Poll Options ──────────────────────
    votedIn: { en: "I'm In 😎", kha: "Nga Leh 😎" },
    votedOut: { en: "I'm Out", kha: "Leh rei" },
    votedSolo: { en: "Solo 🫩", kha: "Nga Leh solo 🫩" },

    // ─── Onboarding ───────────────────────────────
    copyPaste: { en: "Copy and paste", kha: "Copy bad paste" },
    canChangeLater: { en: "You can change this later from your profile page", kha: "Phi lah ban change biang na profile page" },

    // ─── Community subtitle ───────────────────────
    communitySubtitle1: { en: "Share feedback, ideas, or report bugs", kha: "Send message kumno bin pynbha ia kanoi ka tournament" },
    communitySubtitle2: { en: "Vote on polls and help shape the community", kha: "Pynbeit da n ong bakla lane ai ongmut ia u seng" },

    // ─── View All ─────────────────────────────────
    viewAll: { en: "View All", kha: "Peit baroh" },

    // ─── UC Transfer Defaults ─────────────────────
    transferRequestMsg: { en: "Can you spare some donations? 😭", kha: "Synei lem ia kiba duk 😭" },
    transferSendMsg: { en: "Take it, I'll give donations", kha: "Shim ai donation" },

    // ─── Royal Pass Page ──────────────────────────
    rpStreakDesc: { en: "Play {count} tournaments in a row to earn {reward} {currency} instant!", kha: "Leh kai ban ban {count} tournament ioh ei {reward} {currency} instant!" },
    rpGetToEarn: { en: "Get {passName} to earn {reward} {currency} when you hit {count} streak!", kha: "Get {passName} to earn {reward} {currency} when you hit {count} streak!" },
    rpHowItWorks: { en: "How it works:", kha: "How it works:" },
    rpStep1: { en: "Play in a tournament", kha: "Rung ha ka tournament" },
    rpStep2: { en: "Your streak increases by 1", kha: "Your streak increases by 1" },
    rpStep3: { en: "Miss a tournament? Your streak resets to 0", kha: "Pep shi tournament? Ka streak la resets sha 0" },
    rpStep4: { en: "Don't miss {count} tournaments → Get {reward} bonus!", kha: "Khlem pep {count} tournament → Ioh {reward} bonus!" },
    rpStep5: { en: "🎨 Upload custom character image/video for your podium card!", kha: "🎨 Upload custom character image/video for your podium card!" },
} as const;

export type TranslationKey = keyof typeof translations;

/** Pick the right locale string, substituting {placeholders} with values. */
export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
    // Import GAME inline to avoid circular deps — GAME.locale is "kha" | "en"
    const { GAME } = require("@/lib/game-config");
    const locale: "en" | "kha" = GAME.locale === "kha" ? "kha" : "en";
    let str: string = translations[key][locale] ?? translations[key].en;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            str = str.replaceAll(`{${k}}`, String(v));
        }
    }
    return str;
}
