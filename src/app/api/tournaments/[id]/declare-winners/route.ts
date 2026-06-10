import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { isBracketType } from "@/lib/bracket-types";
import {
    getFinalDistribution,
    getTeamSize,
} from "@/lib/logic/prizeDistribution";
import {
    calculateRepeatWinnerTax,
    aggregateTaxTotals,
    type TaxResult,
} from "@/lib/logic/repeatWinnerTax";
import {
    calculateSoloTax,
    getTaxDistribution,
    calculateTierDistribution,
    getLoserSupportMessage,
    type SoloTaxResult,
} from "@/lib/logic/soloTax";
import { getSettings } from "@/lib/settings";
import { revokeRoleFromAll, deleteTournamentChannel, cleanOldChannelMessages } from "@/lib/discord-service";

// BGMI placement points — must match rankings API
const PLACEMENT_PTS: Record<number, number> = {
    1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1,
};





/**
 * POST /api/tournaments/[id]/declare-winners
 *
 * Supports two paths:
 * - BGMI / BR tournaments: uses TeamStats (kills + placement points)
 * - PES / Bracket tournaments: reads winners from BracketMatch directly
 *
 * Flow (bracket path):
 * 1. Read BracketMatch results (final winner = 1st, runner-up = 2nd, etc.)
 * 2. Prize = entry fee × players + donations, split by placement config
 * 3. Repeat winner tax (if fund enabled), NO solo tax, NO participation adj
 * 4. TournamentWinner + PendingReward + Notification
 * 5. Income records + mark INACTIVE
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { id } = await params;
        const body = await req.json();
        const { placements, dryRun } = body as {
            placements?: { position: number; amount: number; diamondAmount?: number; teamId?: string; players?: { playerId: string; amount: number }[] }[];
            dryRun?: boolean;
        };

        // ── 1. Fetch tournament ──────────────────────────────
        const tournament = await prisma.tournament.findUnique({
            where: { id },
            select: { id: true, name: true, fee: true, seasonId: true, isWinnerDeclared: true, type: true, discordChannelId: true, discordGroupChannels: true, whatsappGroupId: true, whatsappGroupChannels: true, season: { select: { name: true } } },
        });
        if (!tournament) return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
        if (!dryRun && tournament.isWinnerDeclared) return NextResponse.json({ error: "Winners already declared" }, { status: 400 });

        // Route to bracket path for PES / bracket / TDM tournaments
        if (isBracketType(tournament.type)) {
            return declareBracketWinners({ tournament, placements, dryRun, req });
        }

        // ── Fetch settings for org cut & fund toggle ──────────
        const settings = await getSettings();

        // Check poll-level fund override (squad polls default fund OFF)
        const pollForTournament = await prisma.poll.findUnique({
            where: { tournamentId: id },
            select: { allowSquads: true, enableFund: true, prizePoolFee: true, orgCutFixed: true, isChampionship: true, fixedPrizes: true },
        });
        const isRanked = pollForTournament?.allowSquads ?? false;

        // Use ranked-specific settings for squad tournaments
        // Per-poll org cut override: only applies for championship tournaments (17+ teams)
        const pollOrgCutFixed = pollForTournament?.orgCutFixed;
        const isChampionship = pollForTournament?.isChampionship ?? false;
        // orgCutFixed from poll only applies for actual championships (20+ teams)
        const teamCountForOrgCheck = (await prisma.team.count({ where: { tournamentId: id } }));
        const hasPollOrgCut = pollOrgCutFixed != null && isChampionship && teamCountForOrgCheck >= 20;
        const orgCutMode = hasPollOrgCut
            ? "fixed" as const
            : isRanked
                ? (settings.rankedOrgCutMode ?? settings.orgCutMode ?? "fixed")
                : (settings.orgCutMode ?? "fixed");
        // Fixed prizes: admin set exact amounts, org cut already included → zero org cut for distribution
        const fixedPrizes = Array.isArray(pollForTournament?.fixedPrizes) ? (pollForTournament.fixedPrizes as number[]) : null;
        // When fixedPrizes is set, the poll's orgCutFixed is a separate org income amount (not deducted from prizes)
        const fixedPrizesOrgCut = fixedPrizes && pollOrgCutFixed != null && pollOrgCutFixed > 0 ? pollOrgCutFixed : 0;
        const orgCut = fixedPrizes ? 0 : (hasPollOrgCut
            ? pollOrgCutFixed!
            : orgCutMode === "percent"
                ? (isRanked ? (settings.rankedOrgCutPercent ?? 0) : (settings.orgCutPercent ?? 0))
                : (isRanked ? (settings.rankedOrgCutFixed ?? 0) : (settings.orgCutFixed ?? 0)));

        const enableFund = isRanked
            ? (settings.rankedEnableFund ?? false)
            : (settings.enableFund ?? false);

        // For squad tournaments, fetch captain IDs for each team
        const isSquadTournament = pollForTournament?.allowSquads ?? false;
        let teamCaptainMap = new Map<string, string>(); // teamId -> captainPlayerId
        // Clan treasury: track which squads used clan treasury for prize return
        let squadClanTreasuryMap = new Map<string, { clanId: string; captainId: string }>(); // captainId -> { clanId, captainId }
        if (isSquadTournament && pollForTournament) {
            const poll = await prisma.poll.findUnique({
                where: { tournamentId: id },
                select: { id: true },
            });
            if (poll) {
                const squads = await prisma.squad.findMany({
                    where: { pollId: poll.id },
                    select: {
                        captainId: true,
                        useClanTreasury: true,
                        clanId: true,
                        invites: {
                            where: { status: "ACCEPTED" },
                            select: { playerId: true },
                        },
                    },
                });
                // Build a lookup: for each player in a squad, map their team to the captain
                // We'll resolve team membership below when we have the team data
                // For now, store captain + their squad members
                for (const squad of squads) {
                    const memberIds = squad.invites.map(i => i.playerId);
                    // Store captain for all members — we'll match by team later
                    for (const memberId of memberIds) {
                        teamCaptainMap.set(memberId, squad.captainId);
                    }
                    // Track clan treasury usage for prize return
                    if (squad.useClanTreasury && squad.clanId) {
                        squadClanTreasuryMap.set(squad.captainId, {
                            clanId: squad.clanId,
                            captainId: squad.captainId,
                        });
                    }
                }
            }
        }

        // ── 2. Aggregate team rankings ───────────────────────
        const teamStats = await prisma.teamStats.findMany({
            where: { tournamentId: id },
            include: {
                team: {
                    include: {
                        players: {
                            select: { id: true, userId: true, displayName: true, isUCExempt: true, isSoloRestricted: true, soloMatchesNeeded: true, meritScore: true },
                        },
                    },
                },
                teamPlayerStats: {
                    select: { kills: true },
                },
            },
        });

        // Aggregate per team
        type TeamAgg = {
            teamId: string;
            total: number; kills: number; pts: number;
            players: { playerId: string; userId: string; name: string; isUCExempt: boolean; isSoloRestricted: boolean; soloMatchesNeeded: number }[];
            chickenDinners: number;
            lastMatchPosition: number;
        };

        const teamMap = new Map<string, TeamAgg>();
        for (const stat of teamStats) {
            const kills = stat.teamPlayerStats.reduce((sum, ps) => sum + (ps.kills ?? 0), 0);
            const p = PLACEMENT_PTS[stat.position] ?? 0;
            const t = kills + p;
            const existing = teamMap.get(stat.teamId);
            if (existing) {
                existing.kills += kills; existing.pts += p; existing.total += t;
                if (stat.position === 1) existing.chickenDinners++;
                existing.lastMatchPosition = p; // latest stat overwrites
            } else {
                teamMap.set(stat.teamId, {
                    teamId: stat.teamId, total: t, kills, pts: p,
                    players: stat.team.players.map((p2) => ({
                        playerId: p2.id,
                        userId: p2.userId,
                        name: p2.displayName || "Unknown",
                        isUCExempt: p2.isUCExempt,
                        isSoloRestricted: p2.isSoloRestricted,
                        soloMatchesNeeded: p2.soloMatchesNeeded,
                    })),
                    chickenDinners: stat.position === 1 ? 1 : 0,
                    lastMatchPosition: p,
                });
            }
        }

        // For squad tournaments: resolve teamId -> captainId mapping
        if (isSquadTournament) {
            const resolvedCaptainMap = new Map<string, string>(); // teamId -> captainPlayerId
            for (const [teamId, team] of teamMap) {
                for (const player of team.players) {
                    const captainId = teamCaptainMap.get(player.playerId);
                    if (captainId) {
                        resolvedCaptainMap.set(teamId, captainId);
                        break;
                    }
                }
            }
            teamCaptainMap = resolvedCaptainMap; // Now it's teamId -> captainId
        }

        // Sort with BGMI tiebreakers
        const rankings = Array.from(teamMap.values()).sort((a, b) => {
            if (b.total !== a.total) return b.total - a.total;
            if (b.chickenDinners !== a.chickenDinners) return b.chickenDinners - a.chickenDinners;
            if (b.pts !== a.pts) return b.pts - a.pts;
            if (b.kills !== a.kills) return b.kills - a.kills;
            return a.lastMatchPosition - b.lastMatchPosition;
        });

        // Prize pool metadata
        const allPlayerIds = new Set<string>();
        let ucExemptCount = 0;
        for (const team of teamMap.values()) {
            for (const p of team.players) {
                allPlayerIds.add(p.playerId);
                if (!isSquadTournament && p.isUCExempt) ucExemptCount++;
            }
        }

        const entryFee = tournament.fee ?? 0;
        const poolFee = pollForTournament?.prizePoolFee ?? entryFee; // Per-entry amount going to prize pool
        const totalPlayers = allPlayerIds.size;

        // Include voluntary donations in the prize pool
        const donations = await prisma.prizePoolDonation.findMany({
            where: { tournamentId: id },
            select: { amount: true },
        });
        const totalDonations = donations.reduce((sum, d) => sum + d.amount, 0);
        const teamCount = teamMap.size;
        // For prize distribution refund: squad fee is per-team, so teamSize=1
        // For non-squad: fee is per-player, use actual team size for refund calc
        const teamSize = isSquadTournament ? 1 : (teamCount > 0 ? Math.round(totalPlayers / teamCount) : 2);
        // Squad tournaments: captain pays per team, not per player
        const prizePool = fixedPrizes
            ? fixedPrizes.reduce((s, n) => s + n, 0) + totalDonations
            : isSquadTournament
                ? (poolFee * teamCount) + totalDonations
                : (poolFee * totalPlayers) + totalDonations;

        const placementsToUse = placements && placements.length > 0
            ? placements
            : [{ position: 1, amount: 340 }, { position: 2, amount: 140 }];

        if (rankings.length < placementsToUse.length) {
            return NextResponse.json({ error: `Need ${placementsToUse.length} teams but only ${rankings.length} available.` }, { status: 400 });
        }

        // ── 3. Batch-fetch data needed for taxes ─────────────
        const allWinningPlayerIds: string[] = [];
        for (const pl of placementsToUse) {
            const team = rankings[pl.position - 1];
            if (team) for (const p of team.players) allWinningPlayerIds.push(p.playerId);
        }

        // Step 1: Get match IDs for this tournament
        const matchIds = (await prisma.match.findMany({
            where: { tournamentId: id },
            select: { id: true },
        })).map(m => m.id);

        const totalMatches = matchIds.length;

        // Step 2: Batch-fetch all tax data using flat matchId filter (works for migrated data)
        const [playerWinCounts, playerMatchCounts, teamPlayerData] = await Promise.all([
            getPlayerRecentWins(allWinningPlayerIds, tournament.seasonId || "", 6, undefined, isSquadTournament),
            prisma.teamPlayerStats.groupBy({
                by: ["playerId"],
                where: { playerId: { in: allWinningPlayerIds }, matchId: { in: matchIds }, present: true },
                _count: { matchId: true },
            }),
            // Detect solo via teamPlayerStats
            prisma.teamPlayerStats.findMany({
                where: {
                    playerId: { in: allWinningPlayerIds },
                    matchId: { in: matchIds },
                },
                select: { playerId: true, teamId: true },
                distinct: ["playerId", "teamId"],
            }),
        ]);

        const matchesPlayedMap = new Map<string, number>();
        for (const r of playerMatchCounts) matchesPlayedMap.set(r.playerId, r._count.matchId);

        // Detect solo: count unique players per team
        const teamPlayerCounts = new Map<string, Set<string>>();
        for (const tp of teamPlayerData) {
            if (!teamPlayerCounts.has(tp.teamId)) teamPlayerCounts.set(tp.teamId, new Set());
            teamPlayerCounts.get(tp.teamId)!.add(tp.playerId);
        }
        const playerSoloMap = new Map<string, boolean>();
        for (const tp of teamPlayerData) {
            const teamSize = teamPlayerCounts.get(tp.teamId)?.size ?? 0;
            playerSoloMap.set(tp.playerId, teamSize === 1);
        }

        // ── 4. Calculate per-player prizes ───────────────────
        const SOFTENING_FACTOR = 0.5;
        const allTaxResults: TaxResult[] = [];
        const allSoloTaxResults: SoloTaxResult[] = [];

        interface PlayerPrize {
            playerId: string;
            userId: string;
            finalAmount: number;
            message: string;
            details: Prisma.InputJsonValue;
            taxResult: TaxResult;
            soloTaxResult: SoloTaxResult;
        }

        interface WinnerTeamData {
            teamId: string;
            amount: number;
            position: number;
            players: PlayerPrize[];
        }

        const winnerTeamsData: WinnerTeamData[] = [];

        for (const placement of placementsToUse) {
            // If teamId is provided (from modal), use that exact team.
            // Otherwise fall back to position-based lookup (dry run / simple mode).
            const teamById = placement.teamId
                ? Array.from(teamMap.values()).find(t => t.teamId === placement.teamId)
                : null;
            const team = teamById || rankings[placement.position - 1];
            if (!team) continue;

            const playersData: PlayerPrize[] = [];

            // Build a map of pre-computed per-player amounts (from preview)
            const precomputedAmounts = new Map<string, number>();
            if (placement.players && placement.players.length > 0) {
                for (const pp of placement.players) {
                    precomputedAmounts.set(pp.playerId, pp.amount);
                }
            }

            if (placement.amount > 0 && team.players.length > 0) {
                // ─── SQUAD TEAM: Full prize to captain only ───
                // Only applies if this team came from a squad (has a captain)
                const captainId = isSquadTournament ? teamCaptainMap.get(team.teamId) : undefined;
                if (captainId) {
                    const captain = team.players.find(p => p.playerId === captainId)
                        || team.players[0];

                    if (captain) {
                        const noTax: TaxResult = { playerId: captain.playerId, originalAmount: placement.amount, taxAmount: 0, taxRate: 0, netAmount: placement.amount, winCount: 1 };
                        const noSoloTax: SoloTaxResult = { playerId: captain.playerId, originalAmount: placement.amount, taxAmount: 0, netAmount: placement.amount, isSolo: false };

                        playersData.push({
                            playerId: captain.playerId,
                            userId: captain.userId,
                            finalAmount: placement.amount,
                            message: `${getOrdinal(placement.position)} Place - ${tournament.name}${tournament.season?.name ? ` · ${tournament.season.name}` : ''} (Leader Prize)`,
                            details: {
                                tournamentId: id,
                                tournamentName: tournament.name,
                                teamPrize: placement.amount,
                                playerCount: team.players.length,
                                captainOnly: true,
                                baseShare: placement.amount,
                                participationAdj: 0,
                                matchesPlayed: 0,
                                totalMatches,
                                repeatTax: 0,
                                soloTax: 0,
                                wasRepeatWinner: false,
                                wasSolo: false,
                            } as Prisma.InputJsonValue,
                            taxResult: noTax,
                            soloTaxResult: noSoloTax,
                        });

                        allTaxResults.push(noTax);
                    }
                } else {
                // ─── RANDOM TEAMS: Split among all players ───
                const basePerPlayer = Math.floor(placement.amount / team.players.length);

                // Participation adjustment (only needed when no precomputed amounts)
                const rates = team.players.map((p) => {
                    const played = matchesPlayedMap.get(p.playerId) || 0;
                    return { playerId: p.playerId, rate: totalMatches > 0 ? played / totalMatches : 1, played };
                });
                const avgRate = rates.reduce((s, r) => s + r.rate, 0) / team.players.length;

                const adjustedAmounts = new Map<string, { adjusted: number; adj: number; played: number }>();
                for (const r of rates) {
                    const adj = Math.floor((r.rate - avgRate) * basePerPlayer * SOFTENING_FACTOR);
                    adjustedAmounts.set(r.playerId, { adjusted: basePerPlayer + adj, adj, played: r.played });
                }

                for (const player of team.players) {
                    const pa = adjustedAmounts.get(player.playerId) || { adjusted: basePerPlayer, adj: 0, played: 0 };

                    let finalAmount: number;
                    let taxResult: TaxResult;
                    let soloTaxResult: SoloTaxResult;

                    if (precomputedAmounts.has(player.playerId)) {
                        // Use exact amount from preview — no recalculation
                        finalAmount = precomputedAmounts.get(player.playerId)!;
                        if (enableFund) {
                            // Compute tax results for accounting (Fund splits)
                            const previousWins = playerWinCounts.get(player.playerId) || 0;
                            taxResult = calculateRepeatWinnerTax(player.playerId, pa.adjusted, previousWins + 1);
                            const isSolo = playerSoloMap.get(player.playerId) || false;
                            soloTaxResult = calculateSoloTax(player.playerId, taxResult.netAmount, isSolo);
                        } else {
                            // Fund OFF — no taxes
                            taxResult = { playerId: player.playerId, originalAmount: pa.adjusted, taxAmount: 0, taxRate: 0, netAmount: pa.adjusted, winCount: 1 };
                            soloTaxResult = { playerId: player.playerId, originalAmount: pa.adjusted, taxAmount: 0, netAmount: pa.adjusted, isSolo: false };
                        }
                    } else {
                        // Fallback: server-side calculation (dry run / simple mode)
                        if (enableFund) {
                            const previousWins = playerWinCounts.get(player.playerId) || 0;
                            taxResult = calculateRepeatWinnerTax(player.playerId, pa.adjusted, previousWins + 1);
                            const isSolo = playerSoloMap.get(player.playerId) || false;
                            soloTaxResult = calculateSoloTax(player.playerId, taxResult.netAmount, isSolo);
                            finalAmount = soloTaxResult.netAmount;
                        } else {
                            // Fund OFF — no taxes, full amount
                            taxResult = { playerId: player.playerId, originalAmount: pa.adjusted, taxAmount: 0, taxRate: 0, netAmount: pa.adjusted, winCount: 1 };
                            soloTaxResult = { playerId: player.playerId, originalAmount: pa.adjusted, taxAmount: 0, netAmount: pa.adjusted, isSolo: false };
                            finalAmount = pa.adjusted;
                        }
                    }

                    playersData.push({
                        playerId: player.playerId,
                        userId: player.userId,
                        finalAmount,
                        message: `${getOrdinal(placement.position)} Place - ${tournament.name}${tournament.season?.name ? ` · ${tournament.season.name}` : ''}`,
                        details: {
                            tournamentId: id,
                            tournamentName: tournament.name,
                            teamPrize: placement.amount,
                            playerCount: team.players.length,
                            baseShare: basePerPlayer,
                            participationAdj: pa.adj,
                            matchesPlayed: pa.played,
                            totalMatches,
                            repeatTax: taxResult.taxAmount,
                            soloTax: soloTaxResult.taxAmount,
                            wasRepeatWinner: taxResult.winCount > 1,
                            wasSolo: soloTaxResult.isSolo,
                        } as Prisma.InputJsonValue,
                        taxResult,
                        soloTaxResult,
                    });

                    allTaxResults.push(taxResult);
                    if (soloTaxResult.isSolo) allSoloTaxResults.push(soloTaxResult);
                }
                } // end else (random teams)
            }

            winnerTeamsData.push({ teamId: team.teamId, amount: placement.amount, position: placement.position, players: playersData });
        }

        // ── 5. Calculate final amounts ──
        let finalOrg = 0, finalFund = 0;
        if (prizePool > 0) {
            const distribution = getFinalDistribution(prizePool, entryFee, teamSize, ucExemptCount, orgCut, orgCutMode);
            const taxTotals = aggregateTaxTotals(allTaxResults);

            // Org gets ONLY its pool cut (orgPercent% of pool)
            // Fund gets repeat winner taxes (when enableFund is ON)
            finalOrg = distribution.finalOrgAmount;
            finalFund = enableFund ? taxTotals.totalTax : 0;

            // Reconcile rounding remainders — use effective pool (after UC exempt)
            const ucExemptCost = ucExemptCount * entryFee;
            const effectivePool = prizePool - ucExemptCost;
            const totalToPlayers = winnerTeamsData.reduce(
                (sum, t) => sum + t.players.reduce((s, p) => s + p.finalAmount, 0), 0
            );
            const distributed = totalToPlayers + finalOrg + finalFund;
            const roundingRemainder = effectivePool - distributed;
            if (roundingRemainder > 0) {
                if (orgCut > 0) {
                    finalOrg += roundingRemainder;
                } else if (enableFund) {
                    finalFund += roundingRemainder;
                }
                // else: remainder is negligible, absorbed
            }
        }

        // ── DRY RUN: return preview without writing ──────────
        if (dryRun) {
            const dist = prizePool > 0 ? getFinalDistribution(prizePool, entryFee, teamSize, ucExemptCount, orgCut, orgCutMode) : null;
            const taxTots = aggregateTaxTotals(allTaxResults);
            return NextResponse.json({
                success: true,
                dryRun: true,
                data: {
                    finalOrg,
                    finalFund,
                    breakdown: {
                        baseOrgFund: (dist?.orgFee ?? 0) + (dist?.fundAmount ?? 0),
                        ucExemptCost: dist?.ucExemptCost ?? 0,
                        totalRepeatTax: taxTots.totalTax,
                        combined: (dist?.finalOrgAmount ?? 0) + (dist?.finalFundAmount ?? 0) + taxTots.totalTax,
                        roundingRemainder: prizePool - winnerTeamsData.reduce(
                            (sum, t) => sum + t.players.reduce((s, p) => s + p.finalAmount, 0), 0
                        ) - finalOrg - finalFund,
                    },
                    soloTaxTotal: allSoloTaxResults.reduce((s, r) => s + r.taxAmount, 0),
                    winners: winnerTeamsData.map(t => ({
                        position: t.position,
                        teamAmount: t.amount,
                        players: t.players.map(p => ({
                            playerId: p.playerId,
                            finalAmount: p.finalAmount,
                            repeatTax: p.taxResult.taxAmount,
                            soloTax: p.soloTaxResult.taxAmount,
                        })),
                    })),
                },
            });
        }

        // ── 6. Atomic transaction ────────────────────────────
        // Winners, PendingRewards, Income, and tournament status are ALL inside
        // the transaction so they can't get out of sync.
        const createdWinners = await prisma.$transaction(async (tx) => {
            const winners = [];

            for (const teamData of winnerTeamsData) {
                // Create TournamentWinner
                const winner = await tx.tournamentWinner.create({
                    data: {
                        amount: teamData.amount,
                        position: teamData.position,
                        team: { connect: { id: teamData.teamId } },
                        tournament: { connect: { id } },
                        isDistributed: true,
                    },
                });

                // Create PendingReward + Notification for each player
                for (const p of teamData.players) {
                    // Clan treasury: if this captain's squad used clan treasury,
                    // credit the prize to the clan balance instead of creating a PendingReward
                    const clanTreasuryInfo = squadClanTreasuryMap.get(p.playerId);
                    if (clanTreasuryInfo && p.finalAmount > 0) {
                        // Credit clan treasury
                        await tx.clan.update({
                            where: { id: clanTreasuryInfo.clanId },
                            data: { balance: { increment: p.finalAmount } },
                        });
                        await tx.clanTransaction.create({
                            data: {
                                clanId: clanTreasuryInfo.clanId,
                                playerId: p.playerId,
                                amount: p.finalAmount,
                                type: "CREDIT",
                                description: `${getOrdinal(teamData.position)} place prize - ${tournament.name}`,
                            },
                        });
                    } else {
                        await tx.pendingReward.create({
                            data: {
                                playerId: p.playerId,
                                type: "WINNER",
                                amount: p.finalAmount,
                                position: teamData.position,
                                message: p.message,
                                details: p.details,
                            },
                        });
                    }
                }

                winners.push(winner);
            }

            // Income records with tax contributions (INSIDE transaction)
            if (prizePool > 0) {
                if (finalFund > 0) {
                    const taxTotals = aggregateTaxTotals(allTaxResults);
                    await tx.income.create({
                        data: {
                            amount: finalFund,
                            description: taxTotals.fundContribution > 0
                                ? `Fund - ${tournament.name} (incl. ₹${taxTotals.fundContribution} repeat winner tax)`
                                : `Fund - ${tournament.name}`,
                            tournamentId: id, tournamentName: tournament.name, createdBy: "system",
                        },
                    });
                }
                if (finalOrg > 0) {
                    const taxTotals = aggregateTaxTotals(allTaxResults);
                    await tx.income.create({
                        data: {
                            amount: finalOrg,
                            description: taxTotals.orgContribution > 0
                                ? `Org - ${tournament.name} (incl. ₹${taxTotals.orgContribution} repeat winner tax)`
                                : `Org - ${tournament.name}`,
                            tournamentId: id, tournamentName: tournament.name, createdBy: "system",
                        },
                    });
                }
            }

            // Fixed prizes org cut: recorded separately (not deducted from prizes)
            if (fixedPrizesOrgCut > 0) {
                await tx.income.create({
                    data: {
                        amount: fixedPrizesOrgCut,
                        description: `Org - ${tournament.name} (fixed prizes)`,
                        tournamentId: id, tournamentName: tournament.name, createdBy: "system",
                    },
                });
            }

            // Mark tournament completed (INSIDE transaction)
            await tx.tournament.update({
                where: { id },
                data: { isWinnerDeclared: true, status: "INACTIVE" },
            });

            return winners;
        }, { timeout: 30000, maxWait: 35000 });

        // ── 6b. Auto-assign sponsor coupon to 1st place captain ──
        if (isSquadTournament) {
            try {
                const poll = await prisma.poll.findUnique({
                    where: { tournamentId: id },
                    select: { id: true },
                });
                if (poll) {
                    const coupon = await prisma.sponsorCoupon.findUnique({
                        where: { pollId: poll.id },
                    });
                    if (coupon && coupon.status === "AVAILABLE") {
                        // Find 1st place team
                        const firstPlaceTeam = winnerTeamsData.find((t) => t.position === 1);
                        if (firstPlaceTeam) {
                            const captainId = teamCaptainMap.get(firstPlaceTeam.teamId);
                            if (captainId) {
                                await prisma.sponsorCoupon.update({
                                    where: { id: coupon.id },
                                    data: {
                                        status: "CLAIMED",
                                        claimedById: captainId,
                                        claimedAt: new Date(),
                                    },
                                });
                            }
                        }
                    }
                }
            } catch (couponErr) {
                // Don't fail winner declaration if coupon assignment fails
                console.error("Coupon auto-assign error:", couponErr);
            }
        }

        // ── 6c. Revoke Discord @Ranked-Player role from all tournament players ──
        if (isSquadTournament && process.env.DISCORD_RANKED_PLAYER_ROLE_ID) {
            try {
                // Get all player IDs in this tournament
                const allTournamentPlayerIds = Array.from(allPlayerIds);
                // Find players with Discord IDs
                const discordPlayers = await prisma.player.findMany({
                    where: {
                        id: { in: allTournamentPlayerIds },
                        discordId: { not: null },
                    },
                    select: { discordId: true },
                });
                const discordUserIds = discordPlayers
                    .map((p) => p.discordId)
                    .filter((id): id is string => !!id);
                if (discordUserIds.length > 0) {
                    // Fire-and-forget — don't block the response
                    revokeRoleFromAll(discordUserIds, process.env.DISCORD_RANKED_PLAYER_ROLE_ID!)
                        .catch((err) => console.error("Discord role revocation error:", err));
                }
            } catch (discordErr) {
                console.error("Discord cleanup error:", discordErr);
            }
        }

        // ── 6d. Auto-delete tournament Discord channels ──
        if (tournament.discordChannelId) {
            deleteTournamentChannel(tournament.discordChannelId)
                .catch((err) => console.error("Discord channel deletion error:", err));
        }
        // Also delete any group channels (championship)
        const groupChannels = (tournament.discordGroupChannels as Record<string, string>) || {};
        for (const chId of Object.values(groupChannels)) {
            deleteTournamentChannel(chId)
                .catch((err) => console.error("Discord group channel deletion error:", err));
        }

        // ── 6f. Auto-delete tournament WhatsApp groups ──
        if (tournament.whatsappGroupId || tournament.whatsappGroupChannels) {
            import("@/lib/whatsapp").then(async ({ deleteGroup }) => {
                try {
                    // Delete main group
                    if (tournament.whatsappGroupId) {
                        await deleteGroup(tournament.whatsappGroupId);
                        console.log(`[WhatsApp] Deleted main group for ${tournament.name}`);
                    }
                    // Delete championship group channels
                    const waGroupChannels = (tournament.whatsappGroupChannels as Record<string, string>) || {};
                    for (const [group, groupId] of Object.entries(waGroupChannels)) {
                        await deleteGroup(groupId);
                        console.log(`[WhatsApp] Deleted group ${group} for ${tournament.name}`);
                    }
                    // Clear from DB
                    await prisma.tournament.update({
                        where: { id },
                        data: { whatsappGroupId: null, whatsappGroupChannels: Prisma.JsonNull },
                    });
                } catch (err) {
                    console.error("[WhatsApp] Group deletion error:", err);
                }
            }).catch(err => console.error("[WhatsApp] Import error:", err));
        }

        // ── 6e. Clean old messages from standings channel (keeps Discord lightweight) ──
        const standingsChannelId = process.env.DISCORD_STANDINGS_CHANNEL_ID;
        if (standingsChannelId) {
            cleanOldChannelMessages(standingsChannelId, 14)
                .then((n) => n > 0 && console.log(`[discord] Cleaned ${n} old standings messages`))
                .catch((err) => console.error("Discord standings cleanup error:", err));
        }

        // ── 6. Post-transaction: Solo tax distribution ────────
        // (Outside transaction — needs winners committed first for loser calc)

        // Solo tax distribution
        const totalSoloTax = allSoloTaxResults.reduce((s, r) => s + r.taxAmount, 0);
        if (totalSoloTax > 0 && tournament.seasonId) {
            const taxDist = getTaxDistribution(totalSoloTax);

            // Get loser tiers
            const loserTiers = await getPlayerLosses(tournament.seasonId);

            // Get solo winner display names
            const soloWinnerNames = await prisma.player.findMany({
                where: { id: { in: allSoloTaxResults.map((r) => r.playerId) } },
                select: { displayName: true },
            });
            const donorName = soloWinnerNames.map((p) => p.displayName || "Unknown").join(", ");

            if (taxDist.loserAmount > 0 && loserTiers.length > 0) {
                const tierDistribution = calculateTierDistribution(taxDist.loserAmount, loserTiers);

                // Distribute to losers via PendingReward
                const loserRewardOps = [];
                for (const tier of tierDistribution) {
                    if (tier.perPlayer > 0) {
                        for (const loserId of tier.playerIds) {
                            loserRewardOps.push(prisma.pendingReward.create({
                                data: {
                                    playerId: loserId,
                                    type: "SOLO_SUPPORT",
                                    amount: tier.perPlayer,
                                    message: getLoserSupportMessage(donorName, tournament.name),
                                },
                            }));
                        }
                    }
                }
                await Promise.all(loserRewardOps);

                // 40% to bonus pool
                if (taxDist.poolAmount > 0) {
                    await addToSoloTaxPool(tournament.seasonId, taxDist.poolAmount, donorName);
                }
            } else {
                // No losers — 100% to pool
                await addToSoloTaxPool(tournament.seasonId, totalSoloTax, donorName);
            }

            // Consume pool (was already factored into client-side prize display)
            await consumeSoloTaxPool(tournament.seasonId);
        }

        // NOTE: Merit reset + referral commissions are now handled
        // by the separate "Process Rewards" button (/api/tournaments/[id]/post-declare)
        // to keep the declare-winners flow fast.

        return NextResponse.json({
            success: true,
            message: "Winners declared and rewards created",
            data: createdWinners,
        });
    } catch (error) {
        console.error("Error declaring winners:", error);
        return NextResponse.json({ error: "Failed to declare winners" }, { status: 500 });
    }
}

// ─── Bracket-aware declare-winners (PES / League / Group+KO) ────────────────
// Reads winners directly from BracketMatch results instead of TeamStats.
// 1st place = final match winner, 2nd place = final match runner-up.
// 3rd/4th = semi-final losers, etc. Admin can also pass custom placements.

async function declareBracketWinners({
    tournament,
    placements: customPlacements,
    dryRun,
}: {
    tournament: { id: string; name: string; fee: number | null; seasonId: string | null; type: string; season: { name: string } | null };
    placements?: { position: number; amount: number; diamondAmount?: number; teamId?: string; players?: { playerId: string; amount: number }[] }[];
    dryRun?: boolean;
    req: Request;
}): Promise<Response> {
    const id = tournament.id;
    const settings = await getSettings();

    // Check poll-level fund override (squad polls default fund OFF)
    const pollForTournament = await prisma.poll.findUnique({
        where: { tournamentId: id },
        select: { allowSquads: true, enableFund: true, prizePoolFee: true, orgCutFixed: true, isChampionship: true, fixedPrizes: true },
    });
    const isRanked = pollForTournament?.allowSquads ?? false;

    // Per-poll org cut override: only applies for championship tournaments (17+ teams)
    const pollOrgCutFixed = pollForTournament?.orgCutFixed;
    const isChampionship = pollForTournament?.isChampionship ?? false;
    // orgCutFixed from poll only applies for actual championships (20+ teams)
    const bracketTeamCount = (await prisma.team.count({ where: { tournamentId: id } }));
    const hasPollOrgCut = pollOrgCutFixed != null && isChampionship && bracketTeamCount >= 20;
    const orgCutMode = hasPollOrgCut
        ? "fixed" as const
        : isRanked
            ? (settings.rankedOrgCutMode ?? settings.orgCutMode ?? "fixed")
            : (settings.orgCutMode ?? "fixed");
    // Fixed prizes: admin set exact amounts, org cut already included → zero org cut for distribution
    const bracketFixedPrizes = Array.isArray(pollForTournament?.fixedPrizes) ? (pollForTournament.fixedPrizes as number[]) : null;
    // When fixedPrizes is set, the poll's orgCutFixed is a separate org income amount (not deducted from prizes)
    const bracketFixedPrizesOrgCut = bracketFixedPrizes && pollOrgCutFixed != null && pollOrgCutFixed > 0 ? pollOrgCutFixed : 0;
    const orgCut = bracketFixedPrizes ? 0 : (hasPollOrgCut
        ? pollOrgCutFixed!
        : orgCutMode === "percent"
            ? (isRanked ? (settings.rankedOrgCutPercent ?? 0) : (settings.orgCutPercent ?? 0))
            : (isRanked ? (settings.rankedOrgCutFixed ?? 0) : (settings.orgCutFixed ?? 0)));

    const enableFund = isRanked
        ? (settings.rankedEnableFund ?? false)
        : (settings.enableFund ?? false);

    // ── Fetch all bracket matches grouped by round ───────────────
    const allMatches = await prisma.bracketMatch.findMany({
        where: { tournamentId: id, status: "CONFIRMED" },
        include: {
            player1: { select: { id: true, userId: true, displayName: true } },
            player2: { select: { id: true, userId: true, displayName: true } },
            winner: { select: { id: true, userId: true, displayName: true } },
        },
        orderBy: [{ round: "asc" }, { position: "asc" }],
    });

    if (allMatches.length === 0) {
        return NextResponse.json({ error: "No confirmed bracket matches found." }, { status: 400 });
    }

    // Compute max round (= final)
    const maxRound = Math.max(...allMatches.map(m => m.round));

    // Helper: get loser of a match
    const getLoser = (m: typeof allMatches[0]) => {
        if (!m.winnerId) return null;
        return m.winnerId === m.player1Id ? m.player2 : m.player1;
    };

    // Build ordered placements from bracket structure:
    // Pos 1 = final winner, Pos 2 = final runner-up
    // Pos 3+4 = semi-final losers, Pos 5-8 = quarter-final losers, etc.
    type BracketPlayer = { id: string; userId: string; displayName: string | null };
    const bracketPlacements: { position: number; player: BracketPlayer }[] = [];

    const finalMatches = allMatches.filter(m => m.round === maxRound);
    const semiMatches = allMatches.filter(m => m.round === maxRound - 1);
    const qfMatches = allMatches.filter(m => m.round === maxRound - 2);

    // 1st and 2nd from the actual Final (position 0 in the final round)
    // 3rd place match is position 1 in the same round — handle separately
    const actualFinal = finalMatches.filter(m => m.position === 0);
    const thirdPlaceMatch = finalMatches.filter(m => m.position === 1);

    for (const m of actualFinal) {
        if (m.winner) bracketPlacements.push({ position: 1, player: m.winner as BracketPlayer });
        const loser = getLoser(m);
        if (loser) bracketPlacements.push({ position: 2, player: loser as BracketPlayer });
    }

    // 3rd/4th from 3rd place match (if exists)
    let pos = 3;
    for (const m of thirdPlaceMatch) {
        if (m.winner) bracketPlacements.push({ position: pos++, player: m.winner as BracketPlayer });
        const loser = getLoser(m);
        if (loser) bracketPlacements.push({ position: pos++, player: loser as BracketPlayer });
    }

    // If no 3rd place match, derive 3rd/4th from semi-final losers
    if (thirdPlaceMatch.length === 0) {
        for (const m of semiMatches) {
            const loser = getLoser(m);
            if (loser) bracketPlacements.push({ position: pos++, player: loser as BracketPlayer });
        }
    }

    // 5th–8th from quarters
    for (const m of qfMatches) {
        const loser = getLoser(m);
        if (loser) bracketPlacements.push({ position: pos++, player: loser as BracketPlayer });
    }

    // ── Prize pool ────────────────────────────────────────────────
    const entryFee = tournament.fee ?? 0;
    const poolFee = pollForTournament?.prizePoolFee ?? entryFee;
    const totalPlayers = new Set(
        allMatches.flatMap(m => [m.player1Id, m.player2Id]).filter(Boolean)
    ).size;
    const donations = await prisma.prizePoolDonation.findMany({
        where: { tournamentId: id },
        select: { amount: true },
    });
    const totalDonations = donations.reduce((s, d) => s + d.amount, 0);
    const prizePool = bracketFixedPrizes
        ? bracketFixedPrizes.reduce((s, n) => s + n, 0) + totalDonations
        : poolFee * totalPlayers + totalDonations;

    // Org cut (computed based on mode)
    const orgAmount = orgCutMode === "percent"
        ? Math.floor(prizePool * (orgCut / 100))
        : Math.min(orgCut, prizePool);
    const remainingPool = prizePool - orgAmount;

    // ── Determine placements to award ────────────────────────────
    // If admin passes custom placements (with amounts), use those.
    // Otherwise default: 1st gets ~60%, 2nd gets ~25%, 3rd+ share rest.
    const defaultAmounts = buildBracketPrizeAmounts(remainingPool, Math.min(2, bracketPlacements.length));
    const placementsToUse: { position: number; amount: number; diamondAmount: number; playerId: string; userId: string; displayName: string | null }[] = [];

    if (customPlacements && customPlacements.length > 0) {
        // Admin-specified placements — player is picked from bracketPlacements or custom players array
        for (const cp of customPlacements) {
            if (cp.players && cp.players.length > 0) {
                // Custom override: admin specified exact player + amount
                for (const pp of cp.players) {
                    const p = await prisma.player.findUnique({
                        where: { id: pp.playerId },
                        select: { id: true, userId: true, displayName: true },
                    });
                    if (p) placementsToUse.push({ position: cp.position, amount: pp.amount, diamondAmount: cp.diamondAmount ?? 0, playerId: p.id, userId: p.userId, displayName: p.displayName });
                }
            } else {
                // Derive player from bracket structure
                const bp = bracketPlacements.find(b => b.position === cp.position);
                if (bp) placementsToUse.push({ position: cp.position, amount: cp.amount, diamondAmount: cp.diamondAmount ?? 0, playerId: bp.player.id, userId: bp.player.userId, displayName: bp.player.displayName });
            }
        }
    } else {
        // Auto from bracket results
        for (const bp of bracketPlacements.filter(b => b.position <= 2)) {
            const amount = defaultAmounts.get(bp.position) ?? 0;
            placementsToUse.push({ position: bp.position, amount, diamondAmount: 0, playerId: bp.player.id, userId: bp.player.userId, displayName: bp.player.displayName });
        }
    }

    if (placementsToUse.length === 0) {
        return NextResponse.json({ error: "Could not determine bracket placements. Ensure at least the final match is confirmed." }, { status: 400 });
    }

    // ── Repeat winner tax (if Fund enabled) ──────────────────────
    const winnerIds = placementsToUse.filter(p => p.position === 1).map(p => p.playerId);
    const recentWins = await getPlayerRecentWins(winnerIds, tournament.seasonId ?? "", 6);

    const finalPlacements = placementsToUse.map(p => {
        let finalAmount = p.amount;
        let taxAmount = 0;
        if (enableFund && p.position === 1) {
            const prevWins = recentWins.get(p.playerId) ?? 0;
            const tax = calculateRepeatWinnerTax(p.playerId, p.amount, prevWins + 1);
            finalAmount = tax.netAmount;
            taxAmount = tax.taxAmount;
        }
        return { ...p, finalAmount, taxAmount };
    });

    const totalTax = finalPlacements.reduce((s, p) => s + p.taxAmount, 0);
    const finalFund = enableFund ? totalTax : 0;
    const finalOrg = orgAmount;

    // ── DRY RUN ───────────────────────────────────────────────────
    if (dryRun) {
        return NextResponse.json({
            success: true,
            dryRun: true,
            data: {
                finalOrg,
                finalFund,
                prizePool,
                totalPlayers,
                winners: finalPlacements.map(p => ({
                    position: p.position,
                    teamAmount: p.amount,
                    playerName: p.displayName,
                    players: [{ playerId: p.playerId, finalAmount: p.finalAmount, repeatTax: p.taxAmount, soloTax: 0 }],
                })),
            },
        });
    }

    // ── Write to DB ───────────────────────────────────────────────
    await prisma.$transaction(async (tx) => {
        for (const p of finalPlacements) {
            // Each 1v1 player is their own "team" in the winners table
            // Find or create a solo team for them for this tournament
            let soloTeam = await tx.team.findFirst({
                where: { tournamentId: id, players: { some: { id: p.playerId } } },
            });
            if (!soloTeam) {
                const existingCount = await tx.team.count({ where: { tournamentId: id } });
                soloTeam = await tx.team.create({
                    data: {
                        name: p.displayName || "Unknown",
                        tournamentId: id,
                        teamNumber: existingCount + 1,
                        players: { connect: { id: p.playerId } },
                    },
                });
            }

            await tx.tournamentWinner.create({
                data: {
                    amount: p.amount,
                    position: p.position,
                    team: { connect: { id: soloTeam.id } },
                    tournament: { connect: { id } },
                    isDistributed: true,
                },
            });

            await tx.pendingReward.create({
                data: {
                    playerId: p.playerId,
                    type: "WINNER",
                    amount: p.finalAmount,
                    diamondAmount: p.diamondAmount ?? 0,
                    position: p.position,
                    message: `${getOrdinal(p.position)} Place - ${tournament.name}${tournament.season?.name ? ` · ${tournament.season.name}` : ''}`,
                    details: {
                        tournamentId: id,
                        tournamentName: tournament.name,
                        teamPrize: p.amount,
                        playerCount: 1,
                        baseShare: p.amount,
                        participationAdj: 0,
                        matchesPlayed: 1,
                        totalMatches: allMatches.length,
                        repeatTax: p.taxAmount,
                        soloTax: 0,
                        wasRepeatWinner: p.taxAmount > 0,
                        wasSolo: false,
                        diamondAmount: p.diamondAmount ?? 0,
                    },
                },
            });
        }

        // Income records
        if (finalOrg > 0) {
            await tx.income.create({
                data: { amount: finalOrg, description: `Org - ${tournament.name}`, tournamentId: id, tournamentName: tournament.name, createdBy: "system" },
            });
        }
        if (finalFund > 0) {
            await tx.income.create({
                data: { amount: finalFund, description: `Fund - ${tournament.name} (repeat winner tax)`, tournamentId: id, tournamentName: tournament.name, createdBy: "system" },
            });
        }

        // Fixed prizes org cut: recorded separately (not deducted from prizes)
        if (bracketFixedPrizesOrgCut > 0) {
            await tx.income.create({
                data: { amount: bracketFixedPrizesOrgCut, description: `Org - ${tournament.name} (fixed prizes)`, tournamentId: id, tournamentName: tournament.name, createdBy: "system" },
            });
        }

        await tx.tournament.update({
            where: { id },
            data: { isWinnerDeclared: true, status: "INACTIVE" },
        });
    }, { timeout: 30000, maxWait: 35000 });

    // Auto-delete tournament Discord channels
    if ((tournament as any).discordChannelId) {
        deleteTournamentChannel((tournament as any).discordChannelId)
            .catch((err) => console.error("Discord channel deletion error:", err));
    }
    const groupChs = ((tournament as any).discordGroupChannels as Record<string, string>) || {};
    for (const chId of Object.values(groupChs)) {
        deleteTournamentChannel(chId)
            .catch((err) => console.error("Discord group channel deletion error:", err));
    }

    // Clean old standings messages (keeps Discord lightweight)
    const standingsChId = process.env.DISCORD_STANDINGS_CHANNEL_ID;
    if (standingsChId) {
        cleanOldChannelMessages(standingsChId, 14)
            .then((n) => n > 0 && console.log(`[discord] Cleaned ${n} old standings messages`))
            .catch((err) => console.error("Discord standings cleanup error:", err));
    }

    return NextResponse.json({ success: true, message: "Bracket winners declared and rewards created" });
}

/** Split remainingPool into prize amounts for top N places (60/25/10/5 split) */
function buildBracketPrizeAmounts(pool: number, count: number): Map<number, number> {
    const ratios: Record<number, number[]> = {
        1: [1],
        2: [0.65, 0.35],
        3: [0.60, 0.25, 0.15],
        4: [0.55, 0.25, 0.12, 0.08],
    };
    const r = ratios[Math.min(count, 4)] ?? ratios[4];
    const map = new Map<number, number>();
    for (let i = 0; i < count; i++) {
        map.set(i + 1, Math.floor(pool * (r[i] ?? 0)));
    }
    return map;
}

