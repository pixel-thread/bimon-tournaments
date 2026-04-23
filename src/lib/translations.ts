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
} as const;

export type TranslationKey = keyof typeof translations;
