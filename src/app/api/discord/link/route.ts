import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { findMemberByUsername, grantRole } from "@/lib/discord-service";

/**
 * POST /api/discord/link
 *
 * Links a player's Discord account by username.
 * 1. Verifies the username exists in the guild
 * 2. Saves discordId + discordUsername on the Player
 * 3. Grants the @Ranked-Player role
 *
 * Body: { username: string }
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user?.player?.id) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const playerId = user.player.id;

        const { username } = await req.json();
        if (!username || typeof username !== "string") {
            return NextResponse.json({ error: "Username is required" }, { status: 400 });
        }

        const trimmed = username.trim().toLowerCase();

        // 1. Check if this Discord account is already linked to another player
        const existingLink = await prisma.player.findFirst({
            where: {
                discordUsername: { equals: trimmed, mode: "insensitive" },
                id: { not: playerId },
            },
            select: { id: true },
        });
        if (existingLink) {
            return NextResponse.json(
                { error: "This Discord account is already linked to another player" },
                { status: 409 }
            );
        }

        // 2. Look up the member in the Discord server
        const member = await findMemberByUsername(trimmed);
        if (!member) {
            return NextResponse.json(
                { error: "Username not found in the Bimon Tournament Discord server. Make sure you've joined the server first!" },
                { status: 404 }
            );
        }

        // 3. Save to Player
        await prisma.player.update({
            where: { id: playerId },
            data: {
                discordId: member.userId,
                discordUsername: member.username,
            },
        });

        // 4. Grant @Ranked-Player role
        const rankedRoleId = process.env.DISCORD_RANKED_PLAYER_ROLE_ID;
        if (rankedRoleId) {
            try {
                await grantRole(member.userId, rankedRoleId);
            } catch (roleErr) {
                console.error("Failed to grant Discord role:", roleErr);
                // Don't fail the link — role can be granted later
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                discordId: member.userId,
                discordUsername: member.username,
                discordDisplayName: member.displayName,
            },
        });
    } catch (error) {
        console.error("Discord link error:", error);
        return NextResponse.json({ error: "Failed to link Discord account" }, { status: 500 });
    }
}
