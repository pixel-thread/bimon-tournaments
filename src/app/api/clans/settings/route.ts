import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { GAME } from "@/lib/game-config";

/**
 * POST /api/clans/settings
 * Update clan settings. Only the LEADER can modify settings.
 */
export async function POST(request: Request) {
    try {
        const email = await getAuthEmail();
        if (!email) return ErrorResponse({ message: "Unauthorized", status: 401 });

        const user = await prisma.user.findFirst({
            where: userWhereEmail(email),
            select: { player: { select: { id: true } } },
        });
        if (!user?.player) return ErrorResponse({ message: "Player not found", status: 404 });

        const playerId = user.player.id;

        const membership = await prisma.clanMember.findUnique({
            where: { playerId },
        });
        if (!membership || membership.role !== "LEADER") {
            return ErrorResponse({ message: `Only the ${GAME.clanLabel.toLowerCase()} leader can change settings`, status: 403 });
        }

        const body = await request.json();
        const updates: Record<string, unknown> = {};

        if (typeof body.showTreasuryPublic === "boolean") {
            updates.showTreasuryPublic = body.showTreasuryPublic;
        }

        if (Object.keys(updates).length === 0) {
            return ErrorResponse({ message: "No valid settings to update", status: 400 });
        }

        await prisma.clan.update({
            where: { id: membership.clanId },
            data: updates,
        });

        return SuccessResponse({ message: "Settings updated" });
    } catch (error) {
        return ErrorResponse({ message: "Failed to update settings", error });
    }
}
