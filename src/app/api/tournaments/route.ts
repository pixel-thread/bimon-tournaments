import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { ALL_TOURNAMENT_TYPES } from "@/lib/bracket-types";
import { createTournamentChannel } from "@/lib/discord-service";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/tournaments — Create a new tournament (admin only).
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const body = await req.json();
        const { name, description, fee, seasonId, type, maxPlacements, isMangoScrim } = body;

        if (!name?.trim()) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        // Auto-link to current active season if none provided
        let resolvedSeasonId = seasonId || null;
        if (!resolvedSeasonId) {
            const activeSeason = await prisma.season.findFirst({
                where: { status: "ACTIVE" },
                select: { id: true },
                orderBy: { createdAt: "desc" },
            });
            resolvedSeasonId = activeSeason?.id ?? null;
        }

        // Strip emojis — they render as ?? on some devices
        const cleanName = name.trim().replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').replace(/\s{2,}/g, ' ').trim();

        const tournament = await prisma.tournament.create({
            data: {
                name: cleanName,
                description: description || null,
                fee: fee ? Number(fee) : null,
                seasonId: resolvedSeasonId,
                createdBy: user.id,
                startDate: new Date(),
                type: (ALL_TOURNAMENT_TYPES as readonly string[]).includes(type) ? type : "BR",
                maxPlacements: maxPlacements ? Math.min(Math.max(Number(maxPlacements), 1), 5) : 3,
                isMangoScrim: isMangoScrim ?? false,
            },
        });

        // Create Discord channel immediately (fire-and-forget)
        // So players get access one-at-a-time as they register, instead of batching at team generation
        createTournamentChannel(cleanName).then(async (channelId) => {
            await prisma.tournament.update({
                where: { id: tournament.id },
                data: { discordChannelId: channelId },
            });
            console.log(`[tournament] Created Discord channel ${channelId} for "${cleanName}"`);
        }).catch((err) => {
            console.error(`[tournament] Failed to create Discord channel for "${cleanName}":`, err);
        });

        return NextResponse.json({ success: true, data: tournament });
    } catch (error) {
        console.error("Error creating tournament:", error);
        return NextResponse.json({ error: "Failed to create" }, { status: 500 });
    }
}

/**
 * GET /api/tournaments
 * Fetches tournaments with pagination, search, and status filter.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = request.nextUrl;
        const status = searchParams.get("status") ?? "ALL";
        const search = searchParams.get("search") ?? "";
        const seasonId = searchParams.get("seasonId");
        const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);
        const cursor = searchParams.get("cursor");

        const where: Record<string, unknown> = {};

        // Support comma-separated status values (e.g. "ACTIVE,IN_PROGRESS")
        if (status !== "ALL") {
            const statuses = status.split(",").map(s => s.trim()).filter(Boolean);
            where.status = statuses.length > 1 ? { in: statuses } : statuses[0];
        }

        // Support comma-separated type filter (e.g. "BRACKET_1V1,LEAGUE,GROUP_KNOCKOUT")
        const typeFilter = searchParams.get("type");
        if (typeFilter) {
            const types = typeFilter.split(",").map(t => t.trim()).filter(Boolean);
            where.type = types.length > 1 ? { in: types } : types[0];
        }

        if (search) {
            where.name = { contains: search, mode: "insensitive" };
        }

        if (seasonId) {
            where.seasonId = seasonId;
        }

        const tournaments = await prisma.tournament.findMany({
            where,
            include: {
                season: { select: { id: true, name: true } },
                _count: {
                    select: {
                        teams: true,
                        matches: true,
                        winners: true,
                        teamStats: true,
                        bracketMatches: true,
                    },
                },
                poll: {
                    select: {
                        id: true,
                        isActive: true,
                        allowSquads: true,
                        isChampionship: true,
                        _count: { select: { votes: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            take: limit + 1,
            ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        });

        const hasMore = tournaments.length > limit;
        const results = hasMore ? tournaments.slice(0, limit) : tournaments;
        const nextCursor = hasMore ? results[results.length - 1]?.id : null;

        const data = results.map((t) => {
            return {
                id: t.id,
                name: t.name,
                description: t.description,
                fee: t.fee,
                status: t.status,
                type: t.type,
                isWinnerDeclared: t.isWinnerDeclared,
                maxPlacements: t.maxPlacements,
                isChampionship: (t as unknown as { isChampionship: boolean }).isChampionship ?? false,
                isMangoScrim: (t as any).isMangoScrim ?? false,
                season: t.season,
                startDate: t.startDate,
                createdAt: t.createdAt,
                updatedAt: t.updatedAt,
                teamCount: t._count.teams > 0 ? t._count.teams : t._count.teamStats,
                matchCount: t._count.matches,
                winnerCount: t._count.winners,
                bracketMatchCount: t._count.bracketMatches,
                poll: t.poll
                    ? {
                        id: t.poll.id,
                        isActive: t.poll.isActive,
                        voteCount: t.poll._count.votes,
                        allowSquads: t.poll.allowSquads,
                        isChampionship: t.poll.isChampionship,
                    }
                    : null,
            };
        });

        return SuccessResponse({
            data,
            meta: { hasMore, nextCursor, count: results.length },
        });
    } catch (error) {
        return ErrorResponse({
            message: "Failed to fetch tournaments",
            error,
        });
    }
}
