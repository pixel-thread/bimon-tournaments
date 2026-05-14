import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { type NextRequest, NextResponse } from "next/server";
import { sendPush } from "@/lib/push";

/**
 * GET /api/squads/[squadId]/link-join
 * Public squad info for the invite link page.
 * If the user is signed in, also returns their invite/membership status.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ squadId: string }> }
) {
    try {
        const { squadId } = await params;

        const squad = await prisma.squad.findUnique({
            where: { id: squadId },
            include: {
                captain: {
                    select: {
                        id: true,
                        displayName: true,
                        customProfileImageUrl: true,
                        user: { select: { username: true, imageUrl: true } },
                    },
                },
                clan: { select: { logoUrl: true, tag: true, name: true } },
                invites: {
                    where: { status: "ACCEPTED" },
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
                poll: {
                    select: {
                        id: true,
                        isActive: true,
                        scheduledDate: true,
                        scheduledTime: true,
                        matchSchedule: true,
                        days: true,
                        expectedPrizePool: true,
                        whatsappGroupLink: true,
                        tournament: {
                            select: { name: true, fee: true },
                        },
                    },
                },
            },
        });

        if (!squad || squad.status === "CANCELLED") {
            return ErrorResponse({ message: "Squad not found", status: 404 });
        }

        // Check if current user is already in the squad or has a pending invite
        let myStatus: "none" | "accepted" | "pending" | "declined" = "none";
        let isSignedIn = false;
        let hasPlayerProfile = false;
        try {
            const user = await getCurrentUser();
            if (user) {
                isSignedIn = true;
                if (user.player?.id) {
                    hasPlayerProfile = true;
                    const existing = await prisma.squadInvite.findFirst({
                        where: { squadId, playerId: user.player.id },
                        select: { status: true },
                        orderBy: { createdAt: "desc" },
                    });
                    if (existing) {
                        myStatus = existing.status.toLowerCase() as typeof myStatus;
                    }
                }
            }
        } catch {
            // Not signed in
        }

        const acceptedCount = squad.invites.length;

        return SuccessResponse({
            data: {
                squadId: squad.id,
                squadName: squad.name,
                status: squad.status,
                entryFee: squad.entryFee,
                pollId: squad.poll.id,
                pollIsActive: squad.poll.isActive,
                tournamentName: squad.poll.tournament?.name ?? "Tournament",
                tournamentFee: squad.poll.tournament?.fee ?? 0,
                expectedPrizePool: squad.poll.expectedPrizePool,
                scheduledDate: squad.poll.scheduledDate,
                scheduledTime: squad.poll.scheduledTime ?? "20:00",
                matchSchedule: squad.poll.matchSchedule ?? null,
                days: squad.poll.days,
                whatsappGroupLink: squad.poll.whatsappGroupLink ?? null,
                captain: {
                    id: squad.captain.id,
                    displayName: squad.captain.displayName ?? squad.captain.user.username,
                    imageUrl: squad.captain.customProfileImageUrl ?? squad.captain.user.imageUrl ?? "",
                },
                clanLogo: squad.clan?.logoUrl ?? null,
                clanTag: squad.clan?.tag ?? null,
                clanName: squad.clan?.name ?? null,
                members: squad.invites.map((inv) => ({
                    playerId: inv.player.id,
                    displayName: inv.player.displayName ?? inv.player.user.username,
                    imageUrl: inv.player.customProfileImageUrl ?? inv.player.user.imageUrl ?? "",
                    isCaptain: inv.playerId === squad.captainId,
                })),
                acceptedCount,
                totalSlots: GAME.maxSquadSize,
                isFull: acceptedCount >= GAME.maxSquadSize,
                myStatus,
                isSignedIn,
                hasPlayerProfile,
            },
            cache: CACHE.NONE,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch squad info", error });
    }
}

/**
 * POST /api/squads/[squadId]/link-join
 * Auto-join a squad via shared link.
 * Creates an ACCEPTED invite in one step (captain pre-authorized via link sharing).
 * Handles: poll vote cleanup, squad full detection, duplicate checks.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ squadId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Player profile required", status: 403 });
        }

        const { squadId } = await params;
        const playerId = user.player.id;
        const playerName = user.player.displayName;
        const body = await request.json().catch(() => ({}));
        const force = (body as any)?.force === true;

        const squad = await prisma.squad.findUnique({
            where: { id: squadId },
            include: {
                poll: { select: { id: true, isActive: true, tournament: { select: { name: true } } } },
                captain: {
                    select: {
                        id: true,
                        displayName: true,
                        user: { select: { id: true } },
                    },
                },
                invites: { select: { playerId: true, status: true, id: true } },
            },
        });

        if (!squad || squad.status === "CANCELLED") {
            return ErrorResponse({ message: "Squad not found", status: 404 });
        }

        if (!squad.poll.isActive) {
            return ErrorResponse({ message: "Registration is closed", status: 400 });
        }

        if (squad.captainId === playerId) {
            return ErrorResponse({ message: "You're the captain of this squad", status: 400 });
        }

        // Check if already in ANOTHER squad for this poll
        const existingSquad = await prisma.squad.findFirst({
            where: {
                pollId: squad.poll.id,
                id: { not: squadId }, // exclude this squad — we handle existing invites below
                status: { in: ["FORMING", "FULL"] },
                invites: { some: { playerId, status: { in: ["PENDING", "ACCEPTED"] } } },
            },
            select: { id: true, name: true, captainId: true, status: true },
        });
        if (existingSquad) {
            // Captain can't auto-leave — they must cancel their squad first
            if (existingSquad.captainId === playerId) {
                return ErrorResponse({
                    message: `You're the leader of "${existingSquad.name}". Cancel that squad first before joining another.`,
                    status: 400,
                });
            }

            if (!force) {
                // Return conflict — frontend will show confirmation alert
                return NextResponse.json({
                    error: "EXISTING_SQUAD",
                    message: `You're in "${existingSquad.name}". Leave and join "${squad.name}"?`,
                    existingSquadName: existingSquad.name,
                }, { status: 409 });
            }

            // Force mode: auto-leave old squad
            const oldInvite = await prisma.squadInvite.findFirst({
                where: { squadId: existingSquad.id, playerId, status: { in: ["PENDING", "ACCEPTED"] } },
            });
            if (oldInvite) {
                await prisma.$transaction(async (tx) => {
                    await tx.squadInvite.update({
                        where: { id: oldInvite.id },
                        data: { status: "DECLINED", respondedAt: new Date() },
                    });
                    // If old squad was FULL, revert to FORMING
                    if (existingSquad.status === "FULL") {
                        await tx.squad.update({
                            where: { id: existingSquad.id },
                            data: { status: "FORMING" },
                        });
                    }
                });
            }
        }

        // Check if squad is full
        const acceptedCount = squad.invites.filter((i) => i.status === "ACCEPTED").length;
        if (acceptedCount >= GAME.maxSquadSize || squad.status === "FULL") {
            return ErrorResponse({ message: "This squad is full", status: 400 });
        }

        const isFull = (acceptedCount + 1) >= GAME.maxSquadSize;
        const shouldBeSub = (acceptedCount + 1) > GAME.squadSize;
        const tournamentName = squad.poll.tournament?.name ?? "tournament";

        // Auto-join: create ACCEPTED invite + cleanup in one transaction
        await prisma.$transaction(async (tx) => {
            // Check for existing invite from this player
            const existingInvite = squad.invites.find((i) => i.playerId === playerId);

            if (existingInvite) {
                // Update existing invite to ACCEPTED
                await tx.squadInvite.update({
                    where: { id: existingInvite.id },
                    data: { status: "ACCEPTED", respondedAt: new Date(), initiatedBy: "CAPTAIN", isSub: shouldBeSub },
                });
            } else {
                // Create new ACCEPTED invite
                await tx.squadInvite.create({
                    data: {
                        squadId,
                        playerId,
                        status: "ACCEPTED",
                        respondedAt: new Date(),
                        initiatedBy: "CAPTAIN",
                        isSub: shouldBeSub,
                    },
                });
            }

            // Mark squad as FULL if needed
            if (isFull) {
                await tx.squad.update({
                    where: { id: squadId },
                    data: { status: "FULL" },
                });
            }

            // Remove any existing poll vote — squad members are on a team
            await tx.playerPollVote.deleteMany({
                where: { pollId: squad.poll.id, playerId },
            });

            // Auto-decline all other PENDING requests/invites for this poll
            await tx.squadInvite.updateMany({
                where: {
                    playerId,
                    status: "PENDING",
                    squad: {
                        pollId: squad.poll.id,
                        status: { in: ["FORMING", "FULL"] },
                    },
                },
                data: { status: "DECLINED", respondedAt: new Date() },
            });

            // Notify captain
            await tx.notification.create({
                data: {
                    title: isFull ? "🛡 Squad Complete!" : "🔗 Player Joined via Link",
                    message: isFull
                        ? `${playerName} joined "${squad.name}" via invite link — your squad is now full for ${tournamentName}! 🎉`
                        : `${playerName} joined "${squad.name}" via your invite link`,
                    type: "squad_accept",
                    userId: squad.captain.user.id,
                    playerId: squad.captain.id,
                    link: "/vote",
                },
            });
        });

        // Push notification (outside transaction)
        sendPush(squad.captain.id, {
            title: isFull ? "🛡 Squad Complete!" : "🔗 Player Joined",
            body: isFull
                ? `${playerName} joined "${squad.name}" — squad full for ${tournamentName}! 🎉`
                : `${playerName} joined "${squad.name}" via invite link`,
            url: "/vote",
        });

        return SuccessResponse({
            message: `You joined "${squad.name}"! 🎉`,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to join squad", error });
    }
}
