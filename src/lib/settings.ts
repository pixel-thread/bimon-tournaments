import { getRequestPrisma } from "@/lib/database";
import { cache } from "react";

const SETTINGS_KEY = "app_settings";

export interface AppSettings {
    // 💰 Financial (Casual — default mode)
    orgCutMode: "percent" | "fixed"; // Which org cut mode is active
    orgCutPercent: number; // Percentage of prize pool the org takes
    orgCutFixed: number;   // Fixed amount (in currency) the org takes per tournament
    enableFund: boolean;  // When false: no solo/b2b taxes, winners get full prize
    defaultEntryFee: number;
    enableTopUps: boolean;
    nameChangeFee: number;

    // 💰 Financial (Ranked / Squad overrides)
    rankedOrgCutMode: "percent" | "fixed";
    rankedOrgCutPercent: number;
    rankedOrgCutFixed: number;
    rankedEnableFund: boolean;
    rankedDefaultEntryFee: number;

    // 🏆 Royal Pass
    enableElitePass: boolean;
    elitePassPrice: number;
    elitePassOrigPrice: number;
    streakMilestone: number;
    streakRewardAmount: number;

    // 🎯 Referrals
    enableReferrals: boolean;
    referralReward: number;
    referralTournamentsReq: number;

    // 🍀 Lucky Voters
    enableLuckyVoters: boolean;

    // 🎮 Gameplay
    allowedTeamSizes: string;
    maxIGNLength: number;
    defaultPollDays: number;

    // ⚔️ Bracket
    matchDeadlineGroupHours: number;  // Hours to complete a group stage match
    matchDeadlineKOHours: number;     // Hours to complete a KO stage match
    deadlineCutoffTime: string;       // Time (HH:MM IST) all deadlines snap to, e.g. "05:30"
    deadlinePausedDays: number[];     // JS day numbers (0=Sun,1=Mon...) when deadline timers pause

    // 📢 Community
    whatsAppGroups: string[];
    welcomeMessage: string;
    customRules: string;

    // 🛡️ Merit System
    meritBanThreshold: number;
    meritSoloRestrictThreshold: number;

    // 💳 Manual Top-Up (UPI QR)
    upiQrImageUrl: string;
    upiId: string;
    upiPayeeName: string;
    upiWhatsAppNumber: string;

    // 🎮 Game Rewards
    gameRewardEndDate: string; // ISO date string

    // 📺 Social Links
    youtubeChannelUrl: string;

    // 🎁 Welcome Back
    welcomeBackCouponAmount: number; // UC value of welcome-back coupon for returning players
}

export const DEFAULT_SETTINGS: AppSettings = {
    orgCutMode: "fixed",
    orgCutPercent: 0,
    orgCutFixed: 0,
    enableFund: false,
    defaultEntryFee: 30,
    enableTopUps: true,
    nameChangeFee: 1,

    rankedOrgCutMode: "fixed",
    rankedOrgCutPercent: 0,
    rankedOrgCutFixed: 0,
    rankedEnableFund: false,
    rankedDefaultEntryFee: 30,

    enableElitePass: true,
    elitePassPrice: 5,
    elitePassOrigPrice: 20,
    streakMilestone: 8,
    streakRewardAmount: 30,

    enableReferrals: true,
    referralReward: 20,
    referralTournamentsReq: 5,

    enableLuckyVoters: true,

    allowedTeamSizes: "SOLO,DUO,TRIO,SQUAD",
    maxIGNLength: 20,
    defaultPollDays: 3,

    matchDeadlineGroupHours: 48,
    matchDeadlineKOHours: 72,
    deadlineCutoffTime: "05:30",
    deadlinePausedDays: [],

    whatsAppGroups: [],
    welcomeMessage: "",
    customRules: "",

    meritBanThreshold: 0,
    meritSoloRestrictThreshold: 0,

    upiQrImageUrl: "",
    upiId: "",
    upiPayeeName: "",
    upiWhatsAppNumber: "",

    gameRewardEndDate: "",

    youtubeChannelUrl: "",

    welcomeBackCouponAmount: 20,
};

/**
 * Get the current app settings, merged with defaults.
 * Cached per-request.
 */
export const getSettings = cache(async (): Promise<AppSettings> => {
    const db = await getRequestPrisma();
    const row = await db.appConfig.findUnique({
        where: { key: SETTINGS_KEY },
    });

    if (!row) return { ...DEFAULT_SETTINGS };

    try {
        const saved = JSON.parse(row.value);
        return { ...DEFAULT_SETTINGS, ...saved };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
});

/**
 * Save app settings.
 */
export async function saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const db = await getRequestPrisma();
    const current = await getSettings();
    const merged = { ...current, ...settings };

    await db.appConfig.upsert({
        where: { key: SETTINGS_KEY },
        create: { key: SETTINGS_KEY, value: JSON.stringify(merged) },
        update: { value: JSON.stringify(merged) },
    });

    // Sync merit thresholds to dedicated AppConfig keys (read by rate-merit API)
    if (settings.meritBanThreshold !== undefined || settings.meritSoloRestrictThreshold !== undefined) {
        await Promise.all([
            db.appConfig.upsert({
                where: { key: "merit_auto_ban_threshold" },
                create: { key: "merit_auto_ban_threshold", value: String(merged.meritBanThreshold) },
                update: { value: String(merged.meritBanThreshold) },
            }),
            db.appConfig.upsert({
                where: { key: "merit_auto_restrict_threshold" },
                create: { key: "merit_auto_restrict_threshold", value: String(merged.meritSoloRestrictThreshold) },
                update: { value: String(merged.meritSoloRestrictThreshold) },
            }),
        ]);
    }

    return merged;
}
