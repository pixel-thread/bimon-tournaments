import { prisma } from "@/lib/database";
import { requireSuperAdmin } from "@/lib/auth";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { generateBracket } from "@/lib/logic/generateBracket";
import { generateLeague } from "@/lib/logic/generateLeague";
import { generateGroupKnockout } from "@/lib/logic/generateGroupKnockout";
import { BRACKET_TYPES } from "@/lib/bracket-types";
import { type NextRequest } from "next/server";
import { debitWallet } from "@/lib/wallet-service";
import { GAME } from "@/lib/game-config";

/**
 * Largest power of 2 ≤ n.
 * e.g. 17 → 16, 15 → 8, 8 → 8, 4 → 4, 3 → 2
 */
function floorPow2(n: number): number {
    if (n < 2) return 0;
    let p = 2;
    while (p * 2 <= n) p *= 2;
    return p;
}

/**
 * Anti-collision seeding: reorder slots so that entries from the
 * same player are spread as far apart as possible in the bracket.
 * This minimizes same-player matchups in early rounds.
 */
function antiCollisionSeed(slots: { playerId: string; entryIndex: number }[]): typeof slots {
    // Group by player
    const groups = new Map<string, typeof slots>();
    for (const slot of slots) {
        if (!groups.has(slot.playerId)) groups.set(slot.playerId, []);
        groups.get(slot.playerId)!.push(slot);
    }

    // Sort groups by size (biggest first — spread them widest)
    const sortedGroups = [...groups.values()].sort((a, b) => b.length - a.length);

    // Place entries in interleaved positions
    const result: (typeof slots[0] | null)[] = new Array(slots.length).fill(null);
    for (const group of sortedGroups) {
        const spacing = Math.floor(slots.length / group.length);
        let placed = 0;
        for (const entry of group) {
            // Find the nearest open position from the ideal spot
            const idealPos = placed * spacing;
            let pos = idealPos;
            while (pos < result.length && result[pos] !== null) pos++;
            if (pos >= result.length) {
                // Wrap around and find first open slot
                pos = 0;
                while (pos < result.length && result[pos] !== null) pos++;
            }
            result[pos] = entry;
            placed++;
        }
    }

    return result.filter(Boolean) as typeof slots;
}

/**
 * POST /api/tournaments/[id]/generate-bracket
 * Generate matches from poll voters (FCFS).
 *
 * Supports:
 *   BRACKET_1V1    — Single elimination knockout
 *   LEAGUE         — Round-robin (everyone plays everyone)
 *   GROUP_KNOCKOUT — Groups of 4, round-robin → knockout
 *
 * Multi-entry (PES): players with voteCount > 1 are expanded into
 * separate slots with anti-collision seeding to avoid early matchups.
 */
