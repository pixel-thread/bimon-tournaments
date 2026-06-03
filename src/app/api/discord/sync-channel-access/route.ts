import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/database";
import { grantChannelAccess } from "@/lib/discord-service";

/**
 * POST /api/discord/sync-channel-access
 * Re-syncs Discord channel access for a tournament — grants access to ALL
 * linked players, one at a time with 600ms delay.
 * Processes max 8 per call (Vercel Hobby 10s timeout).
 * UI auto-retries until all are synced.
 * Body: { tournamentId: string, group?: string }
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
        const isUCExempt = user?.player
            ? (await prisma.player.findUnique({ where: { id: user.player.id }, select: { isUCExempt: true } }))?.isUCExempt
            : false;
        if (!user || (!isAdmin && !isUCExempt)) {
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
        const players = await prisma.player.findMany({
            where: {
                teams: { some: teamFilter },
                discordId: { not: null },
            },
            select: { discordId: true },
        });
        const discordIds = players.map(p => p.discordId).filter((id): id is string => !!id);

        // Grant access one at a time, max 8 per call (fits in Vercel 10s timeout)
        const MAX_PER_CALL = 8;
        let granted = 0;
        let failed = 0;

        for (let i = 0; i < Math.min(discordIds.length, MAX_PER_CALL); i++) {
            try {
                await grantChannelAccess(channelId, discordIds[i]);
                granted++;
            } catch (err: any) {
                // If rate limited, stop processing — return what we have
                if (err.message?.includes("[429]")) {
                    console.warn(`[sync] Rate limited after ${granted} grants, stopping this call`);
                    failed = discordIds.length - granted;
                    break;
                }
                failed++;
                console.error(`[sync] Failed to grant access to ${discordIds[i]}:`, err);
            }
            // 600ms between each — ~1.6 req/s, well under Discord's ~10/10s limit
            if (i < Math.min(discordIds.length, MAX_PER_CALL) - 1) {
                await new Promise(r => setTimeout(r, 600));
            }
        }

        const remaining = Math.max(0, discordIds.length - MAX_PER_CALL);

        return NextResponse.json({
            success: true,
            totalPlayers,
            linkedPlayers: discordIds.length,
            unlinkedPlayers: totalPlayers - discordIds.length,
            granted,
            failed,
            remaining, // UI can auto-retry if > 0
        });
    } catch (error) {
        console.error("sync-channel-access error:", error);
        return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
    }
}
