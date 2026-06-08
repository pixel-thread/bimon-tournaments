import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { type NextRequest } from "next/server";
import { sendPush } from "@/lib/push";
import { logSquadEventTx } from "@/lib/squad-audit";

/**
 * POST /api/squads/leave
 * A non-captain member voluntarily leaves a squad.
 * Body: { squadId }
 */
export async function POST(request: NextRequest) {
    try {
        if (!GAME.features.hasSquads) {
            return ErrorResponse({ message: "Squads are not available", status: 400 });
        }

        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Player profile required", status: 403 });
        }

        const body = await request.json();
        const { squadId } = body as { squadId: string };

        if (!squadId) {
            return ErrorResponse({ message: "squadId is required", status: 400 });
        }

        const playerId = user.player.id;

        // Fetch squad
        const squad = await prisma.squad.findUnique({
            where: { id: squadId },
            include: {
                captain: {
                    select: {
                        id: true,
                        displayName: true,
                        user: { select: { id: true, username: true } },
                    },
                },
                poll: {
                    select: {
                        id: true,
                        isActive: true,
                        tournament: { select: { name: true } },
                    },
                },
                invites: { select: { id: true, playerId: true, status: true } },
            },
        });

        if (!squad) {
            return ErrorResponse({ message: "Squad not found", status: 404 });
        }

        // Cannot leave if you're the captain
        if (squad.captainId === playerId) {
            return ErrorResponse({ message: "Leaders cannot leave — cancel the squad instead", status: 400 });
        }

        // Must be an accepted member
        const myInvite = squad.invites.find((i) => i.playerId === playerId && i.status === "ACCEPTED");
        if (!myInvite) {
            return ErrorResponse({ message: "You are not in this squad", status: 400 });
        }

        // Poll must still be active
        if (!squad.poll.isActive) {
            return ErrorResponse({ message: "Poll is no longer active — you cannot leave now", status: 400 });
        }

        const playerName = user.player.displayName;
        const squadName = squad.name;
        const tournamentName = squad.poll.tournament?.name ?? "tournament";

        // Leave: set invite to DECLINED + un-full the squad if needed
        await prisma.$transaction(async (tx) => {
            await tx.squadInvite.update({
                where: { id: myInvite.id },
                data: { status: "DECLINED", respondedAt: new Date() },
            });

            await logSquadEventTx(tx, { squadId, playerId, action: "MEMBER_LEFT", actorId: playerId });

            // If squad was FULL, revert to FORMING
            if (squad.status === "FULL") {
                await tx.squad.update({
                    where: { id: squadId },
                    data: { status: "FORMING" },
                });
            }

            // Notify the leader
            await tx.notification.create({
                data: {
                    title: "🛡 Member Left",
                    message: `${playerName} left "${squadName}" for ${tournamentName}`,
                    type: "squad_leave",
                    userId: squad.captain.user.id,
                    playerId: squad.captain.id,
                    link: "/vote",
                },
            });
        });

        // Push notification to leader
        sendPush(squad.captain.id, {
            title: "🛡 Member Left",
            body: `${playerName} left "${squadName}" for ${tournamentName}`,
            url: "/vote",
        });

        return SuccessResponse({
            message: `You left "${squadName}"`,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to leave squad", error });
    }
}
