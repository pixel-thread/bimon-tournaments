/**
 * Game Configuration — single source of truth for game-specific strings.
 * Everything that differs between BGMI, Free Fire, and PES lives here.
 *
 * To add a new game:
 *   1. Add entry to GameMode union type
 *   2. Add config object to GAME_CONFIGS
 *   3. Add domain mapping in proxy.ts DOMAIN_GAME_MAP
 *   4. Add DATABASE_URL_<GAME> env var in Vercel
 *   5. Add domain to Vercel project settings
 *   6. Create Supabase DB & push schema
 *   That's it — all UI adapts automatically via feature flags.
 *
 * Usage: import { GAME } from "@/lib/game-config";
 *        then use GAME.currency, GAME.passName, GAME.features.hasTeamSizes, etc.
 */

export type GameMode = "bgmi" | "freefire" | "pes" | "mlbb";

/** Feature flags — control which UI sections & features are enabled per game */
interface GameFeatures {
    hasTeamSizes: boolean;       // BR team composition (SOLO/DUO/TRIO/SQUAD)
    hasLuckyVoters: boolean;     // Random voter reward system
    hasRoyalPass: boolean;       // Premium pass + streak rewards
    hasMerit: boolean;           // Merit rating system
    hasReferrals: boolean;       // Referral reward program
    hasTopUps: boolean;          // In-app currency purchases
    hasBracket: boolean;         // 1v1 bracket tournaments (knockout)
    hasBR: boolean;              // Battle Royale tournaments
    hasLeague: boolean;          // Round-robin league format
    hasGroupKnockout: boolean;   // Group stage → knockout (World Cup style)
    hasMultiEntry: boolean;      // Allow multiple bracket entries per player (PES only)
    hasSquads: boolean;          // Player-created premade squads
    hasRankedCasual: boolean;    // Separate Ranked (squad) vs Casual (random) leaderboards
    hasClans: boolean;           // Clan/guild system
    hasTDM: boolean;             // TDM bracket tournaments (4v4/8v8 kill-based)
    hasWoW: boolean;             // World of Wonder creative/custom map tournaments
    usesCentralWallet?: never;  // REMOVED — all games use local wallet now
}

interface GameConfig {
    mode: GameMode;
    name: string;                // App/brand name
    fullName: string;            // Full display name
    gameName: string;            // Actual game name
    currency: string;            // "UC" or "Diamonds" or "Coins"
    currencyLabel: string;       // Compact inline label
    currencyEmoji: string;       // Emoji for currency
    currencyIconPath?: string;   // Optional PNG path (overrides emoji in UI)
    currencyPlural: string;      // Plural form
    passName: string;            // "Royal Pass" or "Elite Pass"
    passEmoji: string;           // "👑"
    idLabel: string;             // "BGMI ID" or "PES ID"
    idPlaceholder: string;       // e.g. "Your BGMI ID (numeric)"
    hasUID: boolean;             // Whether to show UID field in onboarding
    ignLabel: string;            // UI label for display name: "Game Name" or "Team Name"
    pasteOnlyIGN: boolean;       // Whether game name must be pasted (BGMI) or can be typed (PES/FF)
    locale: "kha" | "en";        // UI language: "kha" = Khasi, "en" = English
    scoringSystem: string;       // "bgmi" | "ffws" | "bracket"
    booyahBonus: boolean;        // FFWS/Booyah bonus points
    defaultTournamentType: string; // "BR" | "BRACKET_1V1" | "LEAGUE" | "GROUP_KNOCKOUT"
    tournamentTypes: string[];   // All supported types for this game
    hasBracket: boolean;         // Whether this game supports bracket tournaments
    disputeWindowMinutes: number; // Minutes opponent has to confirm/dispute a submitted result
    hasBR: boolean;              // Whether this game supports BR tournaments.
    squadSize: number;           // Number of players per squad (5 for MLBB, 4 for BGMI/FF)
    maxSquadSize: number;        // Max roster size including subs (squadSize + 2 for BR games)
    maxSquadTeams: number;       // Max squads per match (64 players / squadSize for BR)
    tdmTeamSizes: number[];      // Supported TDM team sizes (e.g. [4, 8] for 4v4/8v8)
    // Dual currency (MLBB: BP for entry + Diamond for rewards)
    hasDualCurrency: boolean;
    entryCurrency?: string;           // e.g. "BP" — currency used for entry fees & transfers
    entryCurrencyLabel?: string;      // "Battle Point"
    entryCurrencyEmoji?: string;      // "⚔️"
    entryCurrencyPlural?: string;     // "BP"
    rewardCurrency?: string;          // e.g. "Diamond" — reward-only currency
    rewardCurrencyEmoji?: string;     // "💎"
    rewardCurrencyPlural?: string;    // "Diamonds"
    // Exchange rates for cross-game transfers
    // exchangeRateIn:  multiplier when RECEIVING transfers (e.g. 0.9 = get 90% of sent amount)
    // exchangeRateOut: multiplier when SENDING transfers (e.g. 0.9 = send 90% of your amount)
    // Both default to 1.0 (no conversion). For MLBB: in=0.9, out=0.9 → 50 UC→45 BP, 50 BP→45 UC
    exchangeRateIn?: number;
    exchangeRateOut?: number;
    // Clan / Guild
    clanLabel: string;             // "Clan" or "Guild"
    clanLabelPlural: string;       // "Clans" or "Guilds"
    // Feature flags
    features: GameFeatures;
}

