import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { type NextRequest } from "next/server";

/**
 * POST /api/squads/auto-accept-player
 * Toggle auto-accept squad invites from a specific captain.
 * Body: { captainId: string, enabled: boolean }
 *
 * When enabled, future invites from this captain will skip PENDING
 * and auto-accept the player into the squad.
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Player profile required", status: 403 });
        }

        const body = await request.json();
        const { captainId, enabled } = body as { captainId: string; enabled: boolean };

        if (!captainId || typeof enabled !== "boolean") {
            return ErrorResponse({ message: "captainId (string) and enabled (boolean) are required", status: 400 });
        }

        const playerId = user.player.id;

        // Can't auto-accept yourself
        if (playerId === captainId) {
            return ErrorResponse({ message: "Cannot set auto-accept for yourself", status: 400 });
        }

        // Verify captain exists
        const captain = await prisma.player.findUnique({
            where: { id: captainId },
            select: { id: true, displayName: true, user: { select: { username: true } } },
        });

        if (!captain) {
            return ErrorResponse({ message: "Player not found", status: 404 });
        }

        const captainName = captain.displayName ?? captain.user.username;

        if (enabled) {
            // Upsert — create if not exists
            await prisma.playerAutoAccept.upsert({
                where: { playerId_captainId: { playerId, captainId } },
                create: { playerId, captainId },
                update: {}, // no-op if already exists
            });

            return SuccessResponse({
                message: `Auto-accept enabled — you'll automatically join future invites from ${captainName}`,
            });
        } else {
            // Delete if exists
            await prisma.playerAutoAccept.deleteMany({
                where: { playerId, captainId },
            });

            return SuccessResponse({
                message: `Auto-accept disabled for ${captainName}`,
            });
        }
    } catch (error) {
        return ErrorResponse({ message: "Failed to update auto-accept setting", error });
    }
}
