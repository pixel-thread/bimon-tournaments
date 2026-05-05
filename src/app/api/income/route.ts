import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { NextRequest } from "next/server";

/**
 * GET /api/income?seasonId=xxx  OR  ?seasonId=all
 * Fetches income records + org deductions for a specific season or all seasons (BGMI).
 */
export async function GET(request: NextRequest) {
    try {
        const userId = await getAuthEmail();
        if (!userId) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        const user = await prisma.user.findFirst({
            where: userWhereEmail(userId),
            select: { role: true },
        });

        if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
            return ErrorResponse({ message: "Forbidden", status: 403 });
        }

        // Get seasonId from query params
        const { searchParams } = new URL(request.url);
        let seasonId = searchParams.get("seasonId");
        const isAllSeasons = seasonId === "all";

        // Default to latest season if not "all"
        if (!seasonId) {
            const latest = await prisma.season.findFirst({
                orderBy: { createdAt: "desc" },
                select: { id: true },
            });
            seasonId = latest?.id ?? null;
        }

        if (!seasonId && !isAllSeasons) {
            return SuccessResponse({
                data: { records: [], expenses: [], summary: { totalOrgIncome: 0, totalDeductions: 0, netProfit: 0, deductions: [], totalExpenses: 0 } },
            });
        }

        // Determine which seasons to include
        let seasonIds: string[] = [];
        let seasonStart: Date;
        let seasonEnd: Date;

        if (isAllSeasons) {
            // Fetch all seasons
            const allSeasons = await prisma.season.findMany({
                orderBy: { createdAt: "asc" },
                select: { id: true, startDate: true, endDate: true },
            });
            seasonIds = allSeasons.map((s) => s.id);
            seasonStart = allSeasons.length > 0 ? allSeasons[0].startDate : new Date(0);
            seasonEnd = allSeasons.length > 0 ? allSeasons[allSeasons.length - 1].endDate ?? new Date() : new Date();
        } else {
            seasonIds = [seasonId!];
            const season = await prisma.season.findUnique({
                where: { id: seasonId! },
                select: { startDate: true, endDate: true },
            });
            seasonStart = season?.startDate ?? new Date(0);
            seasonEnd = season?.endDate ?? new Date();
        }

        // Get tournaments for these seasons
        const tournaments = await prisma.tournament.findMany({
            where: { seasonId: { in: seasonIds } },
            select: { id: true, name: true, fee: true },
        });
        const tournamentIds = tournaments.map((t) => t.id);

        // Income records for these tournaments
        const income = await prisma.income.findMany({
            where: {
                isSubIncome: false,
                isExpense: false,
                tournamentId: { in: tournamentIds },
                description: { startsWith: "Org" },
            },
            include: {
                children: {
                    select: { id: true, amount: true, description: true },
                    orderBy: { createdAt: "asc" },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const records = income.map((i) => ({
            id: i.id,
            amount: i.amount,
            description: i.description,
            tournamentName: i.tournamentName,
            isSubIncome: i.isSubIncome,
            createdAt: i.createdAt,
            children: i.children,
        }));

        // Manual expenses
        const expenses = await prisma.income.findMany({
            where: {
                isExpense: true,
                createdAt: { gte: seasonStart, lte: seasonEnd },
            },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                amount: true,
                description: true,
                createdAt: true,
            },
        });
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

        // Total org income (only "Org" records)
        const totalOrgIncome = records
            .filter((r) => r.description.toLowerCase().startsWith("org"))
            .reduce((sum, r) => sum + r.amount, 0);

        // Deductions from CREDIT transactions scoped to date range
        const seasonCredits = await prisma.transaction.findMany({
            where: {
                type: "CREDIT",
                createdAt: { gte: seasonStart, lte: seasonEnd },
                amount: { lte: 10000 }, // exclude obviously test transactions
            },
            select: { amount: true, description: true, playerId: true },
        });

        const deductions: { category: string; total: number; count: number }[] = [];

        // RP Rewards (streak)
        const streakRewards = await prisma.pendingReward.findMany({
            where: {
                type: "STREAK",
                isClaimed: true,
                createdAt: { gte: seasonStart, lte: seasonEnd },
            },
            select: { amount: true },
        });
        const rpRewardTotal = streakRewards.reduce((sum, r) => sum + r.amount, 0);
        const rpRewardCount = streakRewards.length;
        if (rpRewardTotal > 0) deductions.push({ category: "RP Rewards", total: rpRewardTotal, count: rpRewardCount });

        // Promotions
        let promoTotal = 0, promoCount = 0;
        for (const tx of seasonCredits) {
            const d = tx.description.toLowerCase();
            if (d.includes("promo") && !d.includes("razorpay")) {
                promoTotal += tx.amount;
                promoCount++;
            }
        }
        if (promoTotal > 0) deductions.push({ category: "Promotions", total: promoTotal, count: promoCount });

        // Referral Bonus
        let refTotal = 0, refCount = 0;
        for (const tx of seasonCredits) {
            const d = tx.description.toLowerCase();
            if (d.includes("referral") || d.includes("refer")) {
                refTotal += tx.amount;
                refCount++;
            }
        }
        if (refTotal > 0) deductions.push({ category: "Referral Bonus", total: refTotal, count: refCount });

        // Bonus (exclude streak — already counted as RP Rewards, and exclude referral)
        let bonusTotal = 0, bonusCount = 0;
        for (const tx of seasonCredits) {
            const d = tx.description.toLowerCase();
            if (d.includes("bonus") && !d.includes("referral") && !d.includes("refer") && !d.includes("streak")) {
                bonusTotal += tx.amount;
                bonusCount++;
            }
        }
        if (bonusTotal > 0) deductions.push({ category: "Bonus", total: bonusTotal, count: bonusCount });

        // Lucky Voters for these seasons
        const luckyPolls = await prisma.poll.findMany({
            where: {
                luckyVoterId: { not: null },
                tournamentId: { in: tournamentIds },
            },
            select: { tournament: { select: { fee: true } } },
        });
        const luckyTotal = luckyPolls.reduce((sum, p) => sum + (p.tournament?.fee ?? 0), 0);
        if (luckyTotal > 0) deductions.push({ category: "Lucky Voters", total: luckyTotal, count: luckyPolls.length });

        // Game Rewards (Memory Game + Number Rush prizes)
        let gameRewardTotal = 0, gameRewardCount = 0;
        for (const tx of seasonCredits) {
            const d = tx.description.toLowerCase();
            if (d.includes("memory game") || d.includes("number rush") || d.includes("game reward")) {
                gameRewardTotal += tx.amount;
                gameRewardCount++;
            }
        }
        if (gameRewardTotal > 0) deductions.push({ category: "Game Rewards", total: gameRewardTotal, count: gameRewardCount });

        // Welcome Back Coupons
        const welcomeBackCoupons = await prisma.welcomeBackCoupon.findMany({
            where: {
                isUsed: true,
                usedForTournamentId: { in: tournamentIds },
            },
            select: { amount: true },
        });
        const welcomeBackTotal = welcomeBackCoupons.reduce((sum, c) => sum + c.amount, 0);
        if (welcomeBackTotal > 0) deductions.push({ category: "Welcome Back Coupons", total: welcomeBackTotal, count: welcomeBackCoupons.length });

        // Org Prize Pool Donations
        const BIMON_EMAIL = "bimonlangnongsiej@gmail.com";
        const orgDonations = await prisma.prizePoolDonation.findMany({
            where: {
                tournamentId: { in: tournamentIds },
                player: {
                    user: {
                        OR: [
                            { email: BIMON_EMAIL },
                            { secondaryEmail: BIMON_EMAIL },
                        ],
                    },
                },
            },
            select: { amount: true },
        });
        const orgDonationTotal = orgDonations.reduce((sum, d) => sum + d.amount, 0);
        if (orgDonationTotal > 0) deductions.push({ category: "Org Donations", total: orgDonationTotal, count: orgDonations.length });

        // Name Change Fees (income from players breaking cooldown)
        const nameChangeFees = await prisma.transaction.aggregate({
            where: {
                type: "DEBIT",
                description: "Name Change Fee",
                createdAt: { gte: seasonStart, lte: seasonEnd },
            },
            _sum: { amount: true },
            _count: true,
        });
        const nameChangeIncome = nameChangeFees._sum.amount ?? 0;

        // Royal Pass purchase income
        const rpPurchases = await prisma.royalPass.aggregate({
            where: { seasonId: { in: seasonIds }, pricePaid: { gt: 0 } },
            _sum: { pricePaid: true },
            _count: true,
        });
        const rpIncome = rpPurchases._sum.pricePaid ?? 0;
        const rpPurchaseCount = rpPurchases._count ?? 0;

        deductions.sort((a, b) => b.total - a.total);
        const totalDeductions = deductions.reduce((sum, d) => sum + d.total, 0);
        const netProfit = totalOrgIncome + rpIncome + nameChangeIncome - totalDeductions - totalExpenses;

        return SuccessResponse({
            data: {
                records,
                expenses,
                summary: {
                    totalOrgIncome,
                    rpIncome,
                    rpPurchaseCount,
                    nameChangeIncome,
                    nameChangeCount: nameChangeFees._count ?? 0,
                    totalDeductions,
                    totalExpenses,
                    netProfit,
                    deductions,
                },
            },
            cache: CACHE.MEDIUM,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch income", error });
    }
}

/**
 * POST /api/income — Create a manual expense entry
 * Body: { amount: number, description: string }
 */
export async function POST(request: NextRequest) {
    try {
        const userId = await getAuthEmail();
        if (!userId) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        const user = await prisma.user.findFirst({
            where: userWhereEmail(userId),
            select: { role: true, id: true },
        });

        if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
            return ErrorResponse({ message: "Forbidden", status: 403 });
        }

        const body = await request.json();
        const { amount, description } = body;

        if (!amount || amount <= 0 || !description?.trim()) {
            return ErrorResponse({ message: "Amount and description are required", status: 400 });
        }

        const expense = await prisma.income.create({
            data: {
                amount: Math.round(amount),
                description: description.trim(),
                isExpense: true,
                createdBy: user.id,
            },
        });

        return SuccessResponse({ data: expense });
    } catch (error) {
        return ErrorResponse({ message: "Failed to create expense", error });
    }
}

/**
 * DELETE /api/income?id=xxx — Delete a manual expense
 */
export async function DELETE(request: NextRequest) {
    try {
        const userId = await getAuthEmail();
        if (!userId) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        const user = await prisma.user.findFirst({
            where: userWhereEmail(userId),
            select: { role: true },
        });

        if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
            return ErrorResponse({ message: "Forbidden", status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return ErrorResponse({ message: "Expense ID required", status: 400 });
        }

        await prisma.income.delete({
            where: { id, isExpense: true },
        });

        return SuccessResponse({ data: { deleted: true } });
    } catch (error) {
        return ErrorResponse({ message: "Failed to delete expense", error });
    }
}
