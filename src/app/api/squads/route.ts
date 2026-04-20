import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCurrentUser, getAuthEmail } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { getAvailableBalance } from "@/lib/wallet-service";
import { type NextRequest } from "next/server";

/**
 * GET /api/squads?pollId=xxx
 * List all squads for a specific poll. Any authenticated player can view.
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Player profile required", status: 403 });
        }

        const pollId = request.nextUrl.searchParams.get("pollId");
        if (!pollId) {
            return ErrorResponse({ message: "pollId is required", status: 400 });
        }

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
                        user: { select: { username: true, imageUrl: true } },
                    },
                },
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
                    orderBy: { createdAt: "asc" },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const currentPlayerId = user.player.id;

        const data = squads.map((squad) => {
            const acceptedCount = squad.invites.filter((i) => i.status === "ACCEPTED").length;
            const isCaptain = squad.captainId === currentPlayerId;
            const myInvite = squad.invites.find((i) => i.playerId === currentPlayerId);

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
                isCaptain,
                myInvite: myInvite
                    ? { id: myInvite.id, status: myInvite.status, initiatedBy: myInvite.initiatedBy }
                    : null,
                members: squad.invites
                    .filter((inv) => inv.status !== "DECLINED" || inv.playerId === currentPlayerId)
                    .map((inv) => ({
                    inviteId: inv.id,
                    playerId: inv.player.id,
                    displayName: inv.player.displayName ?? inv.player.user.username,
                    imageUrl: inv.player.customProfileImageUrl ?? inv.player.user.imageUrl ?? "",
                    status: inv.status,
                    initiatedBy: inv.initiatedBy ?? "CAPTAIN",
                })),
                acceptedCount,
                totalSlots: GAME.maxSquadSize,
                isFull: acceptedCount >= GAME.maxSquadSize,
            };
        });

        return SuccessResponse({ data, cache: CACHE.NONE });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch squads", error });
    }
}

/**
 * POST /api/squads
 * Create a new squad for a poll. Captain's entry fee is RESERVED (not deducted).
 * Body: { pollId, name }
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
        const { pollId, name } = body as { pollId: string; name: string };

        if (!pollId || !name?.trim()) {
            return ErrorResponse({ message: "pollId and name are required", status: 400 });
        }

        const trimmedName = name.trim();
        if (trimmedName.length > 30) {
            return ErrorResponse({ message: "Squad name must be 30 characters or less", status: 400 });
        }

        const playerId = user.player.id;

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

        // Check available balance (must cover own entry fee after existing reservations)
        // Trusted players can create squads even with 0 balance
        if (entryFee > 0) {
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

        // Create squad + captain's self-invite (ACCEPTED) in a transaction
        const squad = await prisma.$transaction(async (tx) => {
            const created = await tx.squad.create({
                data: {
                    name: trimmedName,
                    pollId,
                    captainId: playerId,
                    entryFee,
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

        return SuccessResponse({
            data: {
                id: squad.id,
                name: squad.name,
                status: squad.status,
                entryFee: squad.entryFee,
            },
            message: `Squad "${trimmedName}" created! Invite up to ${GAME.maxSquadSize - 1} players to complete your team.`,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to create squad", error });
    }
}
