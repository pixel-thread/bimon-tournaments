import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { type NextRequest } from "next/server";
import { sendPush } from "@/lib/push";

/**
 * POST /api/squads/invite
 * Leader invites a player to their squad. Creates a PENDING invite.
 * Player auto-joins when they click the squad's invite link (link-join overrides pending).
 * Body: { squadId, playerId }
 */
export async function POST(request: NextRequest) {
    try {
        if (!GAME.features.hasSquads) {
            return ErrorResponse({ message: "Squads are not available for this game", status: 400 });
        }

        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Player profile required", status: 403 });
        }

        const body = await request.json();
        const { squadId, playerId } = body as { squadId: string; playerId: string };

        if (!squadId || !playerId) {
            return ErrorResponse({ message: "squadId and playerId are required", status: 400 });
        }

        const currentPlayerId = user.player.id;

        // Fetch squad with details
        const squad = await prisma.squad.findUnique({
            where: { id: squadId },
            include: {
                poll: {
                    select: {
                        id: true,
                        isActive: true,
                        allowSquads: true,
                        tournament: { select: { name: true } },
                    },
                },
                invites: { select: { playerId: true, status: true } },
            },
        });

        if (!squad) {
            return ErrorResponse({ message: "Squad not found", status: 404 });
        }

        // Must be the leader
        if (squad.captainId !== currentPlayerId) {
            return ErrorResponse({ message: "Only the squad leader can invite players", status: 403 });
        }

        // Squad must be FORMING
        if (squad.status !== "FORMING") {
            return ErrorResponse({ message: "Squad is no longer accepting invites", status: 400 });
        }

        // Poll must be active
        if (!squad.poll.isActive || !squad.poll.allowSquads) {
            return ErrorResponse({ message: "Poll is no longer active", status: 400 });
        }

        // Check if squad is full
        const acceptedCount = squad.invites.filter((i) => i.status === "ACCEPTED").length;
        if (acceptedCount >= GAME.maxSquadSize) {
            return ErrorResponse({ message: "Squad is already full", status: 400 });
        }

        // Check if player is already invited/in this squad
        const existingInvite = squad.invites.find((i) => i.playerId === playerId);
        if (existingInvite) {
            if (existingInvite.status === "ACCEPTED") {
                return ErrorResponse({ message: "This player is already in your squad", status: 400 });
            }
            if (existingInvite.status === "PENDING") {
                return ErrorResponse({ message: "This player already has a pending invite", status: 400 });
            }
            // DECLINED — they can be re-invited (delete old invite, create fresh)
            await prisma.squadInvite.deleteMany({
                where: { squadId, playerId, status: "DECLINED" },
            });
        }

        // Check if player is already in another squad for this poll
        const inOtherSquad = await prisma.squadInvite.findFirst({
            where: {
                playerId,
                status: { in: ["PENDING", "ACCEPTED"] },
                squad: {
                    pollId: squad.pollId,
                    status: { in: ["FORMING", "FULL"] },
                },
            },
        });

        if (inOtherSquad) {
            return ErrorResponse({ message: "This player is already in another squad for this tournament", status: 400 });
        }

        // Get invited player info and leader name
        const [invitedPlayer, leaderName] = await Promise.all([
            prisma.player.findUnique({
                where: { id: playerId },
                select: { id: true, displayName: true, user: { select: { id: true, username: true } } },
            }),
            Promise.resolve(user.player.displayName),
        ]);

        if (!invitedPlayer) {
            return ErrorResponse({ message: "Player not found", status: 404 });
        }

        const tournamentName = squad.poll.tournament?.name ?? "tournament";

        // Create PENDING invite — player joins when they click the invite link
        await prisma.squadInvite.create({
            data: {
                squadId,
                playerId,
                status: "PENDING",
                initiatedBy: "CAPTAIN",
            },
        });

        // Push notification
        sendPush(invitedPlayer.id, {
            title: "🛡 Squad Invite",
            body: `${leaderName} invited you to join "${squad.name}" for ${tournamentName}`,
            url: "/vote",
        });

        return SuccessResponse({
            message: `Invite sent to ${invitedPlayer.displayName ?? invitedPlayer.user.username}!`,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to send invite", error });
    }
}
