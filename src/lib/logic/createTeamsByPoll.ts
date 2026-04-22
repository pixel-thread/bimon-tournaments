import { prisma } from "@/lib/database";
import { shuffle } from "./shuffle";
import {
    createBalancedDuos,
    createBalancedTrios,
    createBalancedQuads,
    analyzeTeamBalance,
    TeamStats,
} from "./teamBalancer";
import { computeWeightedScore, PlayerWithWins, SeasonScoringConfig } from "./scoreUtil";
import { PlayerWithWeightT } from "@/types/models";
import { getPreviousTournamentTeammates } from "./previousTeammates";
import { isBirthdayWithinWindow } from "./birthdayCheck";
import { debitWallet, getEmailByPlayerId } from "@/lib/wallet-service";
import { getActiveCoupon, redeemCoupon } from "@/lib/logic/welcomeBack";
import { GAME } from "@/lib/game-config";

// ─── Types ───────────────────────────────────────────────────

type PreviewTeamInput = {
    teamNumber: number;
    playerIds: string[];
};

type Props = {
    groupSize: 1 | 2 | 3 | 4;
    tournamentId: string;
    seasonId: string;
    pollId: string;
    entryFee?: number;
    previewTeams?: PreviewTeamInput[];
    dryRun?: boolean;
};

type DryRunData = {
    teams: TeamStats[];
    tournamentName: string;
};

export type CreateTeamsByPollsResult = {
    teamsCreated: number;
    playersAssigned: number;
    matchId: string;
    entryFeeCharged: number;
    squadsRegistered: number;
    squadsCancelled: number;
    dryRunData?: DryRunData;
};

// Helper to process promises in batches (PgBouncer safe)
async function processBatches<T, R>(
    items: T[],
    batchSize: number,
    processor: (item: T) => Promise<R>
): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(processor));
        results.push(...batchResults);
    }
    return results;
}

// ─── Service ─────────────────────────────────────────────────

