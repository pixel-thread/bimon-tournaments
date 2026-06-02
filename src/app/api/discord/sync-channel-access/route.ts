import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/database";
import { grantChannelAccess } from "@/lib/discord-service";

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
            return NextResponse.json({ error: "No Discord channel found for this tournament" }, { status: 404 });
        }

        // Find all players with discordId in this tournament
        const playerFilter: any = {
            teams: { some: { tournamentId } },
            discordId: { not: null },
        };
        if (group) {
            playerFilter.teams = {
                some: {
                    tournamentId,
                    championshipEntry: { group },
                },
            };
        }

        const players = await prisma.player.findMany({
            where: playerFilter,
            select: { id: true, discordId: true, displayName: true },
        });

        // Grant access with rate-limit-safe batching (5 per second)
        let granted = 0;
        let failed = 0;
        for (const player of players) {
            if (!player.discordId) continue;
            try {
                await grantChannelAccess(channelId, player.discordId);
                granted++;
                // Small delay to avoid Discord rate limits
                await new Promise(r => setTimeout(r, 200));
            } catch (err) {
                failed++;
                console.error(`Failed to grant access to ${player.displayName}:`, err);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Synced ${granted} players to channel (${failed} failed)`,
            total: players.length,
            granted,
            failed,
            playersWithDiscord: players.map(p => p.displayName),
        });
    } catch (error) {
        console.error("sync-channel-access error:", error);
        return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
    }
}
