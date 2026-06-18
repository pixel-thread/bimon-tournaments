import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { type NextRequest } from "next/server";

/**
 * POST /api/squads/[squadId]/add-member/confirm
 * 
 * Confirm adding a matched real player to the squad.
 * Called after the phone/email search returned a real player match.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ squadId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        const { squadId } = await params;
        const body = await request.json();
        const { playerId, isSub } = body as { playerId: string; isSub?: boolean };

        if (!playerId) {
            return ErrorResponse({ message: "playerId is required", status: 400 });
        }

        const currentPlayerId = user.player.id;

        // Verify captain owns this squad
        const squad = await prisma.squad.findUnique({
            where: { id: squadId },
            select: {
                id: true,
                captainId: true,
                status: true,
                pollId: true,
                invites: { select: { playerId: true, status: true, isSub: true } },
            },
        });

        if (!squad) {
            return ErrorResponse({ message: "Squad not found", status: 404 });
        }

        if (squad.captainId !== currentPlayerId) {
            return ErrorResponse({ message: "Only the captain can add members", status: 403 });
        }

        if (squad.status !== "FORMING") {
            return ErrorResponse({ message: "Squad is not accepting members", status: 400 });
        }

        // Check roster space
        const activeMembers = squad.invites.filter(
            (i) => i.status === "ACCEPTED" && !i.isSub
        ).length;
        const subs = squad.invites.filter(
            (i) => i.status === "ACCEPTED" && i.isSub
        ).length;

        if (isSub) {
            if (subs >= GAME.maxSquadSize - GAME.squadSize) {
                return ErrorResponse({ message: "All sub slots are filled", status: 400 });
            }
        } else {
            if (activeMembers >= GAME.squadSize) {
                return ErrorResponse({ message: "All active slots are filled", status: 400 });
            }
        }

        // Verify player exists and isn't already in this squad
        const targetPlayer = await prisma.player.findUnique({
            where: { id: playerId },
            select: {
                id: true,
                displayName: true,
                isBanned: true,
                customProfileImageUrl: true,
                user: { select: { username: true, imageUrl: true } },
            },
        });

        if (!targetPlayer) {
            return ErrorResponse({ message: "Player not found", status: 404 });
        }

        if (targetPlayer.isBanned) {
            return ErrorResponse({ message: "This player is banned", status: 400 });
        }

        // Check not already in this squad
        const alreadyInSquad = squad.invites.some(
            (i) => i.playerId === playerId && (i.status === "ACCEPTED" || i.status === "PENDING")
        );
        if (alreadyInSquad) {
            return ErrorResponse({ message: "Player is already in this squad", status: 400 });
        }

        // Check not in another squad for this tournament
        const inOtherSquad = await prisma.squadInvite.findFirst({
            where: {
                playerId,
                status: { in: ["ACCEPTED", "PENDING"] },
                squad: {
                    pollId: squad.pollId,
                    status: { in: ["FORMING", "FULL"] },
                    id: { not: squadId },
                },
            },
        });

        if (inOtherSquad) {
            return ErrorResponse({
                message: "This player is already in another squad for this tournament",
                status: 400,
            });
        }

        // Create squad invite (auto-accepted since captain is adding directly)
        await prisma.squadInvite.create({
            data: {
                squadId,
                playerId,
                status: "ACCEPTED",
                initiatedBy: "CAPTAIN",
                isSub: isSub ?? false,
                respondedAt: new Date(),
            },
        });

        // Update squad status if full
        const updatedInvites = await prisma.squadInvite.count({
            where: { squadId, status: "ACCEPTED", isSub: false },
        });

        if (updatedInvites >= GAME.squadSize) {
            await prisma.squad.update({
                where: { id: squadId, status: "FORMING" },
                data: { status: "FULL" },
            });
        }

        const displayName = targetPlayer.displayName ?? targetPlayer.user.username;

        return SuccessResponse({
            data: {
                added: true,
                player: {
                    id: targetPlayer.id,
                    displayName,
                    imageUrl: targetPlayer.customProfileImageUrl ?? targetPlayer.user.imageUrl,
                    isGhost: false,
                },
            },
            message: `✅ ${displayName} added to squad`,
        });
    } catch (error) {
        console.error("Failed to confirm member:", error);
        return ErrorResponse({ message: "Failed to add member", error });
    }
}
