/**
 * Prize Distribution Utility — BGIS-Style Geometric Decay
 * 
 * Each position gets ~50% of the one above (geometric decay).
 * Last position gets entry fee refund.
 * Any position that would fall below refund is floored to refund.
 * 
 * Rules:
 * 1. Org takes a cut from total pool (fixed or percentage)
 * 2. Fund gets ₹0 from prize pool (fund only accumulates from solo/b2b taxes)
 * 3. Winners get: totalPool - orgFee
 * 4. Last place gets entry fee × team size as refund (tier 2+)
 * 5. Positions are calculated via geometric decay (ratio 0.50)
 * 6. Any position < refund is floored to refund
 * 7. Odd amounts cascade up, remainder goes to 1st or org
 */

// ============================================================================
// Types
// ============================================================================

export type PrizeTierLevel = number;

export interface PrizeTierConfig {
    level: PrizeTierLevel;
    minPool: number;
    maxPool: number | null; // null for unlimited
    winnerCount: number;
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
    /** Human-readable summary like "Top 6 paid: 50% decay + ₹100 refund" */
    summaryText: string;
    /** Short format like "50% decay" */
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
// Tier Configurations — only winnerCount needed, decay handles the rest
// ============================================================================

const TIER_CONFIGS: PrizeTierConfig[] = [
    { level: 1, minPool: 0, maxPool: 1199, winnerCount: 3, description: "Top 3 paid" },
    { level: 2, minPool: 1200, maxPool: 3000, winnerCount: 6, description: "Top 6 paid" },
    { level: 3, minPool: 3001, maxPool: 5000, winnerCount: 8, description: "Top 8 paid" },
    { level: 4, minPool: 5001, maxPool: 10000, winnerCount: 8, description: "Top 8 paid" },
    { level: 5, minPool: 10001, maxPool: 25000, winnerCount: 10, description: "Top 10 paid" },
    { level: 6, minPool: 25001, maxPool: null, winnerCount: 12, description: "Top 12 paid" },
];

// Geometric decay ratio — each position gets this fraction of the one above
const DECAY_RATIO = 0.50;

// Org cut mode type
export type OrgCutMode = "percent" | "fixed";

// Default org cut
const DEFAULT_ORG_CUT = 0;
const DEFAULT_ORG_MODE: OrgCutMode = "fixed";


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
 * Calculate geometric decay prizes.
 * 
 * Algorithm:
 * 1. Last position = refund (entry × teamSize), capped so it doesn't exceed higher positions
 * 2. Remaining pool split geometrically among positions 1 to (n-1)
 * 3. Any position < refund is floored to refund
 * 4. When flooring occurs, recalculate non-floored positions from remaining pool
 * 5. Remainder goes to 1st place
 */
function computeGeometricPrizes(
    winnerPool: number,
    winnerCount: number,
    refundAmount: number,
    hasRefund: boolean,
): Map<number, PositionPrize> {
    const prizes = new Map<number, PositionPrize>();

    if (winnerCount <= 0 || winnerPool <= 0) return prizes;

    // Single winner: gets everything
    if (winnerCount === 1) {
        prizes.set(1, { position: 1, percentage: null, amount: winnerPool, isFixed: false });
        return prizes;
    }

    const r = DECAY_RATIO;

    if (!hasRefund) {
        // Tier 1: No refund, pure geometric split for all positions
        const geoSum = (1 - Math.pow(r, winnerCount)) / (1 - r);
        const a = winnerPool / geoSum;

        let totalAssigned = 0;
        for (let i = 0; i < winnerCount; i++) {
            const amount = Math.floor(a * Math.pow(r, i));
            prizes.set(i + 1, { position: i + 1, percentage: null, amount, isFixed: false });
            totalAssigned += amount;
        }

        // Remainder to 1st
        const rem = winnerPool - totalAssigned;
        if (rem > 0) {
            const first = prizes.get(1)!;
            prizes.set(1, { ...first, amount: first.amount + rem });
        }

        return prizes;
    }

    // Tier 2+: Last position = refund, rest = geometric decay
    const lastPos = winnerCount;
    const geoCount = winnerCount - 1; // positions to compute geometrically

    // Cap refund so it doesn't exceed the winner pool
    const actualRefund = Math.min(refundAmount, winnerPool);

    // Compute geometric on available pool (after reserving refund for last place)
    let availableForGeo = winnerPool - actualRefund;
    const geoSum = (1 - Math.pow(r, geoCount)) / (1 - r);
    let a = availableForGeo / geoSum;

    // Compute raw amounts
    const rawAmounts: number[] = [];
    for (let i = 0; i < geoCount; i++) {
        rawAmounts.push(Math.floor(a * Math.pow(r, i)));
    }

    // Floor: any position < refund gets set to refund
    let flooredCount = 0;
    for (let i = rawAmounts.length - 1; i >= 0; i--) {
        if (rawAmounts[i] < actualRefund) {
            rawAmounts[i] = actualRefund;
            flooredCount++;
        }
    }

    // If flooring occurred, recalculate non-floored positions
    if (flooredCount > 0) {
        const flooredTotal = flooredCount * actualRefund;
        const nonFlooredCount = geoCount - flooredCount;

        if (nonFlooredCount > 0) {
            const availableForNonFloored = availableForGeo - flooredTotal;
            const newGeoSum = (1 - Math.pow(r, nonFlooredCount)) / (1 - r);
            const newA = availableForNonFloored / newGeoSum;

            for (let i = 0; i < nonFlooredCount; i++) {
                rawAmounts[i] = Math.floor(newA * Math.pow(r, i));
            }
        }
    }

    // Set prizes for geometric positions
    let totalAssigned = 0;
    for (let i = 0; i < geoCount; i++) {
        prizes.set(i + 1, {
            position: i + 1,
            percentage: null,
            amount: rawAmounts[i],
            isFixed: false,
        });
        totalAssigned += rawAmounts[i];
    }

    // Last position = refund
    prizes.set(lastPos, {
        position: lastPos,
        percentage: null,
        amount: actualRefund,
        isFixed: true,
    });
    totalAssigned += actualRefund;

    // Remainder to 1st
    const rem = winnerPool - totalAssigned;
    if (rem > 0) {
        const first = prizes.get(1)!;
        prizes.set(1, { ...first, amount: first.amount + rem });
    }

    return prizes;
}

/**
 * Calculate prize distribution based on total prize pool.
 * 
 * Uses BGIS-style geometric decay (50%):
 * - Each position gets half the one above
 * - Last position gets entry fee × team size as refund (tier 2+)
 * - Positions that would drop below refund are floored to refund
 * 
 * @param totalPool - Total prize pool amount
 * @param entryFee - Entry fee per player
 * @param teamSize - Number of players per team (1=solo, 2=duo, 3=trio, 4=squad)
 * @param orgCut - Org cut value (percentage or fixed amount depending on mode)
 * @param orgCutMode - "percent" or "fixed" (default: "fixed")
 * @returns Complete prize distribution breakdown
 */
export function getPrizeDistribution(
    totalPool: number,
    entryFee: number = 50,
    teamSize: number = 2,
    orgCut: number = DEFAULT_ORG_CUT,
    orgCutMode: OrgCutMode = DEFAULT_ORG_MODE,
): PrizeDistributionResult {
    // Find the applicable tier
    const tier = TIER_CONFIGS.find(
        (t) => totalPool >= t.minPool && (t.maxPool === null || totalPool <= t.maxPool)
    ) || TIER_CONFIGS[0]; // Fallback to tier 1

    // Compute org fee based on mode
    const orgFee = orgCutMode === "percent"
        ? Math.floor(totalPool * (orgCut / 100))
        : Math.min(orgCut, totalPool);
    const fundAmount = 0;

    // Winner pool = totalPool - org
    const winnerPool = totalPool - orgFee;

    // Refund for last position (tier 2+)
    const hasRefund = tier.level >= 2;
    const teamRefund = entryFee * teamSize;
    const refundAmount = hasRefund ? Math.min(teamRefund, winnerPool) : 0;

    // Compute geometric prizes
    const prizes = computeGeometricPrizes(winnerPool, tier.winnerCount, refundAmount, hasRefund);

    // Make all amounts even (cascade remainders upward)
    const positions = Array.from(prizes.keys()).sort((a, b) => b - a);
    let carryOver = 0;

    for (const position of positions) {
        const prize = prizes.get(position)!;
        const adjustedAmount = prize.amount + carryOver;
        const { evenAmount, remainder } = makeEven(adjustedAmount);
        prizes.set(position, { ...prize, amount: evenAmount });
        carryOver = remainder;
    }

    // Remaining from rounding: goes to org if org > 0, otherwise to 1st
    let adjustedOrgFee = orgFee;
    if (orgCut > 0) {
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
    if (orgCut > 0) {
        adjustedOrgFee += remainder;
    } else if (remainder > 0) {
        const first = prizes.get(1);
        if (first) {
            prizes.set(1, { ...first, amount: first.amount + remainder });
            totalWinnerPayout += remainder;
        }
    }

    // Generate summary texts
    const actualRefund = hasRefund ? (prizes.get(tier.winnerCount)?.amount ?? 0) : 0;
    const decayPct = Math.round(DECAY_RATIO * 100);
    const splitText = `${decayPct}% decay`;
    const summaryText = hasRefund
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
 * 1. Org gets a fixed/percent cut from totalPool (always, unaffected by UC exempt)
 * 2. Fund = ₹0 from prize pool (fund only gets solo/b2b taxes)
 * 3. UC-exempt cost reduces winners' payouts, NOT org
 * 
 * @param totalPool - Total prize pool amount (includes UC-exempt as if they paid)
 * @param entryFee - Entry fee per player
 * @param teamSize - Number of players per team
 * @param ucExemptCount - Number of UC-exempt players
 * @param orgCut - Org cut value (percentage or fixed amount depending on mode)
 * @param orgCutMode - "percent" or "fixed" (default: "fixed")
 * @returns Final distribution with adjusted amounts
 */
export function getFinalDistribution(
    totalPool: number,
    entryFee: number,
    teamSize: number,
    ucExemptCount: number,
    orgCut: number = DEFAULT_ORG_CUT,
    orgCutMode: OrgCutMode = DEFAULT_ORG_MODE,
): FinalDistributionResult {
    // UC exempt cost reduces the effective pool for winners
    const ucExemptCost = ucExemptCount * entryFee;

    // Compute org fee based on mode
    const orgFee = orgCutMode === "percent"
        ? Math.floor(totalPool * (orgCut / 100))
        : Math.min(orgCut, totalPool);
    const effectiveWinnerPool = totalPool - orgFee - ucExemptCost;

    // Get base distribution using the effective pool for winner calculations
    const base = getPrizeDistribution(totalPool, entryFee, teamSize, orgCut, orgCutMode);

    // If there are UC exempt players, recalculate winners from reduced pool
    if (ucExemptCount > 0 && effectiveWinnerPool < base.totalWinnerPayout) {
        // Recalculate with reduced pool: orgFee stays same, winners shrink
        const adjustedPool = totalPool - ucExemptCost;
        const recalc = getPrizeDistribution(adjustedPool, entryFee, teamSize, orgCut, orgCutMode);

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
    entryFee: number = 200
): number {
    const distribution = getPrizeDistribution(totalPool, entryFee);
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
