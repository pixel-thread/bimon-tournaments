import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { type NextRequest } from "next/server";

/**
 * POST /api/clans/auto-accept
 * Toggle auto-accept squad invites for the current player's clan membership.
 * Body: { enabled: boolean }
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Player profile required", status: 403 });
        }

        const body = await request.json();
        const { enabled } = body as { enabled: boolean };

        if (typeof enabled !== "boolean") {
            return ErrorResponse({ message: "enabled (boolean) is required", status: 400 });
        }

        const playerId = user.player.id;

        // Find their clan membership
        const membership = await prisma.clanMember.findUnique({
            where: { playerId },
        });

        if (!membership) {
            return ErrorResponse({ message: "You are not in a clan", status: 400 });
        }

        // Leaders don't need auto-accept (they create squads)
        if (membership.role === "LEADER") {
            return ErrorResponse({ message: "Leaders create squads — auto-accept is for members", status: 400 });
        }

        await prisma.clanMember.update({
            where: { playerId },
            data: { autoAcceptSquadInvites: enabled },
        });

        return SuccessResponse({
            message: enabled
                ? "Auto-join enabled — you'll automatically join clan squad invites"
                : "Auto-join disabled — you'll need to manually accept invites",
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to update auto-accept setting", error });
    }
}
