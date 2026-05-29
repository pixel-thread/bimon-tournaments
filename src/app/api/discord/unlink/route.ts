import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { revokeRole } from "@/lib/discord-service";

/**
 * POST /api/discord/unlink
 *
 * Unlinks the player's Discord account.
 * Clears discordId + discordUsername from the Player record.
 * Best-effort: revokes the @Ranked-Player role on Discord.
 */
export async function POST() {
    try {
        const user = await getCurrentUser();
        if (!user?.player?.id) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const player = await prisma.player.findUnique({
            where: { id: user.player.id },
            select: { discordId: true },
        });

        if (!player?.discordId) {
            return NextResponse.json({ error: "Discord not linked" }, { status: 400 });
        }

        const discordId = player.discordId;

        // Clear from database
        await prisma.player.update({
            where: { id: user.player.id },
            data: { discordId: null, discordUsername: null },
        });

        // Best-effort: revoke @Ranked-Player role
        const roleId = process.env.DISCORD_RANKED_PLAYER_ROLE_ID;
        if (roleId) {
            try {
                await revokeRole(discordId, roleId);
            } catch (err) {
                console.error("Failed to revoke Discord role on unlink:", err);
                // Don't fail — DB is already cleared
            }
        }

        return NextResponse.json({
            success: true,
            message: "Discord account unlinked",
        });
    } catch (error) {
        console.error("Discord unlink error:", error);
        return NextResponse.json({ error: "Failed to unlink Discord" }, { status: 500 });
    }
}