// ── Helper functions (inlined from v1 services, optimized) ──

function getOrdinal(n: number): string {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Count recent wins per player in last N season tournaments */
async function getPlayerRecentWins(
    playerIds: string[], seasonId: string, limit: number,
    excludeTournamentId?: string, isSquadMode?: boolean
): Promise<Map<string, number>> {
    if (!playerIds.length) return new Map();

    const where: Record<string, unknown> = { isWinnerDeclared: true };
    if (seasonId) where.seasonId = seasonId;
    if (excludeTournamentId) where.id = { not: excludeTournamentId };
    // Filter by mode: only count wins from same tournament type
    if (isSquadMode === true) {
        where.poll = { allowSquads: true };
    } else if (isSquadMode === false) {
        where.poll = { allowSquads: false };
    }

    const recent = await prisma.tournament.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
            id: true,
            winners: {
                select: { teamId: true },
            },
        },
    });

    const counts = new Map<string, number>();
    for (const pid of playerIds) counts.set(pid, 0);

    // Collect ALL winning team IDs (any position that received UC counts)
    const winningTeamIds = new Set<string>();
    for (const t of recent) {
        for (const w of t.winners) {
            winningTeamIds.add(w.teamId);
        }
    }

    if (winningTeamIds.size === 0) return counts;

    // Find which players were on winning teams via TeamPlayerStats
    const winningPlayerStats = await prisma.teamPlayerStats.findMany({
        where: {
            teamId: { in: Array.from(winningTeamIds) },
            playerId: { in: playerIds },
        },
        select: { playerId: true, teamId: true },
        distinct: ["playerId", "teamId"],
    });

    // Count distinct winning teams per player
    const playerTeams = new Map<string, Set<string>>();
    for (const ps of winningPlayerStats) {
        if (!playerTeams.has(ps.playerId)) playerTeams.set(ps.playerId, new Set());
        playerTeams.get(ps.playerId)!.add(ps.teamId);
    }

    for (const [pid, teams] of playerTeams) {
        counts.set(pid, teams.size);
    }

    return counts;
}