export async function createTeamsByPoll({
    groupSize,
    pollId,
    tournamentId,
    seasonId,
    entryFee = 0,
    previewTeams,
    dryRun = false,
}: Props): Promise<CreateTeamsByPollsResult> {
    if (![1, 2, 3, 4].includes(groupSize)) {
        throw new Error("Invalid group size");
    }

    // Race-condition guard: prevent duplicate team generation
    if (!dryRun) {
        const existingTeams = await prisma.team.count({ where: { tournamentId } });
        if (existingTeams > 0) {
            throw new Error("Teams already exist for this tournament. Refresh the page to see them.");
        }

        // Clean up orphaned empty matches (no teams attached) from previous manual creates
        // This prevents "Match 1 is empty" when generating from polls
        const orphanMatches = await prisma.match.findMany({
            where: { tournamentId, teams: { none: {} } },
            select: { id: true },
        });
        if (orphanMatches.length > 0) {
            const orphanIds = orphanMatches.map((m) => m.id);
            // Delete any dependent records first
            await prisma.teamPlayerStats.deleteMany({ where: { matchId: { in: orphanIds } } });
            await prisma.teamStats.deleteMany({ where: { matchId: { in: orphanIds } } });
            await prisma.matchPlayerPlayed.deleteMany({ where: { matchId: { in: orphanIds } } });
            await prisma.match.deleteMany({ where: { id: { in: orphanIds } } });
            console.log(`[createTeamsByPoll] Cleaned up ${orphanMatches.length} orphan match(es)`);
        }
    }

    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { name: true },
    });
    const tournamentName = tournament?.name ?? "Tournament";

    // Get lucky voter from the poll
    let luckyVoterId: string | null = null;
    let pollAllowSquads = false;
    if (pollId) {
        const poll = await prisma.poll.findUnique({
            where: { id: pollId },
            select: { luckyVoterId: true, allowSquads: true },
        });
        luckyVoterId = poll?.luckyVoterId || null;
        pollAllowSquads = poll?.allowSquads ?? false;
    }

    // Season scoring config
    const tournamentCountInSeason = await prisma.tournament.count({
        where: { seasonId },
    });

    const currentSeason = await prisma.season.findUnique({
        where: { id: seasonId },
        select: { startDate: true },
    });

    let previousSeasonId: string | undefined;
    if (currentSeason) {
        const previousSeason = await prisma.season.findFirst({
            where: { startDate: { lt: currentSeason.startDate } },
            orderBy: { startDate: "desc" },
            select: { id: true },
        });
        previousSeasonId = previousSeason?.id;
    }

    const seasonScoringConfig: SeasonScoringConfig = {
        currentSeasonId: seasonId,
        previousSeasonId,
        tournamentCountInSeason,
    };

    // Fetch eligible players
    const players = await prisma.player.findMany({
        where: {
            isBanned: false,
            pollVotes: {
                some: {
                    pollId,
                    vote: { not: "OUT" },
                },
            },
        },
        include: {
            stats: true,
            pollVotes: true,
            user: true,
            wallet: true,
        },
    });

    if (players.length === 0) {
        throw new Error("No eligible players found for this poll.");
    }

    // ─── Squad processing ─────────────────────────────────────────
    // FULL squads → premade teams, FORMING squads → cancelled
    let squadTeams: TeamStats[] = [];
    let squadPlayerIds = new Set<string>();
    let squadsRegistered = 0;
    let squadsCancelled = 0;
    let squadPlayersToCharge: { id: string; email?: string }[] = [];

    if (pollAllowSquads) {
        const squads = await prisma.squad.findMany({
            where: {
                pollId,
                status: { in: ["FORMING", "FULL"] },
            },
            include: {
                captain: {
                    include: {
                        user: true,
                        wallet: true,
                    },
                },
                invites: {
                    where: { status: "ACCEPTED" },
                    include: {
                        player: {
                            include: {
                                stats: true,
                                user: true,
                                wallet: true,
                            },
                        },
                    },
                },
            },
        });

        for (const squad of squads) {
            if (squad.status === "FULL") {
                // Convert FULL squad to a premade team
                const members = squad.invites.map((inv) => inv.player);
                const totalKills = members.reduce((sum, p) => {
                    const stats = p.stats?.find((s: any) => s.seasonId === seasonId);
                    return sum + (stats?.kills ?? 0);
                }, 0);

                squadTeams.push({
                    players: members as unknown as PlayerWithWeightT[],
                    totalKills,
                    totalDeaths: 0,
                    totalWins: 0,
                    weightedScore: 0, // premade teams don't need balancing
                });

                for (const m of members) {
                    squadPlayerIds.add(m.id);
                }

                // Captain pays the full team entry fee (UC exempt doesn't apply in squad polls)
                squadPlayersToCharge.push({
                    id: squad.captain.id,
                    email: squad.captain.user?.email ?? undefined,
                });

                // Mark squad as REGISTERED (skip in dry run)
                if (!dryRun) {
                    await prisma.squad.update({
                        where: { id: squad.id },
                        data: { status: "REGISTERED" },
                    });
                }
                squadsRegistered++;
            } else {
                // Cancel FORMING squads — fees were only reserved, nothing to refund
                if (!dryRun) {
                    await prisma.squad.update({
                        where: { id: squad.id },
                        data: { status: "CANCELLED" },
                    });
                }
                squadsCancelled++;
            }
        }
    }

    // Exclude squad members from the regular team generation pool
    const nonSquadPlayers = players.filter((p) => !squadPlayerIds.has(p.id));

    // SOLO voters
    const playersWhoVotedSolo = players.filter((p) =>
        p.pollVotes.some((vote) => vote.pollId === pollId && vote.vote === "SOLO"),
    );
    // Count recent wins per player (from TournamentWinner in current season)
    const recentWinners = await prisma.tournamentWinner.findMany({
        where: {
            tournament: { seasonId },
            team: { players: { some: { id: { in: nonSquadPlayers.map(p => p.id) } } } },
        },
        select: {
            team: { select: { players: { select: { id: true } } } },
        },
    });
    const winCountMap = new Map<string, number>();
    for (const w of recentWinners) {
        for (const p of w.team.players) {
            winCountMap.set(p.id, (winCountMap.get(p.id) ?? 0) + 1);
        }
    }

    // Compute weighted scores — map v2 stats format
    // Compute KD dynamically (kills/matches) — stored kd field may be stale
    const playersWithScore = nonSquadPlayers.map((p) => {
        const playerStats = p.stats.map((s) => {
            const dynamicKd = s.matches > 0 ? s.kills / s.matches : 0;
            return {
                seasonId: s.seasonId,
                kills: s.kills,
                kd: dynamicKd,
                deaths: dynamicKd > 0 ? Math.round(s.kills / dynamicKd) : 0,
            };
        });

        const playerWithWins: PlayerWithWins = {
            ...p,
            stats: playerStats as any,       // Override stale DB stats
            playerStats: playerStats as any,
            recentWins: winCountMap.get(p.id) ?? 0,
        } as any;

        return {
            ...p,
            playerStats: playerStats as any,
            weightedScore: computeWeightedScore(playerWithWins, seasonScoringConfig),
        };
    });

    let teams: TeamStats[] = [];
    const BATCH_SIZE = 5;

    if (previewTeams && previewTeams.length > 0) {
        // Use confirmed preview teams
        const playerMap = new Map(playersWithScore.map((p) => [p.id, p]));

        for (const previewTeam of previewTeams) {
            const teamPlayers: any[] = [];
            for (const playerId of previewTeam.playerIds) {
                const player = playerMap.get(playerId);
                if (player) teamPlayers.push(player);
            }
            if (teamPlayers.length > 0) {
                const totalKills = teamPlayers.reduce((sum, p) => {
                    const stats = p.stats?.find((s: any) => s.seasonId === seasonId);
                    return sum + (stats?.kills ?? 0);
                }, 0);
                const weightedScore = teamPlayers.reduce((sum: number, p: any) => sum + (p.weightedScore ?? 0), 0);
                teams.push({
                    players: teamPlayers as unknown as PlayerWithWeightT[],
                    totalKills,
                    totalDeaths: 0,
                    totalWins: 0,
                    weightedScore,
                });
            }
        }
    } else {
        // Generate teams from scratch
        const soloPlayers: typeof playersWithScore = [];
        let playersForTeams: typeof playersWithScore = [];

        for (const p of playersWithScore) {
            const isSoloVoter = playersWhoVotedSolo.some((solo) => solo.id === p.id);
            const isSoloRestricted = (p as any).isSoloRestricted === true;
            if (isSoloVoter || isSoloRestricted) {
                soloPlayers.push(p);
            } else {
                playersForTeams.push(p);
            }
        }

        // Handle leftovers when player count isn't perfectly divisible by team size.
        // Squad polls: exclude leftovers entirely (can't play with incomplete team)
        // BR games (BGMI/FF): late voters play solo (they still participate).
        // Non-BR games (PES/MLBB): exclude late voters to prevent friends gaming the system.
        if (groupSize > 1 && playersForTeams.length % groupSize !== 0) {
            const remainder = playersForTeams.length % groupSize;

            // Sort by vote time ascending (earliest first = safe)
            playersForTeams.sort((a, b) => {
                const aVote = a.pollVotes.find((v: any) => v.pollId === pollId);
                const bVote = b.pollVotes.find((v: any) => v.pollId === pollId);
                const aTime = aVote?.createdAt ? new Date(aVote.createdAt).getTime() : Infinity;
                const bTime = bVote?.createdAt ? new Date(bVote.createdAt).getTime() : Infinity;
                return aTime - bTime;
            });

            // Remove the last N players (latest voters)
            const lateVoters = playersForTeams.splice(playersForTeams.length - remainder, remainder);

            if (pollAllowSquads) {
                // Squad polls: exclude leftovers — can't play with incomplete squad
                console.log(
                    `[createTeamsByPoll] Squad poll: excluded ${lateVoters.length} leftover random(s): ${lateVoters.map(p => p.displayName ?? p.id).join(", ")}`
                );
            } else if (GAME.features.hasBR) {
                // BR games (BGMI/FF): late voters play as solo teams instead of being excluded
                soloPlayers.push(...lateVoters);
                console.log(
                    `[createTeamsByPoll] Late voter(s) moved to solo: ${lateVoters.map(p => p.displayName ?? p.id).join(", ")}`
                );
            } else {
                // PES/MLBB: exclude late voters entirely
                console.log(
                    `[createTeamsByPoll] Excluded ${lateVoters.length} player(s) (last to vote): ${lateVoters.map(p => p.displayName ?? p.id).join(", ")}`
                );
            }
        }

        playersForTeams = shuffle(playersForTeams);

        const teamCount = Math.floor(playersForTeams.length / groupSize);
        if (teamCount === 0 && soloPlayers.length === 0 && squadTeams.length === 0) {
            throw new Error("Not enough players to form teams.");
        }

        if (teamCount > 0) {
            const previousTeammates = await getPreviousTournamentTeammates(
                seasonId,
                tournamentId,
                playersForTeams.map((p) => p.id),
                2, // Avoid teammates from last 2 tournaments
            );
            const asWeighted = playersForTeams as unknown as PlayerWithWeightT[];
            if (groupSize === 2) teams = createBalancedDuos(asWeighted, seasonId, previousTeammates);
            else if (groupSize === 3) teams = createBalancedTrios(asWeighted, seasonId, previousTeammates);
            else if (groupSize === 4) teams = createBalancedQuads(asWeighted, seasonId, previousTeammates);
        }

        // Solo teams
        for (const soloPlayer of soloPlayers) {
            const stats = soloPlayer.stats.find((s) => s.seasonId === seasonId);
            teams.push({
                players: [soloPlayer as unknown as PlayerWithWeightT],
                totalKills: stats?.kills ?? 0,
                totalDeaths: 0,
                totalWins: 0,
                weightedScore: soloPlayer.weightedScore,
            });
        }

        analyzeTeamBalance(teams);
        teams = shuffle(teams);
    }

    // Validate
    // Add squad premade teams to the list
    teams = [...squadTeams, ...teams];
    const allTeamPlayerIds = new Set(teams.flatMap((t) => t.players.map((p) => p.id)));
    if (luckyVoterId && !allTeamPlayerIds.has(luckyVoterId)) {
        luckyVoterId = null;
    }

    // ── Dry run: return team data without DB writes ──────────
    if (dryRun) {
        return {
            teamsCreated: teams.length,
            playersAssigned: allTeamPlayerIds.size,
            matchId: "",
            entryFeeCharged: entryFee,
            squadsRegistered,
            squadsCancelled,
            dryRunData: { teams, tournamentName },
        };
    }

    // Track players to charge (populated inside transaction, used after)
    let playersToChargeList: any[] = [];

    // Persist in transaction
    const result = await prisma.$transaction(
        async (tx) => {
            // Create match
            const existingMatchCount = await tx.match.count({ where: { tournamentId } });
            const match = await tx.match.create({
                data: { tournamentId, seasonId, matchNumber: existingMatchCount + 1 },
            });

            // Create teams in batches
            const createdTeamData: { teamId: string; originalTeam: TeamStats }[] = [];

            for (let i = 0; i < teams.length; i += BATCH_SIZE) {
                const batch = teams.slice(i, i + BATCH_SIZE);
                const batchPromises = batch.map((t, batchIdx) => {
                    const teamIdx = i + batchIdx;
                    return tx.team.create({
                        data: {
                            name: `Team ${teamIdx + 1}`,
                            teamNumber: teamIdx + 1,
                            tournamentId,
                            seasonId,
                            players: { connect: t.players.map((p) => ({ id: p.id })) },
                            matches: { connect: { id: match.id } },
                        },
                        select: { id: true },
                    });
                });
                const batchResults = await Promise.all(batchPromises);
                batchResults.forEach((team, batchIdx) => {
                    createdTeamData.push({ teamId: team.id, originalTeam: batch[batchIdx] });
                });
            }

            // Create TeamStats
            const teamStats = await processBatches(
                createdTeamData,
                BATCH_SIZE,
                ({ teamId }) =>
                    tx.teamStats.create({
                        data: {
                            teamId,
                            matchId: match.id,
                            seasonId,
                            tournamentId,
                        },
                    }),
            );

            const allPlayers = teams.flatMap((t) => t.players);

            // Upsert PlayerStats
            await processBatches(allPlayers, BATCH_SIZE, (player) =>
                tx.playerStats.upsert({
                    where: {
                        seasonId_playerId: { playerId: player.id, seasonId },
                    },
                    create: { playerId: player.id, seasonId, kills: 0, matches: 0, kd: 0 },
                    update: {},
                }),
            );

            // Mark players to charge (skip lucky voter, birthday, UC-exempt)
            // Actual debit happens AFTER the transaction commits (see below)
            if (entryFee > 0) {
                const birthdayPlayerIds = new Set<string>();
                for (const player of allPlayers) {
                    const dateOfBirth = (player as any).user?.dateOfBirth;
                    if (dateOfBirth && isBirthdayWithinWindow(dateOfBirth)) {
                        birthdayPlayerIds.add(player.id);
                    }
                }

                playersToChargeList = allPlayers.filter(
                    (player) =>
                        // UC exempt doesn't apply in squad polls — everyone pays their share
                        (!player.isUCExempt || pollAllowSquads) &&
                        player.id !== luckyVoterId &&
                        !birthdayPlayerIds.has(player.id),
                );
            }

            // Create MatchPlayerPlayed entries
            const matchPlayerPlayedData = createdTeamData.flatMap(({ teamId, originalTeam }) =>
                originalTeam.players.map((player) => ({
                    matchId: match.id,
                    playerId: player.id,
                    tournamentId,
                    seasonId,
                    teamId,
                })),
            );
            await tx.matchPlayerPlayed.createMany({ data: matchPlayerPlayedData });

            // Connect teamStats to players and players to match
            for (let i = 0; i < createdTeamData.length; i += BATCH_SIZE) {
                const batchEnd = Math.min(i + BATCH_SIZE, createdTeamData.length);
                const promises: Promise<unknown>[] = [];

                for (let j = i; j < batchEnd; j++) {
                    const { originalTeam } = createdTeamData[j];
                    const teamStat = teamStats[j];

                    promises.push(
                        tx.teamStats.update({
                            where: { id: teamStat.id },
                            data: { players: { connect: originalTeam.players.map((p) => ({ id: p.id })) } },
                        }),
                    );

                    for (const player of originalTeam.players) {
                        promises.push(
                            tx.player.update({
                                where: { id: player.id },
                                data: { matches: { connect: { id: match.id } } },
                            }),
                        );
                    }
                }

                await Promise.all(promises);
            }

            return {
                matchId: match.id,
                teamsCreated: createdTeamData.length,
                playersAssigned: allTeamPlayerIds.size,
            };
        },
        {
            maxWait: 60000,
            timeout: 600000,
        },
    );

    // ── Post-transaction: debit wallets ──────────────────────────
    // Must happen OUTSIDE the prisma transaction because central wallet
    // is a separate database (Neon). This ensures the game DB records
    // For squad tournaments, fee is per-team — random players pay their share
    // Squad captains pay the full entryFee (handled separately below)
    const perPlayerFee = pollAllowSquads
        ? Math.floor(entryFee / (GAME.squadSize === 5 ? 5 : groupSize)) // MLBB always /5, BGMI/FF uses groupSize
        : entryFee; // Regular tournaments: fee is per-player

    if (perPlayerFee > 0 && playersToChargeList.length > 0) {
        await processBatches(playersToChargeList, BATCH_SIZE, async (player) => {
            const email = (player as any).user?.email || await getEmailByPlayerId(player.id);
            if (email) {
                try {
                    // Check for welcome back coupon
                    const coupon = await getActiveCoupon(player.id);
                    if (coupon) {
                        const discount = Math.min(coupon.amount, perPlayerFee);
                        const remaining = perPlayerFee - discount;
                        await redeemCoupon(coupon.id, tournamentId);
                        if (remaining > 0) {
                            await debitWallet(
                                email,
                                remaining,
                                `Entry fee for ${tournamentName} (${discount} ${GAME.currency} welcome back coupon applied)`,
                                "TOURNAMENT_ENTRY",
                            );
                        }
                        console.log(`[createTeamsByPoll] Welcome back coupon applied for ${player.id}: ${discount} ${GAME.currency} off (${remaining} ${GAME.currency} charged)`);
                    } else {
                        await debitWallet(email, perPlayerFee, `Entry fee for ${tournamentName}`, "TOURNAMENT_ENTRY");
                    }
                } catch (err) {
                    console.error(`[createTeamsByPoll] Failed to debit wallet for ${player.id}:`, err);
                }
            }
        });
    }

    // Debit squad members (same entry fee + coupon check, post-transaction)
    if (entryFee > 0 && squadPlayersToCharge.length > 0) {
        await processBatches(squadPlayersToCharge, BATCH_SIZE, async (member) => {
            const email = member.email || await getEmailByPlayerId(member.id);
            if (email) {
                try {
                    const coupon = await getActiveCoupon(member.id);
                    if (coupon) {
                        const discount = Math.min(coupon.amount, entryFee);
                        const remaining = entryFee - discount;
                        await redeemCoupon(coupon.id, tournamentId);
                        if (remaining > 0) {
                            await debitWallet(
                                email,
                                remaining,
                                `Squad entry fee for ${tournamentName} (${discount} ${GAME.currency} welcome back coupon applied)`,
                                "TOURNAMENT_ENTRY",
                            );
                        }
                        console.log(`[createTeamsByPoll] Welcome back coupon applied for squad member ${member.id}: ${discount} ${GAME.currency} off`);
                    } else {
                        await debitWallet(email, entryFee, `Squad entry fee for ${tournamentName}`, "TOURNAMENT_ENTRY");
                    }
                } catch (err) {
                    console.error(`[createTeamsByPoll] Failed to debit squad member ${member.id}:`, err);
                }
            }
        });
    }

    // Auto-deactivate the poll — voting is closed once teams are confirmed
    await prisma.poll.update({
        where: { id: pollId },
        data: { isActive: false },
    });

    return {
        ...result,
        entryFeeCharged: entryFee,
        squadsRegistered,
        squadsCancelled,
    };
}