export const GAME_CONFIGS: Record<GameMode, GameConfig> = {
    bgmi: {
        mode: "bgmi",
        name: "PUBGMI",
        fullName: "PUBG Mobile India Tournament Platform",
        gameName: "BGMI",
        currency: "UC",
        currencyLabel: "UC",
        currencyEmoji: "💰",
        currencyIconPath: "",
        currencyPlural: "UC",
        passName: "Royal Pass",
        passEmoji: "👑",
        idLabel: "BGMI ID",
        idPlaceholder: "Your BGMI character ID",
        hasUID: false,
        ignLabel: "Game Name",
        pasteOnlyIGN: false,         // Allow typing — paste-only confused players
        locale: "en",
        scoringSystem: "bgmi",
        booyahBonus: false,
        defaultTournamentType: "BR",
        tournamentTypes: ["BR", "TDM", "WOW"],
        hasBracket: false,
        hasBR: true,
        disputeWindowMinutes: 30,
        squadSize: 4,
        maxSquadSize: 6,           // 4 active + 2 subs
        maxSquadTeams: 16,         // 64 players / 4 = 16 squads max
        tdmTeamSizes: [4, 8],      // 4v4 and 8v8 TDM
        hasDualCurrency: false,
        clanLabel: "Clan",
        clanLabelPlural: "Clans",
        features: {
            hasTeamSizes: true,
            hasLuckyVoters: true,
            hasRoyalPass: true,
            hasMerit: true,
            hasReferrals: true,
            hasTopUps: false,            // Razorpay disabled — using manual UPI QR flow
            hasBracket: false,
            hasBR: true,
            hasLeague: false,
            hasGroupKnockout: false,
            hasMultiEntry: false,
            hasSquads: true,           // Per-poll toggle — admin decides per tournament
            hasRankedCasual: true,     // Ranked/Casual tabs on players page
            hasClans: true,
            hasTDM: true,              // TDM bracket tournaments enabled
            hasWoW: true,              // World of Wonder tournaments enabled
        },
    },
    freefire: {
        mode: "freefire",
        name: "BOOYAH",
        fullName: "Free Fire Tournament Platform",
        gameName: "Free Fire",
        currency: "Diamond",
        currencyLabel: "Diamond",
        currencyEmoji: "💎",
        currencyIconPath: "/images/diamond.svg",
        currencyPlural: "Diamonds",
        passName: "Elite Pass",
        passEmoji: "👑",
        idLabel: "Free Fire UID",
        idPlaceholder: "Your Free Fire UID (numeric)",
        hasUID: true,
        ignLabel: "Game Name",
        pasteOnlyIGN: false,         // FF players can type their name
        locale: "en",
        scoringSystem: "ffws",
        booyahBonus: true,
        defaultTournamentType: "BR",
        tournamentTypes: ["BR"],
        hasBracket: false,
        hasBR: true,
        disputeWindowMinutes: 30,
        squadSize: 4,
        maxSquadSize: 6,           // 4 active + 2 subs
        maxSquadTeams: 16,         // 64 players / 4 = 16 squads max
        tdmTeamSizes: [],          // No TDM for Free Fire (yet)
        hasDualCurrency: false,
        clanLabel: "Guild",
        clanLabelPlural: "Guilds",
        features: {
            hasTeamSizes: true,
            hasLuckyVoters: true,
            hasRoyalPass: true,
            hasMerit: true,
            hasReferrals: true,
            hasTopUps: false,            // Razorpay not configured for Free Fire yet
            hasBracket: false,
            hasBR: true,
            hasLeague: false,
            hasGroupKnockout: false,
            hasMultiEntry: false,
            hasSquads: false,
            hasRankedCasual: false,
            hasClans: true,
            hasTDM: false,
            hasWoW: false,
        },
    },
    pes: {
        mode: "pes",
        name: "KICKOFF",
        fullName: "eFootball Tournament Platform",
        gameName: "eFootball (PES)",
        currency: "B-Coin",
        currencyLabel: "B-Coin",
        currencyEmoji: "🪙",
        currencyIconPath: "/images/coin.png",
        currencyPlural: "B-Coins",
        passName: "Season Pass",
        passEmoji: "⚽",
        idLabel: "eFootball ID",
        idPlaceholder: "Your eFootball / Konami ID",
        hasUID: false,
        ignLabel: "Team Name",
        pasteOnlyIGN: false,         // PES players can type any name
        locale: "en",
        scoringSystem: "bracket",
        booyahBonus: false,
        defaultTournamentType: "GROUP_KNOCKOUT",
        tournamentTypes: ["BRACKET_1V1", "LEAGUE", "GROUP_KNOCKOUT"],
        hasBracket: true,
        hasBR: false,
        disputeWindowMinutes: 30,
        squadSize: 1,
        maxSquadSize: 1,           // 1v1, no subs
        maxSquadTeams: 64,         // No practical limit for 1v1
        tdmTeamSizes: [],          // No TDM for PES
        hasDualCurrency: false,
        clanLabel: "Clan",
        clanLabelPlural: "Clans",
        features: {
            hasTeamSizes: false,       // PES is 1v1 only
            hasLuckyVoters: true,       // Lucky voter draws work for any tournament
            hasRoyalPass: false,        // No pass system for PES
            hasMerit: false,            // No merit rating for 1v1
            hasReferrals: true,         // Referrals still make sense
            hasTopUps: false,            // Razorpay not configured for Free Fire yet
            hasBracket: true,
            hasBR: false,
            hasLeague: true,            // Round-robin league
            hasGroupKnockout: true,     // Group → Knockout (World Cup)
            hasMultiEntry: true,        // PES players can enter multiple times
            hasSquads: false,
            hasRankedCasual: false,
            hasClans: true,
            hasTDM: false,
            hasWoW: false,
        },
    },
    mlbb: {
        mode: "mlbb",
        name: "Mobai Legend",
        fullName: "Mobile Legends Tournament Platform",
        gameName: "Mobile Legends",
        currency: "Diamond",
        currencyLabel: "Diamond",
        currencyEmoji: "💎",
        currencyIconPath: "/images/diamond.svg",
        currencyPlural: "Diamonds",
        passName: "Season Pass",
        passEmoji: "🎮",
        idLabel: "MLBB ID",
        idPlaceholder: "Your Mobile Legends User ID",
        hasUID: true,
        ignLabel: "Game Name",
        pasteOnlyIGN: false,
        locale: "en",
        scoringSystem: "bracket",
        booyahBonus: false,
        defaultTournamentType: "BRACKET_1V1",
        tournamentTypes: ["BRACKET_1V1", "GROUP_KNOCKOUT"],
        hasBracket: true,
        hasBR: false,
        disputeWindowMinutes: 30,
        squadSize: 5,              // MLBB is 5v5
        maxSquadSize: 7,           // 5 active + 2 subs
        maxSquadTeams: 16,         // Cap at 16 squads per match
        tdmTeamSizes: [],          // No TDM for MLBB
        hasDualCurrency: true,
        entryCurrency: "BP",
        entryCurrencyLabel: "Battle Point",
        entryCurrencyEmoji: "⚔️",
        entryCurrencyPlural: "BP",
        rewardCurrency: "Diamond",
        rewardCurrencyEmoji: "💎",
        rewardCurrencyPlural: "Diamonds",
        exchangeRateIn: 0.9,           // 50 UC → 45 BP (UC is worth more than BP)
        exchangeRateOut: 1 / 0.9,      // 45 BP → 50 UC (inverse — round-trip is neutral)
        clanLabel: "Clan",
        clanLabelPlural: "Clans",
        features: {
            hasTeamSizes: false,
            hasLuckyVoters: true,
            hasRoyalPass: false,
            hasMerit: false,
            hasReferrals: true,
            hasTopUps: false,
            hasBracket: true,
            hasBR: false,
            hasLeague: false,
            hasGroupKnockout: true,
            hasMultiEntry: false,
            hasSquads: true,           // Squad feature enabled for MLBB
            hasRankedCasual: false,
            hasClans: true,
            hasTDM: false,
            hasWoW: false,
        },
    },
};

