import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/database";
import { getChannelAccessList, grantChannelAccess, revokeChannelAccess } from "@/lib/discord-service";

/**
 * GET /api/discord/channel-access?tournamentId=xxx&group=A
 * Returns all players in the tournament with their Discord access status.
 * Groups players by team for easy management.
 */
export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const tournamentId = req.nextUrl.searchParams.get("tournamentId");
        const group = req.nextUrl.searchParams.get("group");
        if (!tournamentId) {
            return NextResponse.json({ error: "Missing tournamentId" }, { status: 400 });
        }

        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            select: { discordChannelId: true, discordGroupChannels: true },
        });
        if (!tournament) {
            return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
        }

        // Determine which channel to check
        let channelId: string | null = null;
        if (group) {
            const groupChannels = (tournament.discordGroupChannels as Record<string, string>) || {};
            channelId = groupChannels[group] || null;
        } else {
            channelId = tournament.discordChannelId;
        }

        // Get who already has access from Discord
        const accessList = channelId ? await getChannelAccessList(channelId) : [];
        const accessSet = new Set(accessList);

        // Get all teams with players
        const teamFilter: any = { tournamentId };
        if (group === "WILDCARD") {
            // Wildcard: teams in WILDCARD or ACTIVE phase that were in wildcard
            teamFilter.championshipEntry = { phase: { in: ["WILDCARD"] } };
        } else if (group === "FINALS") {
            // Finals: teams in FINALS phase (ACTIVE = currently playing finals)
            teamFilter.championshipEntry = { phase: "FINALS", status: { in: ["ACTIVE", "QUALIFIED"] } };
        } else if (group) {
            teamFilter.championshipEntry = { group };
        }

        const teams = await prisma.team.findMany({
            where: teamFilter,
            select: {
                id: true,
                name: true,
                teamNumber: true,
                players: {
                    select: {
                        id: true,
                        displayName: true,
                        discordId: true,
                        discordUsername: true,
                        customProfileImageUrl: true,
                        user: { select: { username: true, imageUrl: true } },
                    },
                },
            },
            orderBy: { teamNumber: "asc" },
        });

        const result = teams.map(team => ({
            id: team.id,
            name: team.name,
            teamNumber: team.teamNumber,
            players: team.players.map(p => ({
                id: p.id,
                displayName: p.displayName ?? p.user.username,
                imageUrl: p.customProfileImageUrl ?? p.user.imageUrl ?? "",
                discordId: p.discordId,
                discordUsername: p.discordUsername,
                hasAccess: p.discordId ? accessSet.has(p.discordId) : false,
                isLinked: !!p.discordId,
            })),
        }));

        const groupChannelKeys = Object.keys((tournament.discordGroupChannels as Record<string, string>) || {});

        return NextResponse.json({
            teams: result,
            channelId,
            availableChannels: groupChannelKeys, // ["A", "B", "WILDCARD", "FINALS"] etc.
            totalPlayers: result.reduce((sum, t) => sum + t.players.length, 0),
            linkedPlayers: result.reduce((sum, t) => sum + t.players.filter(p => p.isLinked).length, 0),
            grantedPlayers: result.reduce((sum, t) => sum + t.players.filter(p => p.hasAccess).length, 0),
        });
    } catch (error) {
        console.error("channel-access GET error:", error);
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }
}

/**
 * POST /api/discord/channel-access
 * Grant or revoke access for specific players.
 * Body: { tournamentId, group?, playerDiscordIds: string[], action: "grant" | "revoke" }
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { tournamentId, group, playerDiscordIds, action } = await req.json();
        if (!tournamentId || !playerDiscordIds?.length || !["grant", "revoke"].includes(action)) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            select: { discordChannelId: true, discordGroupChannels: true },
        });
        if (!tournament) {
            return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
        }

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

        // Process one at a time with 800ms delay
        let success = 0;
        let failed = 0;
        const fn = action === "grant" ? grantChannelAccess : revokeChannelAccess;

        for (const discordId of playerDiscordIds) {
            try {
                await fn(channelId, discordId);
                success++;
            } catch (err: any) {
                // On rate limit, stop and return progress
                if (err.message?.includes("[429]")) {
                    const match = err.message.match(/"retry_after":([\d.]+)/);
                    const retryAfterMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 1000 : 12000;
                    return NextResponse.json({
                        success,
                        failed,
                        remaining: playerDiscordIds.length - success - failed,
                        rateLimited: true,
                        retryAfterMs,
                    });
                }
                failed++;
            }
            if (success + failed < playerDiscordIds.length) {
                await new Promise(r => setTimeout(r, 800));
            }
        }

        return NextResponse.json({ success, failed, remaining: 0, rateLimited: false });
    } catch (error) {
        console.error("channel-access POST error:", error);
        return NextResponse.json({ error: "Failed to process" }, { status: 500 });
    }
}
