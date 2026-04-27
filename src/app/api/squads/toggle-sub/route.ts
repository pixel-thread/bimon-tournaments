import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getAuthEmail } from "@/lib/auth";
import { type NextRequest } from "next/server";

/**
 * POST /api/squads/toggle-sub
 * Admin-only: Toggle a squad member's substitute status.
 * Body: { inviteId }
 */
export async function POST(request: NextRequest) {
    try {
        const email = await getAuthEmail();
        if (!email) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        const user = await prisma.user.findFirst({
            where: { OR: [{ email }, { secondaryEmail: email }] },
            select: { role: true },
        });

        if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
            return ErrorResponse({ message: "Admin access required", status: 403 });
        }

        const body = await request.json();
        const { inviteId } = body as { inviteId: string };

        if (!inviteId) {
            return ErrorResponse({ message: "inviteId is required", status: 400 });
        }

        const invite = await prisma.squadInvite.findUnique({
            where: { id: inviteId },
            include: {
                squad: { select: { captainId: true } },
                player: { select: { displayName: true } },
            },
        });

        if (!invite) {
            return ErrorResponse({ message: "Invite not found", status: 404 });
        }

        if (invite.status !== "ACCEPTED") {
            return ErrorResponse({ message: "Can only toggle sub status for accepted members", status: 400 });
        }

        // Cannot make the captain a sub
        if (invite.playerId === invite.squad.captainId) {
            return ErrorResponse({ message: "Cannot mark the captain as a substitute", status: 400 });
        }

        const newIsSub = !invite.isSub;

        await prisma.squadInvite.update({
            where: { id: inviteId },
            data: { isSub: newIsSub },
        });

        const playerName = invite.player.displayName ?? "Player";
        return SuccessResponse({
            message: newIsSub
                ? `${playerName} marked as substitute`
                : `${playerName} moved to active roster`,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to toggle sub status", error });
    }
}
