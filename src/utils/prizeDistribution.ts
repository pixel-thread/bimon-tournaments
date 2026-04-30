/**
 * Prize Distribution Utility
 * 
 * Dynamic prize distribution based on "Money Milestones" - the total prize pool.
 * Tier thresholds determine the number of winners and distribution percentages.
 * 
 * Rules:
 * 1. Org takes orgPercent% of total pool (from settings)
 * 2. Fund gets ₹0 from prize pool (fund only accumulates from solo/b2b taxes)
 * 3. UC-exempt cost is deducted from prize pool (reduces winners, NOT org)
 * 4. Winners get: totalPool - org - ucExemptCost
 * 5. Odd prize amounts cascade up (lower positions → higher, finally 1st → org)
 */

// ============================================================================
// Types
// ============================================================================

export type PrizeTierLevel = 1 | 2 | 3 | 4;

export interface PrizeTierConfig {
    level: PrizeTierLevel;
    minPool: number;
    maxPool: number | null; // null for unlimited
    orgFeePercent: number;
    fundPercent: number; // legacy, kept for type compat but not used in calculations
    winnerCount: number;
    /** Percentages for positions 1, 2, 3, etc. */
    percentages: number[];
    description: string;
}

export interface PositionPrize {
    position: number;
    percentage: number | null; // null for fixed amounts
    amount: number;
    isFixed: boolean;
}

export interface PrizeDistributionResult {
    tier: PrizeTierConfig;
    totalPool: number;
    orgFee: number;
    fundAmount: number; // Always 0 — fund only gets taxes
    totalWinnerPayout: number;
    prizes: Map<number, PositionPrize>;
    /** Human-readable summary like "Top 3 paid: 50%/25%/15%" */
    summaryText: string;
    /** Short format like "50/25/15" */
    splitText: string;
    /** Refund amount for last place */
    refundAmount: number;
}

export interface FinalDistributionResult extends PrizeDistributionResult {
    /** Org amount (always orgPercent% of pool, unaffected by UC exempt) */
    finalOrgAmount: number;
    /** Fund amount — always 0 from prize pool */
    finalFundAmount: number;
    /** UC-exempt cost deducted from winners */
    ucExemptCost: number;
}

// ============================================================================
// Tier Configurations
// ============================================================================

const TIER_CONFIGS: PrizeTierConfig[] = [
    {
        level: 1,
        minPool: 0,
        maxPool: 1199,
        orgFeePercent: 0,
        fundPercent: 0,
        winnerCount: 2,
        percentages: [57, 29],
        description: "Top 2 paid",
    },
    {
        level: 2,
        minPool: 1200,
        maxPool: 3000,
        orgFeePercent: 0,
        fundPercent: 0,
        winnerCount: 3,
        percentages: [62, 33],
        description: "Top 3 paid",
    },
    {
        level: 3,
        minPool: 3001,
        maxPool: 5000,
        orgFeePercent: 0,
        fundPercent: 0,
        winnerCount: 4,
        percentages: [52, 28, 14],
        description: "Top 4 paid",
    },
    {
        level: 4,
        minPool: 5001,
        maxPool: null,
        orgFeePercent: 0,
        fundPercent: 0,
        winnerCount: 5,
        percentages: [38, 26, 19, 12],
        description: "Top 5 paid",
    },
];

// Default org percentage
const DEFAULT_ORG_PERCENT = 0;


/**
 * Convert TeamType to team size number.
 */
export function getTeamSize(teamType: string): number {
    const sizes: Record<string, number> = {
        SOLO: 1,
        DUO: 2,
        TRIO: 3,
        SQUAD: 4,
        DYNAMIC: 2, // Default fallback; actual size determined at team creation
    };
    return sizes[teamType] || 2; // Default to duo
}

/**
 * Make a number even by rounding down.
 * Returns the amount to add to the next higher position.
 */
function makeEven(amount: number): { evenAmount: number; remainder: number } {
    const remainder = amount % 2;
    return {
        evenAmount: amount - remainder,
        remainder,
    };
}

