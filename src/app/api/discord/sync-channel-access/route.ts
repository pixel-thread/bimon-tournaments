import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/database";
import { batchGrantChannelAccess } from "@/lib/discord-service";

/**
 * POST /api/discord/sync-channel-access
 * Re-syncs Discord channel access for a tournament — grants access to ALL
 * linked players who are missing from the channel.
 * Body: { tournamentId: string, group?: string }
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { tournamentId, group } = await req.json();
        if (!tournamentId) {
            return NextResponse.json({ error: "Missing tournamentId" }, { status: 400 });
        }

        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            select: {
                discordChannelId: true,
                discordGroupChannels: true,
                name: true,
            },
        });

        if (!tournament) {
            return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
        }

        // Determine channel ID
        let channelId: string | null = null;
        if (group) {
            const groupChannels = (tournament.discordGroupChannels as Record<string, string>) || {};
            channelId = groupChannels[group] || null;
        } else {
            channelId = tournament.discordChannelId;
        }

        if (!channelId) {
            return NextResponse.json({ error: "No Discord channel found" }, { status: 404 });
        }

        // Count total players in tournament (or group)
        const teamFilter: any = { tournamentId };
        if (group) {
            teamFilter.championshipEntry = { group };
        }

        const totalPlayers = await prisma.player.count({
            where: { teams: { some: teamFilter } },
        });

        // Find players with discordId
        const playerFilter: any = {
            teams: { some: teamFilter },
            discordId: { not: null },
        };

        const players = await prisma.player.findMany({
            where: playerFilter,
            select: { discordId: true },
        });
        const discordIds = players.map(p => p.discordId).filter((id): id is string => !!id);

        // Grant access with rate-limited batching
        const { granted, failed } = discordIds.length > 0
            ? await batchGrantChannelAccess(channelId, discordIds)
            : { granted: 0, failed: 0 };

        return NextResponse.json({
            success: true,
            totalPlayers,
            linkedPlayers: discordIds.length,
            unlinkedPlayers: totalPlayers - discordIds.length,
            granted,
            failed,
        });
    } catch (error) {
        console.error("sync-channel-access error:", error);
        return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
    }
}