/** Get top 3 loser tiers for a season */
async function getPlayerLosses(seasonId: string): Promise<{ lossAmount: number; playerIds: string[] }[]> {
    if (!seasonId) return [];

    const tournaments = await prisma.tournament.findMany({
        where: { seasonId },
        select: { id: true, name: true },
    });
    if (tournaments.length === 0) return [];

    const teams = await prisma.team.findMany({
        where: { tournamentId: { in: tournaments.map((t) => t.id) } },
        include: {
            players: {
                include: { transactions: true },
            },
        },
    });

    const playerLosses = new Map<string, number>();
    const tNames = tournaments.map((t) => t.name);

    for (const team of teams) {
        for (const player of team.players) {
            if (playerLosses.has(player.id)) continue;
            let fees = 0, prizes = 0;
            for (const tx of player.transactions) {
                const isSeasonTx = tNames.some((n) => tx.description.includes(n));
                if (!isSeasonTx) continue;
                if (tx.type === "DEBIT" && tx.description.toLowerCase().includes("entry")) fees += tx.amount;
                else if (tx.type === "CREDIT" && tx.description.toLowerCase().includes("prize")) prizes += tx.amount;
            }
            const loss = fees - prizes;
            if (loss > 0) playerLosses.set(player.id, loss);
        }
    }

    // Group by loss amount, sort desc, top 3
    const groups = new Map<number, string[]>();
    for (const [pid, loss] of playerLosses) {
        const existing = groups.get(loss) || [];
        existing.push(pid);
        groups.set(loss, existing);
    }

    return Array.from(groups.entries())
        .sort((a, b) => b[0] - a[0])
        .slice(0, 3)
        .map(([lossAmount, playerIds]) => ({ lossAmount, playerIds }));
}

/** Add to solo tax bonus pool */
async function addToSoloTaxPool(seasonId: string, amount: number, donorName?: string) {
    const existing = await prisma.soloTaxPool.findFirst({ where: { seasonId } });
    if (existing) {
        let name = existing.donorName;
        if (donorName && (!name || !name.includes(donorName))) {
            name = name ? `${name}, ${donorName}` : donorName;
        }
        await prisma.soloTaxPool.update({
            where: { id: existing.id },
            data: { amount: { increment: amount }, donorName: name },
        });
    } else {
        await prisma.soloTaxPool.create({ data: { seasonId, amount, donorName: donorName || null } });
    }
}

/** Consume the solo tax pool (reset to 0) */
async function consumeSoloTaxPool(seasonId: string) {
    const pool = await prisma.soloTaxPool.findFirst({ where: { seasonId } });
    if (pool && pool.amount > 0) {
        await prisma.soloTaxPool.update({ where: { id: pool.id }, data: { amount: 0, donorName: null } });
    }
}