/**
 * Calculate prize distribution based on total prize pool.
 * 
 * - Org takes orgPercent% of total pool
 * - Fund = ₹0 (fund only gets taxes, not from prize pool)
 * - Winners get totalPool - orgFee
 * - For Tiers 2-4, last position gets entry fee × team size as refund
 * 
 * @param totalPool - Total prize pool amount
 * @param entryFee - Entry fee per player
 * @param teamSize - Number of players per team (1=solo, 2=duo, 3=trio, 4=squad)
 * @param orgPercent - Org cut percentage (from settings, default 10%)
 * @returns Complete prize distribution breakdown
 */
export function getPrizeDistribution(
    totalPool: number,
    entryFee: number = 50,
    teamSize: number = 2,
    orgPercent: number = DEFAULT_ORG_PERCENT,
): PrizeDistributionResult {
    // Find the applicable tier
    const tier = TIER_CONFIGS.find(
        (t) => totalPool >= t.minPool && (t.maxPool === null || totalPool <= t.maxPool)
    ) || TIER_CONFIGS[0]; // Fallback to tier 1

    // Org takes its cut, fund = 0
    const orgFee = Math.floor(totalPool * (orgPercent / 100));
    const fundAmount = 0;
    const prizes = new Map<number, PositionPrize>();

    // Winner pool = totalPool - org (no fund deduction)
    const winnerPool = totalPool - orgFee;

    if (tier.level >= 2) {
        // Tiers 2-4: Last position gets entry fee × team size as refund
        const lastPosition = tier.winnerCount;
        const teamRefund = entryFee * teamSize;
        let refundAmount = Math.min(teamRefund, winnerPool);
        const totalPct = tier.percentages.reduce((s, p) => s + p, 0);

        // Calculate what the 2nd-to-last position would get if we use the full refund
        // to ensure last place never exceeds any higher position
        const secondToLastPct = tier.percentages[tier.percentages.length - 1];
        const testRemaining = winnerPool - refundAmount;
        const secondToLastAmount = Math.floor(testRemaining * (secondToLastPct / totalPct));

        // Cap refund if it would exceed the 2nd-to-last position
        if (refundAmount > secondToLastAmount && secondToLastAmount > 0) {
            refundAmount = Math.floor(winnerPool * secondToLastPct / (totalPct + secondToLastPct));
        }

        const remainingForWinners = winnerPool - refundAmount;

        // Distribute by relative percentage to all positions except last
        tier.percentages.forEach((percent, idx) => {
            const position = idx + 1;
            const amount = Math.floor(remainingForWinners * (percent / totalPct));
            prizes.set(position, {
                position,
                percentage: percent,
                amount,
                isFixed: false,
            });
        });

        // Add last place with fixed refund
        prizes.set(lastPosition, {
            position: lastPosition,
            percentage: null,
            amount: Math.floor(refundAmount),
            isFixed: true,
        });
    } else {
        // Tier 1: Split winner pool by relative percentages
        const totalPct = tier.percentages.reduce((s, p) => s + p, 0);

        tier.percentages.forEach((percent, idx) => {
            const position = idx + 1;
            const amount = Math.floor(winnerPool * (percent / totalPct));
            prizes.set(position, {
                position,
                percentage: percent,
                amount,
                isFixed: false,
            });
        });
    }

    // Cascade odd amounts: lower positions → higher, finally 1st
    const positions = Array.from(prizes.keys()).sort((a, b) => b - a);
    let carryOver = 0;

    for (const position of positions) {
        const prize = prizes.get(position)!;
        const adjustedAmount = prize.amount + carryOver;
        const { evenAmount, remainder } = makeEven(adjustedAmount);

        prizes.set(position, {
            ...prize,
            amount: evenAmount,
        });

        carryOver = remainder;
    }

    // Any remaining from rounding: goes to org if org > 0, otherwise to 1st place
    let adjustedOrgFee = orgFee;
    if (orgPercent > 0) {
        adjustedOrgFee += carryOver;
    } else {
        const first = prizes.get(1);
        if (first) {
            prizes.set(1, { ...first, amount: first.amount + carryOver });
        }
    }

    // Calculate total winner payout
    let totalWinnerPayout = 0;
    prizes.forEach((prize) => {
        totalWinnerPayout += prize.amount;
    });

    // Ensure total adds up exactly
    const totalDistributed = adjustedOrgFee + fundAmount + totalWinnerPayout;
    const remainder = totalPool - totalDistributed;
    if (orgPercent > 0) {
        adjustedOrgFee += remainder;
    } else if (remainder > 0) {
        const first = prizes.get(1);
        if (first) {
            prizes.set(1, { ...first, amount: first.amount + remainder });
            totalWinnerPayout += remainder;
        }
    }

    // Generate summary texts
    const teamRefund = entryFee * teamSize;
    const actualRefund = tier.level >= 2 ? Math.min(teamRefund, winnerPool) : 0;
    const splitText = tier.percentages.join("/");
    const summaryText = tier.level >= 2
        ? `${tier.description}: ${splitText} + ₹${actualRefund} refund`
        : `${tier.description}: ${splitText}`;

    return {
        tier,
        totalPool,
        orgFee: adjustedOrgFee,
        fundAmount,
        totalWinnerPayout,
        prizes,
        summaryText,
        splitText,
        refundAmount: actualRefund,
    };
}