export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireSuperAdmin();
        const { id } = await params;

        const tournament = await prisma.tournament.findUnique({
            where: { id },
            select: {
                id: true,
                type: true,
                status: true,
                fee: true,
                name: true,
                isTDM: true,
                isWoW: true,
                poll: {
                    select: {
                        id: true,
                        isActive: true,
                        votes: {
                            where: { vote: { in: ["IN", "SOLO"] } },
                            select: {
                                playerId: true,
                                createdAt: true,
                                voteCount: true,
                            },
                            orderBy: { createdAt: "asc" },
                        },
                        luckyVoterId: true,
                    },
                },
                bracketMatches: { select: { id: true }, take: 1 },
            },
        });

        if (!tournament) {
            return ErrorResponse({ message: "Tournament not found", status: 404 });
        }

        const VALID_TYPES: readonly string[] = BRACKET_TYPES;
        if (!VALID_TYPES.includes(tournament.type)) {
            return ErrorResponse({
                message: "This tournament type does not support match generation",
                status: 400,
            });
        }

        // Delete existing matches if any (allows regeneration)
        if (tournament.bracketMatches.length > 0) {
            await prisma.bracketMatch.deleteMany({
                where: { tournamentId: id },
            });
        }

        // ── TDM / WoW: use Teams (squads) instead of individual poll voters ──
        if (tournament.isTDM || tournament.isWoW) {
            const modeLabel = tournament.isWoW ? "WoW" : "TDM";
            const teams = await prisma.team.findMany({
                where: { tournamentId: id },
                select: { id: true, name: true, teamNumber: true },
                orderBy: { teamNumber: "asc" },
            });

            if (teams.length < 2) {
                return ErrorResponse({
                    message: `Need at least 2 teams for ${modeLabel} bracket. Currently ${teams.length} teams.`,
                    status: 400,
                });
            }

            // Close the poll if still active
            if (tournament.poll?.isActive) {
                await prisma.poll.update({
                    where: { id: tournament.poll.id },
                    data: { isActive: false },
                });
            }

            // Shuffle teams for random seeding
            const teamIds = teams.map(t => t.id);
            for (let i = teamIds.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [teamIds[i], teamIds[j]] = [teamIds[j], teamIds[i]];
            }

            // Dispatch to the right generator — pass team IDs as "player" slots
            let result: any;
            let message: string;

            switch (tournament.type) {
                case "BRACKET_1V1": {
                    const bracketSize = floorPow2(teamIds.length);
                    const includedIds = teamIds.slice(0, bracketSize);
                    const excludedCount = teamIds.length - bracketSize;
                    result = await generateBracket(id, includedIds, { skipShuffle: true });
                    result.excludedCount = excludedCount;
                    result.bracketSize = bracketSize;
                    message = excludedCount > 0
                        ? `${modeLabel} KO bracket generated! ${bracketSize} teams, ${excludedCount} excluded.`
                        : `${modeLabel} KO bracket generated! ${bracketSize} teams, ${result.totalRounds} rounds.`;
                    break;
                }
                case "LEAGUE": {
                    result = await generateLeague(id, teamIds);
                    const totalMatches = (teamIds.length * (teamIds.length - 1)) / 2;
                    message = `${modeLabel} League generated! ${teamIds.length} teams, ${totalMatches} matches across ${result.totalRounds} match days.`;
                    break;
                }
                case "GROUP_KNOCKOUT": {
                    if (teamIds.length < 4) {
                        return ErrorResponse({
                            message: `Need at least 4 teams for ${modeLabel} Group + Knockout. Currently ${teamIds.length}.`,
                            status: 400,
                        });
                    }
                    result = await generateGroupKnockout(id, teamIds);
                    message = `${modeLabel} Group + KO generated! ${result.numGroups} groups, then knockout.`;
                    break;
                }
                default:
                    return ErrorResponse({ message: `Unknown tournament type for ${modeLabel}`, status: 400 });
            }

            // Remap: move player1Id/player2Id → team1Id/team2Id for all generated matches
            const teamIdSet = new Set(teamIds);
            const generatedMatches = await prisma.bracketMatch.findMany({
                where: { tournamentId: id },
                select: { id: true, player1Id: true, player2Id: true },
            });

            for (const match of generatedMatches) {
                await prisma.bracketMatch.update({
                    where: { id: match.id },
                    data: {
                        team1Id: match.player1Id && teamIdSet.has(match.player1Id) ? match.player1Id : null,
                        team2Id: match.player2Id && teamIdSet.has(match.player2Id) ? match.player2Id : null,
                        player1Id: null,
                        player2Id: null,
                    },
                });
            }

            // Debit entry fees for TDM — charge per team (captain pays)
            const entryFee = tournament.fee ?? 0;
            if (entryFee > 0) {
                const teamsWithPlayers = await prisma.team.findMany({
                    where: { id: { in: teamIds } },
                    select: {
                        id: true,
                        players: {
                            select: { id: true, isUCExempt: true, user: { select: { email: true } } },
                        },
                    },
                });
                // Find captains via Squad model — only confirmed squads (exclude waitlisted)
                const pollId = tournament.poll?.id;
                if (pollId) {
                    const maxSquads = GAME.maxSquadTeams;
                    const squads = await prisma.squad.findMany({
                        where: { pollId },
                        select: {
                            captainId: true,
                            createdAt: true,
                            captain: { select: { isUCExempt: true, user: { select: { email: true } } } },
                        },
                        orderBy: { createdAt: "asc" },
                        take: maxSquads, // Only confirmed squads, not waitlisted
                    });
                    const luckyVoterId = tournament.poll?.luckyVoterId;
                    for (const squad of squads) {
                        if (squad.captain.isUCExempt || squad.captainId === luckyVoterId) continue;
                        const email = squad.captain.user?.email;
                        if (email) {
                            try {
                                await debitWallet(email, entryFee, `Entry fee for ${tournament.name} (${modeLabel})`, "TOURNAMENT_ENTRY");
                            } catch (err) {
                                console.error(`[generate-bracket] Failed to debit captain ${squad.captainId}:`, err);
                            }
                        }
                    }
                }
            }

            return SuccessResponse({ data: result, message });
        }

        // ── Standard PES / 1v1 flow: use poll voters ──
        if (!tournament.poll) {
            return ErrorResponse({ message: "No poll found for this tournament", status: 400 });
        }

        // Build voter list — expand multi-entry players into separate slots
        type VoterSlot = { playerId: string; entryIndex: number };
        const voterSlots: VoterSlot[] = [];
        for (const v of tournament.poll.votes) {
            for (let i = 0; i < v.voteCount; i++) {
                voterSlots.push({ playerId: v.playerId, entryIndex: i + 1 });
            }
        }

        if (voterSlots.length < 2) {
            return ErrorResponse({
                message: `Need at least 2 entries. Currently ${voterSlots.length} voted IN.`,
                status: 400,
            });
        }

        // Close the poll if still active
        if (tournament.poll.isActive) {
            await prisma.poll.update({
                where: { id: tournament.poll.id },
                data: { isActive: false },
            });
        }

        // Apply anti-collision seeding for multi-entry players
        const seededSlots = antiCollisionSeed(voterSlots);
        const seededPlayerIds = seededSlots.map(s => s.playerId);

        // Check if multi-entry expansion happened (preserve anti-collision seeding)
        const hasMultiEntries = voterSlots.length > tournament.poll!.votes.length;

        // Dispatch to the right generator
        let result: any;
        let message: string;

        switch (tournament.type) {
            case "BRACKET_1V1": {
                const bracketSize = floorPow2(seededPlayerIds.length);
                const includedIds = seededPlayerIds.slice(0, bracketSize);
                const excludedCount = seededPlayerIds.length - bracketSize;

                result = await generateBracket(id, includedIds, { skipShuffle: hasMultiEntries });
                result.excludedCount = excludedCount;
                result.bracketSize = bracketSize;

                message = excludedCount > 0
                    ? `Knockout bracket generated! ${bracketSize} entries included, ${excludedCount} excluded (voted too late).`
                    : `Knockout bracket generated! ${bracketSize} entries, ${result.totalRounds} rounds.`;
                break;
            }

            case "LEAGUE": {
                result = await generateLeague(id, seededPlayerIds);
                const totalMatches = (seededPlayerIds.length * (seededPlayerIds.length - 1)) / 2;
                message = `League generated! ${seededPlayerIds.length} entries, ${totalMatches} matches across ${result.totalRounds} match days.`;
                break;
            }

            case "GROUP_KNOCKOUT": {
                if (seededPlayerIds.length < 4) {
                    return ErrorResponse({
                        message: `Need at least 4 entries for Group + Knockout. Currently ${seededPlayerIds.length}.`,
                        status: 400,
                    });
                }
                result = await generateGroupKnockout(id, seededPlayerIds);
                message = `Group + Knockout generated! ${result.numGroups} groups of ${result.groupSize}, then knockout (${result.knockoutPlayers} players).`;
                break;
            }

            default:
                return ErrorResponse({ message: "Unknown tournament type", status: 400 });
        }

        // Debit entry fees — charge entryFee × voteCount per player
        const entryFee = tournament.fee ?? 0;
        if (entryFee > 0) {
            const luckyVoterId = tournament.poll.luckyVoterId;

            // Build map: playerId → total entries
            const playerEntryMap = new Map<string, number>();
            for (const v of tournament.poll.votes) {
                playerEntryMap.set(v.playerId, v.voteCount);
            }

            const playerIds = [...playerEntryMap.keys()];
            const players = await prisma.player.findMany({
                where: { id: { in: playerIds } },
                select: { id: true, isUCExempt: true, user: { select: { email: true } } },
            });

            const playersToCharge = players.filter(
                (p) => !p.isUCExempt && p.id !== luckyVoterId
            );

            if (playersToCharge.length > 0) {
                const BATCH = 5;
                for (let i = 0; i < playersToCharge.length; i += BATCH) {
                    const batch = playersToCharge.slice(i, i + BATCH);
                    await Promise.all(
                        batch.map(async (p) => {
                            const email = p.user?.email;
                            const entries = playerEntryMap.get(p.id) ?? 1;
                            const totalFee = entryFee * entries;
                            if (email) {
                                try {
                                    await debitWallet(
                                        email,
                                        totalFee,
                                        entries > 1
                                            ? `Entry fee for ${tournament.name} (${entries} entries)`
                                            : `Entry fee for ${tournament.name}`,
                                        "TOURNAMENT_ENTRY",
                                    );
                                } catch (err) {
                                    console.error(`[generate-bracket] Failed to debit ${p.id}:`, err);
                                }
                            }
                        })
                    );
                }
            }
        }

        return SuccessResponse({
            data: result,
            message,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to generate matches", error });
    }
}
