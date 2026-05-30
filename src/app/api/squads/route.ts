import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCurrentUser, getAuthEmail } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { getConfirmedSquadCap } from "@/lib/logic/championship";
import { getAvailableBalance } from "@/lib/wallet-service";
import { grantRole } from "@/lib/discord-service";
import { type NextRequest } from "next/server";

/**
 * GET /api/squads?pollId=xxx
 * List all squads for a specific poll. Any authenticated player can view.
 */
export async function GET(request: NextRequest) {
    try {
        // Allow unauthenticated users to browse squads (read-only guest view)
        const user = await getCurrentUser();
        const currentPlayerId = user?.player?.id ?? null;

        const pollId = request.nextUrl.searchParams.get("pollId");
        if (!pollId) {
            return ErrorResponse({ message: "pollId is required", status: 400 });
        }

        // Dynamic squad cap based on how many squads have registered
        const totalSquadCount = await prisma.squad.count({
            where: { pollId, status: { not: "CANCELLED" } },
        });
        const maxSquads = getConfirmedSquadCap(totalSquadCount);

        const squads = await prisma.squad.findMany({
            where: {
                pollId,
                status: { not: "CANCELLED" },
            },
            include: {
                captain: {
                    select: {
                        id: true,
                        displayName: true,
                        customProfileImageUrl: true,
                        hasRoyalPass: true,
                        user: { select: { username: true, imageUrl: true } },
                    },
                },
                clan: {
                    select: { logoUrl: true, tag: true, name: true },
                },
                invites: {
                    include: {
                        player: {
                            select: {
                                id: true,
                                displayName: true,
                                customProfileImageUrl: true,
                                hasRoyalPass: true,
                                user: { select: { username: true, imageUrl: true } },
                            },
                        },
                    },
                    orderBy: { createdAt: "asc" },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // ── Defending champion: find the last completed squad tournament's 1st place clanId ──
        let defendingChampion: { clanId: string; teamName: string; captainName: string | null; clanLogo: string | null } | null = null;
        const lastWinner = await prisma.tournamentWinner.findFirst({
            where: {
                position: 1,
                tournament: {
                    isWinnerDeclared: true,
                    poll: { allowSquads: true },
                },
                team: { clanId: { not: null } },
            },
            orderBy: { createdAt: "desc" },
            select: {
                team: {
                    select: {
                        name: true,
                        clanId: true,
                        clan: { select: { logoUrl: true } },
                    },
                },
                tournament: {
                    select: { poll: { select: { id: true } } },
                },
            },
        });
        if (lastWinner?.team?.clanId) {
            // Find the squad captain from the winning tournament's poll
            const winningSquad = lastWinner.tournament.poll
                ? await prisma.squad.findFirst({
                    where: {
                        pollId: lastWinner.tournament.poll.id,
                        clanId: lastWinner.team.clanId,
                        status: "REGISTERED",
                    },
                    select: { captain: { select: { displayName: true } } },
                })
                : null;
            defendingChampion = {
                clanId: lastWinner.team.clanId,
                teamName: lastWinner.team.name,
                captainName: winningSquad?.captain?.displayName ?? null,
                clanLogo: lastWinner.team.clan?.logoUrl ?? null,
            };
        }

        const data = squads.map((squad) => {
            const acceptedCount = squad.invites.filter((i) => i.status === "ACCEPTED").length;
            const activeCount = squad.invites.filter((i) => i.status === "ACCEPTED" && !i.isSub).length;
            const isCaptain = currentPlayerId ? squad.captainId === currentPlayerId : false;
            const myInvite = currentPlayerId ? squad.invites.find((i) => i.playerId === currentPlayerId) : undefined;
            const isMySquad = !!myInvite;

            return {
                id: squad.id,
                name: squad.name,
                status: squad.status,
                entryFee: squad.entryFee,
                createdAt: squad.createdAt,
                captain: {
                    id: squad.captain.id,
                    displayName: squad.captain.displayName ?? squad.captain.user.username,
                    imageUrl: squad.captain.customProfileImageUrl ?? squad.captain.user.imageUrl ?? "",
                },
                clanLogo: squad.clan?.logoUrl ?? null,
                clanTag: squad.clan?.tag ?? null,
                clanName: squad.clan?.name ?? null,
                isDefendingChampion: !!defendingChampion && !!squad.clanId && squad.clanId === defendingChampion.clanId,
                isCaptain,
                myInvite: myInvite
                    ? { id: myInvite.id, status: myInvite.status, initiatedBy: myInvite.initiatedBy }
                    : null,
                members: squad.invites
                    .filter((inv) => {
                        // Never show declined
                        if (inv.status === "DECLINED") return false;
                        // Pending invites: only visible to the leader and the pending player
                        // Guests (no currentPlayerId) never see pending invites
                        if (inv.status === "PENDING") {
                            if (!currentPlayerId) return false;
                            return isCaptain || inv.playerId === currentPlayerId;
                        }
                        return true;
                    })
                    .map((inv) => ({
                    inviteId: inv.id,
                    playerId: inv.player.id,
                    displayName: inv.player.displayName ?? inv.player.user.username,
                    imageUrl: inv.player.customProfileImageUrl ?? inv.player.user.imageUrl ?? "",
                    hasRoyalPass: inv.player.hasRoyalPass,
                    status: inv.status,
                    initiatedBy: inv.initiatedBy ?? "CAPTAIN",
                    // Only reveal sub status to the squad's own members
                    isSub: isMySquad ? inv.isSub : false,
                })),
                acceptedCount,
                activeCount,
                totalSlots: GAME.maxSquadSize,
                isFull: acceptedCount >= GAME.maxSquadSize,
            };
        });

        return SuccessResponse({ data, meta: { defendingChampion, maxSquads, maxSquadWaitlist: 32, squadCount: data.length }, cache: CACHE.NONE });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch squads", error });
    }
}

/**
 * POST /api/squads
 * Create a new squad for a poll. Captain's entry fee is RESERVED (not deducted).
 * Body: { pollId, name, useClan? }
 */
export async function POST(request: NextRequest) {
    try {
        const email = await getAuthEmail();
        if (!email) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Player profile required", status: 403 });
        }

        const body = await request.json();
        const { pollId, name, useClan, useClanTreasury } = body as {
            pollId: string; name: string; useClan?: boolean; useClanTreasury?: boolean;
        };

        if (!pollId) {
            return ErrorResponse({ message: "pollId is required", status: 400 });
        }

        // Discord linking is mandatory for squad creation
        const captainPlayer = await prisma.player.findUnique({
            where: { id: user.player.id },
            select: { discordId: true },
        });
        if (!captainPlayer?.discordId) {
            return ErrorResponse({
                message: "🔗 Link your Discord account first to create a team",
                status: 403,
            });
        }

        const playerId = user.player.id;

        // Resolve clan identity if requested
        let clanId: string | null = null;
        let trimmedName = (name || "").trim();

        if (useClan) {
            // Check ClanMember first, then fallback to owned clan (leader)
            const membership = await prisma.clanMember.findUnique({
                where: { playerId },
                include: { clan: { select: { id: true, name: true } } },
            });
            let clanInfo: { id: string; name: string } | null = membership?.clan ?? null;
            if (!clanInfo) {
                const ownedClan = await prisma.clan.findUnique({
                    where: { leaderId: playerId },
                    select: { id: true, name: true },
                });
                clanInfo = ownedClan;
            }
            if (!clanInfo) {
                return ErrorResponse({ message: "You are not in a clan", status: 400 });
            }
            clanId = clanInfo.id;
            // Auto-name: "ClanName", "ClanName 2", "ClanName 3", etc.
            const existingClanSquads = await prisma.squad.count({
                where: { pollId, clanId, status: { in: ["FORMING", "FULL"] } },
            });
            trimmedName = existingClanSquads === 0
                ? clanInfo.name
                : `${clanInfo.name} ${existingClanSquads + 1}`;
        }

        if (!trimmedName) {
            return ErrorResponse({ message: "Squad name is required", status: 400 });
        }

        if (trimmedName.length > 30) {
            return ErrorResponse({ message: "Squad name must be 30 characters or less", status: 400 });
        }

        // Fetch poll + tournament
        const poll = await prisma.poll.findUnique({
            where: { id: pollId },
            include: {
                tournament: { select: { id: true, fee: true, status: true } },
            },
        });

        if (!poll || !poll.isActive) {
            return ErrorResponse({ message: "Poll is not active", status: 400 });
        }

        if (!poll.allowSquads) {
            return ErrorResponse({ message: "Squads are not enabled for this tournament", status: 400 });
        }

        const entryFee = poll.tournament?.fee ?? 0;

        // Clan treasury validation (must be a clan squad + have enough balance)
        const wantClanTreasury = !!(useClanTreasury && clanId && entryFee > 0);
        if (wantClanTreasury) {
            const clan = await prisma.clan.findUnique({
                where: { id: clanId! },
                select: { balance: true },
            });
            if (!clan || clan.balance < entryFee) {
                return ErrorResponse({
                    message: `${GAME.currencyEmoji} Clan treasury doesn't have enough — need ${entryFee} ${GAME.currency}, have ${clan?.balance ?? 0} ${GAME.currency}`,
                    status: 403,
                });
            }
        }

        // Check captain's personal balance (skip if using clan treasury)
        if (entryFee > 0 && !wantClanTreasury) {
            const player = await prisma.player.findUnique({
                where: { id: playerId },
                select: { isTrusted: true },
            });
            if (!player?.isTrusted) {
                const { available } = await getAvailableBalance(email);
                if (available < entryFee) {
                    return ErrorResponse({
                        message: `${GAME.currencyEmoji} Not enough ${GAME.currency} — you need ${entryFee} ${GAME.currency} available to create a squad`,
                        status: 403,
                    });
                }
            }
        }

        // Check: registration cap (always 32 — championship auto-detected at generation time)
        const registrationCap = 32;
        const activeSquadCount = await prisma.squad.count({
            where: {
                pollId,
                status: { in: ["FORMING", "FULL"] },
            },
        });
        const maxSquads = getConfirmedSquadCap(activeSquadCount + 1); // +1 for the squad being created

        if (activeSquadCount >= registrationCap) {
            return ErrorResponse({
                message: `All ${registrationCap} slots are filled. Try again next tournament!`,
                status: 400,
            });
        }

        // Check: not already captain or member of another squad for this poll
        const existingSquad = await prisma.squad.findFirst({
            where: {
                pollId,
                status: { in: ["FORMING", "FULL"] },
                OR: [
                    { captainId: playerId },
                    { invites: { some: { playerId, status: { in: ["PENDING", "ACCEPTED"] } } } },
                ],
            },
        });

        if (existingSquad) {
            return ErrorResponse({
                message: "You're already in a squad for this poll",
                status: 400,
            });
        }

        // Create squad (or reuse a previously cancelled one to avoid unique constraint)
        const squad = await prisma.$transaction(async (tx) => {
            // Check for a previously cancelled squad by this captain for this poll
            const cancelledSquad = await tx.squad.findFirst({
                where: { pollId, captainId: playerId, status: "CANCELLED" },
            });

            if (cancelledSquad) {
                // Reuse: reset the cancelled squad
                // Delete old invites first
                await tx.squadInvite.deleteMany({ where: { squadId: cancelledSquad.id } });

                const updated = await tx.squad.update({
                    where: { id: cancelledSquad.id },
                    data: {
                        name: trimmedName,
                        clanId,
                        status: "FORMING",
                        entryFee,
                        useClanTreasury: wantClanTreasury,
                        createdAt: new Date(), // Reset so re-registered squad appears as latest
                        invites: {
                            create: {
                                playerId,
                                status: "ACCEPTED",
                                respondedAt: new Date(),
                            },
                        },
                    },
                });

                // Remove captain's individual vote
                await tx.playerPollVote.deleteMany({
                    where: { pollId, playerId },
                });

                return updated;
            }

            // No cancelled squad — create fresh
            const created = await tx.squad.create({
                data: {
                    name: trimmedName,
                    pollId,
                    captainId: playerId,
                    clanId,
                    entryFee,
                    useClanTreasury: wantClanTreasury,
                    invites: {
                        create: {
                            playerId,
                            status: "ACCEPTED",
                            respondedAt: new Date(),
                        },
                    },
                },
                include: {
                    invites: {
                        include: {
                            player: {
                                select: {
                                    id: true,
                                    displayName: true,
                                    customProfileImageUrl: true,
                                    user: { select: { username: true, imageUrl: true } },
                                },
                            },
                        },
                    },
                },
            });

            return created;
        });

        // Remove captain's individual vote (for fresh create path — outside cancelled reuse)
        // This is already handled inside the transaction for the reuse path.
        // For fresh creates, we do it here:
        await prisma.playerPollVote.deleteMany({
            where: { pollId, playerId },
        });

        const isWaitlisted = activeSquadCount >= maxSquads; // squad was created as #(activeSquadCount+1)

        // Auto-grant Discord @Ranked-Player role for returning captains
        const rankedRoleId = process.env.DISCORD_RANKED_PLAYER_ROLE_ID;
        if (rankedRoleId && poll.allowSquads) {
            const captain = await prisma.player.findUnique({
                where: { id: playerId },
                select: { discordId: true },
            });
            if (captain?.discordId) {
                grantRole(captain.discordId, rankedRoleId).catch(() => {});
            }
        }
        return SuccessResponse({
            data: {
                id: squad.id,
                name: squad.name,
                status: squad.status,
                entryFee: squad.entryFee,
                isWaitlisted,
            },
            message: isWaitlisted
                ? `⏳ Squad "${trimmedName}" is on the WAITLIST (#${activeSquadCount + 1 - maxSquads} in queue). You'll be moved to confirmed if a team cancels.`
                : `Squad "${trimmedName}" created! Invite up to ${GAME.maxSquadSize - 1} players to complete your team.`,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to create squad", error });
    }
}
