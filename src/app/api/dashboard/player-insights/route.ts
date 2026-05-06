import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { requireSuperAdmin } from "@/lib/auth";

/**
 * GET /api/dashboard/player-insights
 * Season-level analysis: per-player entry fees vs prizes → biggest losers & winners.
 * Accepts optional ?seasonId= query param (defaults to active season).
 * Super admin only.
 */
export async function GET(req: NextRequest) {
    try {
        await requireSuperAdmin();
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const seasonId = searchParams.get("seasonId");

        // Get season — by ID if provided, otherwise active
        const season = seasonId
            ? await prisma.season.findUnique({
                where: { id: seasonId },
                select: { id: true, name: true },
            })
            : await prisma.season.findFirst({
                where: { status: "ACTIVE" },
                select: { id: true, name: true },
            });

        if (!season) {
            return NextResponse.json({
                data: { losers: [], winners: [], summary: null, keyInsight: null },
            });
        }

        // Get all tournaments in this season
        const tournaments = await prisma.tournament.findMany({
            where: { seasonId: season.id },
            select: {
                id: true,
                name: true,
                fee: true,
                poll: {
                    select: { luckyVoterId: true },
                },
            },
        });

        if (tournaments.length === 0) {
            return NextResponse.json({
                data: { losers: [], winners: [], summary: null, orgEconomy: null, luckyVoters: [], keyInsight: null },
            });
        }

        // Build lucky voter counts
        const luckyVoterCounts = new Map<string, { count: number; tournaments: string[] }>();
        for (const t of tournaments) {
            if (t.poll?.luckyVoterId) {
                const existing = luckyVoterCounts.get(t.poll.luckyVoterId) || { count: 0, tournaments: [] };
                existing.count += 1;
                existing.tournaments.push(t.name);
                luckyVoterCounts.set(t.poll.luckyVoterId, existing);
            }
        }

        const tournamentIds = tournaments.map((t) => t.id);

        // Get all teams in these tournaments with their players
        const teams = await prisma.team.findMany({
            where: { tournamentId: { in: tournamentIds } },
            select: {
                tournamentId: true,
                players: {
                    select: {
                        id: true,
                        displayName: true,
                        user: { select: { username: true } },
                    },
                },
            },
        });

        // Count tournaments per player
        const playerTournamentCount = new Map<string, number>();
        const playerNames = new Map<string, string>();

        for (const team of teams) {
            for (const player of team.players) {
                playerTournamentCount.set(
                    player.id,
                    (playerTournamentCount.get(player.id) || 0) + 1
                );
                if (!playerNames.has(player.id)) {
                    playerNames.set(
                        player.id,
                        player.displayName || player.user.username
                    );
                }
            }
        }


        // Get all player IDs involved
        const allPlayerIds = Array.from(playerTournamentCount.keys());

        if (allPlayerIds.length === 0) {
            return NextResponse.json({
                data: { losers: [], winners: [], summary: null, orgEconomy: null, luckyVoters: [], keyInsight: null },
            });
        }

        // Fetch all transactions for tournament players (for losers/winners analysis)
        const transactions = await prisma.transaction.findMany({
            where: {
                playerId: { in: allPlayerIds },
            },
            select: {
                playerId: true,
                type: true,
                amount: true,
                description: true,
            },
        });

        // Fetch ALL credit transactions for org economy (not filtered by player)
        const allCredits = await prisma.transaction.findMany({
            where: { type: "CREDIT" },
            select: {
                playerId: true,
                amount: true,
                description: true,
            },
        });

        // Calculate per-player entry fees directly from tournament fees × team membership
        // This is more reliable than parsing transactions (which can have duplicates, refunds, etc.)
        const playerFees = new Map<string, number>();
        const tournamentFeeMap = new Map<string, number>();
        for (const t of tournaments) {
            tournamentFeeMap.set(t.id, t.fee ?? 0);
        }

        for (const team of teams) {
            const fee = tournamentFeeMap.get(team.tournamentId!) || 0;
            for (const player of team.players) {
                playerFees.set(player.id, (playerFees.get(player.id) || 0) + fee);
            }
        }

        // Subtract free entries for lucky voters
        const luckyVoterPolls = await prisma.poll.findMany({
            where: {
                luckyVoterId: { not: null },
                tournamentId: { in: tournamentIds },
            },
            select: {
                luckyVoterId: true,
                tournament: { select: { fee: true } },
            },
        });
        for (const poll of luckyVoterPolls) {
            if (poll.luckyVoterId) {
                const currentFee = playerFees.get(poll.luckyVoterId) || 0;
                playerFees.set(
                    poll.luckyVoterId,
                    currentFee - (poll.tournament?.fee ?? 0)
                );
            }
        }

        // Subtract fees for UC-exempt players
        const ucExemptPlayers = await prisma.player.findMany({
            where: { isUCExempt: true, id: { in: allPlayerIds } },
            select: { id: true },
        });
        const exemptIds = new Set(ucExemptPlayers.map((p) => p.id));
        if (exemptIds.size > 0) {
            for (const team of teams) {
                const fee = tournamentFeeMap.get(team.tournamentId!) || 0;
                for (const player of team.players) {
                    if (exemptIds.has(player.id)) {
                        playerFees.set(
                            player.id,
                            (playerFees.get(player.id) || 0) - fee
                        );
                    }
                }
            }
        }

        // Calculate total entry fees collected
        let totalEntryFeesCollected = 0;
        for (const [, fee] of playerFees) {
            totalEntryFeesCollected += fee;
        }

        // Calculate prizes from transactions (prizes vary by placement, so transactions are needed)
        const playerPrizes = new Map<string, number>();

        // Org economy: categorize non-tournament credits
        const orgCategories = new Map<string, { total: number; count: number; players: Set<string> }>();
        let totalOrgGiven = 0;
        let totalPrizesDistributed = 0;

        for (const tx of transactions) {
            const desc = tx.description.toLowerCase();

            // Check if this is a season tournament transaction using exact matching
            const isSeasonTx = tournaments.some(
                (t) => tx.description === `Entry fee for ${t.name}` ||
                    tx.description.endsWith(`: ${t.name}`)
            );

            const typeLC = tx.type.toLowerCase();

            if (isSeasonTx && typeLC === "credit" && (desc.includes("prize") || desc.includes("place"))) {
                // Tournament prize
                playerPrizes.set(
                    tx.playerId,
                    (playerPrizes.get(tx.playerId) || 0) + tx.amount
                );
                totalPrizesDistributed += tx.amount;
            }
        }

        // Org economy: categorize ALL credit transactions (not just tournament players)
        for (const tx of allCredits) {
            const desc = tx.description.toLowerCase();

            // Skip tournament prizes (already counted above) — use exact matching
            const isSeasonTx = tournaments.some(
                (t) => tx.description === `Entry fee for ${t.name}` ||
                    tx.description.endsWith(`: ${t.name}`)
            );
            if (isSeasonTx && (desc.includes("prize") || desc.includes("place"))) continue;

            // Categorize by description pattern
            let category = "";
            if (desc.includes("streak")) category = "RP Rewards";
            else if (desc.includes("promo") && !desc.includes("razorpay")) category = "Promotions";
            else if (desc.includes("referral") || desc.includes("refer")) category = "Referral Bonus";
            else if (desc.includes("bonus")) category = "Bonus";
            // Skip: lucky voters (calculated from Poll data below)
            // Skip: razorpay/manual top-ups (UC purchases — not org expense)
            // Skip: solo support (redistributed from solo tax)

            if (!category) continue;

            const existing = orgCategories.get(category) || { total: 0, count: 0, players: new Set<string>() };
            existing.total += tx.amount;
            existing.count += 1;
            existing.players.add(tx.playerId);
            orgCategories.set(category, existing);
            totalOrgGiven += tx.amount;
        }

        // Lucky Voters: free entries = waived tournament fees (reuse luckyVoterPolls from earlier)
        if (luckyVoterPolls.length > 0) {
            const luckyData = { total: 0, count: luckyVoterPolls.length, players: new Set<string>() };
            for (const poll of luckyVoterPolls) {
                luckyData.total += poll.tournament?.fee ?? 0;
                luckyData.players.add(poll.luckyVoterId!);
            }
            orgCategories.set("Lucky Voters", luckyData);
            totalOrgGiven += luckyData.total;
        }

        // Build org economy breakdown
        const orgBreakdown = Array.from(orgCategories.entries())
            .map(([category, data]) => ({
                category,
                total: data.total,
                count: data.count,
                players: data.players.size,
            }))
            .sort((a, b) => b.total - a.total);

        // Build player records
        interface PlayerRecord {
            id: string;
            name: string;
            tournaments: number;
            entryFees: number;
            prizes: number;
            net: number;
        }

        const records: PlayerRecord[] = [];

        for (const [playerId, tournamentCount] of playerTournamentCount) {
            const fees = playerFees.get(playerId) || 0;
            const prizes = playerPrizes.get(playerId) || 0;
            const net = prizes - fees;

            if (fees > 0 || prizes > 0) {
                records.push({
                    id: playerId,
                    name: playerNames.get(playerId) || "Unknown",
                    tournaments: tournamentCount,
                    entryFees: fees,
                    prizes,
                    net,
                });
            }
        }

        // Split into losers and winners
        const losers = records
            .filter((r) => r.net < 0)
            .sort((a, b) => a.net - b.net)
            .slice(0, 10)
            .map((r, i) => ({
                rank: i + 1,
                ...r,
                loss: Math.abs(r.net),
            }));

        const winners = records
            .filter((r) => r.net > 0)
            .sort((a, b) => b.net - a.net)
            .slice(0, 10)
            .map((r, i) => ({
                rank: i + 1,
                ...r,
                profit: r.net,
            }));

        // Summary
        const playersAtLoss = records.filter((r) => r.net < 0).length;
        const playersInProfit = records.filter((r) => r.net > 0).length;
        const totalLosses = records
            .filter((r) => r.net < 0)
            .reduce((sum, r) => sum + Math.abs(r.net), 0);
        const totalProfits = records
            .filter((r) => r.net > 0)
            .reduce((sum, r) => sum + r.net, 0);

        // Key insight
        let keyInsight: string | null = null;
        const totalTournaments = tournaments.length;
        const allTourneyNoWin = records.filter(
            (r) => r.tournaments === totalTournaments && r.prizes === 0
        );
        if (allTourneyNoWin.length > 0) {
            const names = allTourneyNoWin.map((r) => r.name).join(", ");
            const loss = allTourneyNoWin[0]?.entryFees || 0;
            keyInsight = `${names} played ALL ${totalTournaments} tournaments but never won anything - they each lost ₹${loss}!`;
        }
        if (!keyInsight) {
            const bigComeback = records
                .filter((r) => r.net > 0 && r.tournaments >= 3)
                .sort((a, b) => b.net - a.net)[0];
            if (bigComeback) {
                keyInsight = `${bigComeback.name} is the most profitable player this season with ₹${bigComeback.net} profit from ${bigComeback.tournaments} tournaments!`;
            }
        }

        // Org Share: income from declare-winners (Income table with "Org" prefix)
        const orgIncomeRecords = await prisma.income.findMany({
            where: {
                tournamentId: { in: tournamentIds },
                description: { startsWith: "Org" },
            },
            select: { amount: true },
        });
        const totalOrgShare = orgIncomeRecords.reduce((sum, r) => sum + r.amount, 0);

        // UC Exempt: waived entry fees for exempt players (reuse ucExemptPlayers from earlier)
        let totalUCExemptCost = 0;
        if (exemptIds.size > 0) {
            const exemptIdArray = Array.from(exemptIds);
            const exemptTeams = await prisma.team.findMany({
                where: {
                    tournamentId: { in: tournamentIds },
                    players: { some: { id: { in: exemptIdArray } } },
                },
                select: {
                    tournament: { select: { fee: true } },
                    players: { where: { id: { in: exemptIdArray } }, select: { id: true } },
                },
            });
            for (const team of exemptTeams) {
                totalUCExemptCost += (team.tournament?.fee ?? 0) * team.players.length;
            }
            if (totalUCExemptCost > 0) {
                orgCategories.set("BP Exempt", {
                    total: totalUCExemptCost,
                    count: exemptTeams.length,
                    players: new Set(exemptIdArray),
                });
                totalOrgGiven += totalUCExemptCost;
            }
        }

        // Org net = entry fees + org share - prizes - org extras
        const orgNet = totalEntryFeesCollected + totalOrgShare - totalPrizesDistributed - totalOrgGiven;

        // Lucky voters list
        const luckyVoters = Array.from(luckyVoterCounts.entries())
            .map(([playerId, data]) => ({
                id: playerId,
                name: playerNames.get(playerId) || "Unknown",
                count: data.count,
                tournaments: data.tournaments,
                savedUC: data.tournaments.reduce((sum, tName) => {
                    const t = tournaments.find((t2) => t2.name === tName);
                    return sum + (t?.fee || 0);
                }, 0),
            }))
            .sort((a, b) => b.count - a.count);

        return NextResponse.json({
            data: {
                losers,
                winners,
                summary: {
                    playersAtLoss,
                    playersInProfit,
                    totalLosses,
                    totalProfits,
                    totalTournaments,
                    seasonName: season.name,
                },
                orgEconomy: {
                    totalEntryFees: totalEntryFeesCollected,
                    totalPrizes: totalPrizesDistributed,
                    totalOrgGiven,
                    totalOrgShare,
                    orgNet,
                    breakdown: orgBreakdown,
                },
                luckyVoters,
                keyInsight,
            },
        });
    } catch (error) {
        console.error("Player insights error:", error);
        return NextResponse.json(
            { error: "Failed to fetch player insights" },
            { status: 500 }
        );
    }
}
