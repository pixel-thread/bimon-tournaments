import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCurrentUser, getAuthEmail } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { getConfirmedSquadCap } from "@/lib/logic/championship";
import { getAvailableBalance } from "@/lib/wallet-service";
import { grantRole } from "@/lib/discord-service";
import { containsProfanity } from "@/lib/profanity";
import { checkKdGate } from "@/lib/logic/kd-gate";
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
        const includeAll = request.nextUrl.searchParams.get("includeAll") === "true";
        if (!pollId) {
            return ErrorResponse({ message: "pollId is required", status: 400 });
        }

        // Fetch isMangoScrim from tournament (Mango Scrim = 18 confirmed slots vs 16)
        const pollForCap = await prisma.poll.findUnique({
            where: { id: pollId },
            select: { tournament: { select: { isMangoScrim: true } } },
        });
        const isMangoScrim = pollForCap?.tournament?.isMangoScrim ?? false;

        // Dynamic squad cap based on how many squads have registered
        const statusFilter = includeAll ? {} : { not: "CANCELLED" as const };
        const totalSquadCount = await prisma.squad.count({
            where: { pollId, status: { not: "CANCELLED" } },
        });
        const maxSquads = getConfirmedSquadCap(totalSquadCount, isMangoScrim);

        const squads = await prisma.squad.findMany({
            where: {
                pollId,
                status: statusFilter,
            },
            include: {
                captain: {
                    select: {
                        id: true,
                        displayName: true,
                        customProfileImageUrl: true,
                        hasRoyalPass: true,
                        discordId: true,
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
                                discordId: true,
                                isGhost: true,
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

        // ── Compute needsPayment for ALL squads with entryFee > 0 ──
        // Build set of captain emails for balance lookups
        const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

        // Collect unique captain IDs with entry fees > 0
        const captainIdsWithFees = [...new Set(
            squads.filter((s) => s.entryFee > 0 && s.status !== "CANCELLED").map((s) => s.captainId)
        )];

        // Batch lookup: captain isTrusted + email for balance check
        const captainInfos = captainIdsWithFees.length > 0
            ? await prisma.player.findMany({
                where: { id: { in: captainIdsWithFees } },
                select: { id: true, isTrusted: true, isGhost: true, user: { select: { email: true } } },
            })
            : [];

        // Build map: captainId → { isTrusted, email }
        const captainMap = new Map(
            captainInfos.map((c) => [c.id, { isTrusted: c.isTrusted, isGhost: c.isGhost, email: c.user.email }])
        );

        // Fetch balances for non-trusted captains — BATCH (single DB query)
        // Use total balance (not available) — available subtracts reserved amounts which
        // includes THIS squad's own entry fee, causing false "needs payment" for captains
        // who actually have enough. Captain just needs balance >= entryFee.
        const emailsToCheck = [...captainMap.entries()]
            .filter(([, info]) => !info.isTrusted && !info.isGhost && info.email)
            .map(([, info]) => info.email!);
        const batchBalances = emailsToCheck.length > 0
            ? await (await import("@/lib/wallet-service")).getBalancesBatch(emailsToCheck)
            : new Map<string, number>();
        const balanceMap = new Map<string, number>();
        for (const [captainId, info] of captainMap) {
            if (!info.isTrusted && !info.isGhost && info.email) {
                balanceMap.set(captainId, batchBalances.get(info.email) ?? 0);
            }
        }

        const allData = squads.map((squad) => {
            const acceptedCount = squad.invites.filter((i) => i.status === "ACCEPTED").length;
            const activeCount = acceptedCount; // No active/sub distinction
            const isCaptain = currentPlayerId ? squad.captainId === currentPlayerId : false;
            const myInvite = currentPlayerId ? squad.invites.find((i) => i.playerId === currentPlayerId) : undefined;
            const isMySquad = !!myInvite;

            // needsPayment: captain has entryFee but insufficient balance
            // Ghost captains (admin-created teams) are always confirmed
            // If confirmedAt is set (admin-created or previously confirmed), skip balance check
            let needsPayment = false;
            if (squad.entryFee > 0 && squad.status !== "CANCELLED" && !squad.confirmedAt) {
                const capInfo = captainMap.get(squad.captainId);
                if (capInfo && !capInfo.isTrusted && !capInfo.isGhost) {
                    const bal = balanceMap.get(squad.captainId) ?? 0;
                    needsPayment = bal < squad.entryFee;
                }
            }

            return {
                id: squad.id,
                name: squad.name,
                fullName: squad.fullName ?? null,
                status: squad.status,
                entryFee: squad.entryFee,
                createdAt: squad.createdAt,
                confirmedAt: squad.confirmedAt ?? null,
                needsPayment,
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
                    hasDiscord: !!inv.player.discordId,
                    isGhost: inv.player.isGhost ?? false,
                    status: inv.status,
                    initiatedBy: inv.initiatedBy ?? "CAPTAIN",
                    // Only reveal sub status to the squad's own members
                    isSub: isMySquad ? inv.isSub : false,
                })),
                acceptedCount,
                activeCount,
                totalSlots: GAME.maxSquadSize,
                isFull: acceptedCount >= GAME.maxSquadSize,
                _isMySquad: isMySquad,
                _isCaptain: isCaptain,
            };
        });

        // All squads visible to everyone — unconfirmed squads shown in a separate UI section
        const data = allData.map(({ _isMySquad, _isCaptain, ...rest }) => rest);

        // Count only confirmed (paid) squads for prize pool calculation
        const confirmedSquadCount = data.filter((s) => !s.needsPayment).length;

        const registrationCap = isMangoScrim ? 18 : 32;
        return SuccessResponse({ data, meta: { defendingChampion, maxSquads, maxSquadWaitlist: registrationCap, squadCount: data.length, confirmedSquadCount, isMangoScrim }, cache: CACHE.NONE });
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
        const { pollId, name, useClan, useClanTreasury, fullName: rawFullName } = body as {
            pollId: string; name: string; useClan?: boolean; useClanTreasury?: boolean; fullName?: string;
        };
        const fullName = rawFullName?.trim() || null;

        if (!pollId) {
            return ErrorResponse({ message: "pollId is required", status: 400 });
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
            // Auto-name: truncated clan name (max 5 chars)
            const baseName = clanInfo.name.slice(0, 7);
            const existingClanSquads = await prisma.squad.count({
                where: { pollId, clanId, status: { in: ["FORMING", "FULL"] } },
            });
            trimmedName = existingClanSquads === 0
                ? baseName
                : `${baseName.slice(0, 6)}${existingClanSquads + 1}`;
        }

        if (!trimmedName) {
            return ErrorResponse({ message: "Squad name is required", status: 400 });
        }

        if (trimmedName.length > 7) {
            return ErrorResponse({ message: "Squad name must be 7 characters or less", status: 400 });
        }

        // Profanity check on squad name and optional full name
        const badWord = containsProfanity(trimmedName) || (fullName ? containsProfanity(fullName) : null);
        if (badWord) {
            return ErrorResponse({ message: "Team name contains inappropriate language. Please choose another name.", status: 400 });
        }

        // Fetch poll + tournament
        const poll = await prisma.poll.findUnique({
            where: { id: pollId },
            include: {
                tournament: { select: { id: true, fee: true, status: true, isMangoScrim: true } },
            },
        });

        if (!poll || !poll.isActive) {
            return ErrorResponse({ message: "Poll is not active", status: 400 });
        }

        if (!poll.allowSquads) {
            return ErrorResponse({ message: "Squads are not enabled for this tournament", status: 400 });
        }

        // KD range gate — block captain from creating squad if KD is out of range
        const kdResult = await checkKdGate(playerId, pollId);
        if (!kdResult.allowed) {
            return ErrorResponse({ message: kdResult.message!, status: 403 });
        }

        const entryFee = poll.tournament?.fee ?? 0;
        const isMangoScrim = poll.tournament?.isMangoScrim ?? false;

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
        // Instead of blocking, flag insufficientBalance so squad still gets created
        let insufficientBalance = false;
        if (entryFee > 0 && !wantClanTreasury) {
            const player = await prisma.player.findUnique({
                where: { id: playerId },
                select: { isTrusted: true },
            });
            if (!player?.isTrusted) {
                const { balance } = await getAvailableBalance(email);
                insufficientBalance = balance < entryFee;
            }
        }

        // Check: registration cap (Mango Scrim = 18 flat, regular = 32)
        const registrationCap = isMangoScrim ? 18 : 32;
        const activeSquadCount = await prisma.squad.count({
            where: {
                pollId,
                status: { in: ["FORMING", "FULL"] },
            },
        });
        const maxSquads = getConfirmedSquadCap(activeSquadCount + 1, isMangoScrim); // +1 for the squad being created

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
                        fullName,
                        clanId,
                        status: "FORMING",
                        entryFee,
                        useClanTreasury: wantClanTreasury,
                        createdAt: new Date(), // Reset so re-registered squad appears as latest
                        confirmedAt: insufficientBalance ? null : new Date(),
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
                    fullName,
                    pollId,
                    captainId: playerId,
                    clanId,
                    entryFee,
                    useClanTreasury: wantClanTreasury,
                    confirmedAt: insufficientBalance ? null : new Date(),
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

        return SuccessResponse({
            data: {
                id: squad.id,
                name: squad.name,
                status: squad.status,
                entryFee: squad.entryFee,
                isWaitlisted,
                insufficientBalance,
            },
            message: insufficientBalance
                ? `Squad "${trimmedName}" created! ⚠️ Add ${GAME.currency} to confirm your spot.`
                : isWaitlisted
                ? `⏳ Squad "${trimmedName}" is on the WAITLIST (#${activeSquadCount + 1 - maxSquads} in queue). You'll be moved to confirmed if a team cancels.`
                : `Squad "${trimmedName}" created! Invite up to ${GAME.maxSquadSize - 1} players to complete your team.`,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to create squad", error });
    }
}