/**
 * Current game config — reads game mode at runtime.
 *
 * Priority:
 *   1. Cookie "game-mode" (set by proxy.ts from domain detection)
 *   2. Env var NEXT_PUBLIC_GAME_MODE (local dev fallback)
 *   3. Default "bgmi"
 *
 * This allows a single deployment to serve all games via domain detection.
 */
function resolveGameMode(): GameMode {
    // Client-side: read from cookie (set by proxy)
    if (typeof window !== "undefined") {
        const match = document.cookie.match(/(?:^|;\s*)game-mode=(\w+)/);
        if (match && match[1] in GAME_CONFIGS) return match[1] as GameMode;
    }

    // Server-side: try to read from headers (set by proxy)
    // Note: headers() is async in Next.js 16, so we use the env fallback for module-level usage
    // API routes and server components should use getGameConfig() for dynamic detection

    // Fallback: env var (for local dev and build time)
    const envMode = process.env.NEXT_PUBLIC_GAME_MODE as GameMode;
    if (envMode && envMode in GAME_CONFIGS) return envMode;

    return "bgmi";
}

export const GAME_MODE: GameMode = resolveGameMode();
export const GAME: GameConfig = GAME_CONFIGS[GAME_MODE];

/**
 * For server-side dynamic detection in API routes:
 *   import { getGameConfig } from "@/lib/game-config";
 *   const { GAME, GAME_MODE } = getGameConfig(request);
 */
export function getGameConfig(request?: Request) {
    const gameMode = (request?.headers.get("x-game-mode") as GameMode) || GAME_MODE;
    return {
        GAME_MODE: gameMode,
        GAME: GAME_CONFIGS[gameMode] || GAME_CONFIGS.bgmi,
    };
}