/**
 * Calculate final distribution with UC-exempt cost.
 * 
 * Rules:
 * 1. Org gets orgPercent% of totalPool (always, unaffected by UC exempt)
 * 2. Fund = ₹0 from prize pool (fund only gets solo/b2b taxes)
 * 3. UC-exempt cost reduces winners' payouts, NOT org
 * 
 * @param totalPool - Total prize pool amount (includes UC-exempt as if they paid)
 * @param entryFee - Entry fee per player
 * @param teamSize - Number of players per team
 * @param ucExemptCount - Number of UC-exempt players
 * @param orgPercent - Org cut percentage (from settings)
 * @returns Final distribution with adjusted amounts
 */
export function getFinalDistribution(
    totalPool: number,
    entryFee: number,
    teamSize: number,
    ucExemptCount: number,
    orgPercent: number = DEFAULT_ORG_PERCENT,
): FinalDistributionResult {
    // UC exempt cost reduces the effective pool for winners
    const ucExemptCost = ucExemptCount * entryFee;

    // Calculate distribution on the effective pool (totalPool - ucExemptCost)
    // but org still takes % of the FULL totalPool
    const orgFee = Math.floor(totalPool * (orgPercent / 100));
    const effectiveWinnerPool = totalPool - orgFee - ucExemptCost;

    // Get base distribution using the effective pool for winner calculations
    const base = getPrizeDistribution(totalPool, entryFee, teamSize, orgPercent);

    // If there are UC exempt players, recalculate winners from reduced pool
    if (ucExemptCount > 0 && effectiveWinnerPool < base.totalWinnerPayout) {
        // Recalculate with reduced pool: orgFee stays same, winners shrink
        const adjustedPool = totalPool - ucExemptCost;
        const recalc = getPrizeDistribution(adjustedPool, entryFee, teamSize, orgPercent);

        return {
            ...recalc,
            totalPool, // Show original total pool
            orgFee: recalc.orgFee,
            finalOrgAmount: recalc.orgFee,
            finalFundAmount: 0,
            ucExemptCost,
        };
    }

    return {
        ...base,
        finalOrgAmount: base.orgFee,
        finalFundAmount: 0,
        ucExemptCost,
    };
}

/**
 * Get prize amount for a specific position.
 * Returns 0 if the position doesn't receive a prize in the current tier.
 */
export function getPrizeForPosition(
    totalPool: number,
    position: number,
    fifthPlaceRefund: number = 200
): number {
    const distribution = getPrizeDistribution(totalPool, fifthPlaceRefund);
    return distribution.prizes.get(position)?.amount ?? 0;
}

/**
 * Get all prize positions that will be paid out for a given prize pool.
 */
export function getPaidPositions(totalPool: number): number[] {
    const distribution = getPrizeDistribution(totalPool);
    return Array.from(distribution.prizes.keys()).sort((a, b) => a - b);
}

/**
 * Get tier info without calculating full distribution (lightweight check).
 */
export function getTierInfo(totalPool: number): PrizeTierConfig {
    return TIER_CONFIGS.find(
        (t) => totalPool >= t.minPool && (t.maxPool === null || totalPool <= t.maxPool)
    ) || TIER_CONFIGS[0];
}
