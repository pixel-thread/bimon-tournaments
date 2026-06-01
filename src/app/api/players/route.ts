import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { playerSearchFilter } from "@/lib/player-search";
import { type NextRequest } from "next/server";
import { getCategoryFromKDValue, getCategoryFromWinRate } from "@/lib/logic/categoryUtils";
import { GAME } from "@/lib/game-config";
import { censorProfanity } from "@/lib/logic/profanityFilter";
import { t } from "@/lib/translations";

/**
 * GET /api/players
 * Fetches paginated players with stats and wallet.
 * Supports search, tier filter, sorting, and cursor-based pagination.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = request.nextUrl;

        const search = searchParams.get("search") ?? "";
        const tier = searchParams.get("tier") ?? "All";
        const sortBy = searchParams.get("sortBy") ?? "kd";
        const sortOrder = (searchParams.get("sortOrder") ?? "desc") as
            | "asc"
            | "desc";
        const season = searchParams.get("season") ?? "";
        const locationState = searchParams.get("state") ?? "";
        const locationDistrict = searchParams.get("district") ?? "";
        const locationTown = searchParams.get("town") ?? "";
        const teamMode = searchParams.get("teamMode") ?? "all"; // "ranked" | "casual" | "all"
        const cursor = searchParams.get("cursor");
        const limit = Math.min(
            Number(searchParams.get("limit") ?? "20"),
            50
        );

        // Build where clause
        const where: Record<string, unknown> = {};

        if (search) {
            where.OR = playerSearchFilter(search, { includeEmail: true });
        }

        // Note: tier filtering is done in JS after dynamic category computation (below)

        // Location filters
        if (locationState) where.state = locationState;
        if (locationDistrict) where.district = locationDistrict;
        if (locationTown) where.town = locationTown;

        // Build orderBy
        const orderByMap: Record<string, unknown> = {
            kd: { stats: { _count: sortOrder } },
            kills: { stats: { _count: sortOrder } },
            matches: { stats: { _count: sortOrder } },
            name: { user: { username: sortOrder } },
            balance: { wallet: { balance: sortOrder } },
        };

        // Default fallback for ordering
        const orderBy = orderByMap[sortBy] ?? { createdAt: "desc" };

        // Determine if we can sort via Prisma or need JS sort
        const prismaSort = sortBy === "name"
            ? { user: { username: sortOrder } }
            : null;

        // Fetch players
        const players = await prisma.player.findMany({
            where,
            include: {
                user: {
                    select: {
                        username: true,
                        imageUrl: true,
                        email: true,
                        role: true,
                    },
                },
                wallet: {
                    select: {
                        balance: true,
                    },
                },
                characterImage: {
                    select: {
                        publicUrl: true,
                        isAnimated: true,
                        isVideo: true,
                        thumbnailUrl: true,
                    },
                },
            },
            ...(prismaSort
                ? {
                    // Don't limit here since we need to do JS tier filtering
                    orderBy: prismaSort as any,
                }
                : {}), // fetch all for JS sort
        });

        // Batch compute stats from TeamPlayerStats (source of truth)
        const playerIds = players.map((p) => p.id);

        // Default to active season if none specified
        let seasonId = season === "all" ? "" : season;
        if (!seasonId) {
            const activeSeason = await prisma.season.findFirst({
                where: { status: "ACTIVE" },
                select: { id: true },
            });
            if (activeSeason) seasonId = activeSeason.id;
        }

        const tpsWhere: Record<string, unknown> = { playerId: { in: playerIds }, present: true };
        if (seasonId) {
            tpsWhere.seasonId = seasonId;
        }
        // Filter by teamMode: ranked (allowSquads=true) vs casual (allowSquads=false) vs tdm (isTDM=true) vs wow (isWoW=true)
        if (teamMode === "ranked") {
            tpsWhere.match = { tournament: { poll: { allowSquads: true } } };
        } else if (teamMode === "casual") {
            tpsWhere.match = { tournament: { isTDM: false, isWoW: false, poll: { allowSquads: false } } };
        } else if (teamMode === "tdm") {
            tpsWhere.match = { tournament: { isTDM: true, isWoW: false } };
        } else if (teamMode === "wow") {
            tpsWhere.match = { tournament: { isWoW: true } };
        }
        const tpsAgg = await prisma.teamPlayerStats.groupBy({
            by: ["playerId"],
            where: tpsWhere,
            _count: { matchId: true },
            _sum: { kills: true },
        });
        const statsMap = new Map(tpsAgg.map((s) => [s.playerId, { kills: s._sum.kills ?? 0, matches: s._count.matchId }]));

        // Bracket wins/losses from BracketMatch (for PES / non-BR games)
        // Build bracket filter based on teamMode
        const bracketTournamentFilter: Record<string, unknown> = {};
        if (teamMode === "tdm") {
            bracketTournamentFilter.isTDM = true;
            bracketTournamentFilter.isWoW = false;
        } else if (teamMode === "wow") {
            bracketTournamentFilter.isWoW = true;
        } else if (teamMode === "ranked" || teamMode === "casual") {
            bracketTournamentFilter.isTDM = false;
            bracketTournamentFilter.isWoW = false;
        }
        const hasBracketFilter = Object.keys(bracketTournamentFilter).length > 0;

        const bracketWins = await prisma.bracketMatch.groupBy({
            by: ["winnerId"],
            where: {
                winnerId: { in: playerIds },
                status: "CONFIRMED",
                ...(hasBracketFilter ? { tournament: bracketTournamentFilter } : {}),
            },
            _count: { id: true },
        });
        const bracketPlayed = await prisma.bracketMatch.findMany({
            where: {
                status: "CONFIRMED",
                OR: [
                    { player1Id: { in: playerIds } },
                    { player2Id: { in: playerIds } },
                ],
                ...(hasBracketFilter ? { tournament: bracketTournamentFilter } : {}),
            },
            select: { player1Id: true, player2Id: true },
        });
        const winsMap = new Map(bracketWins.map((w) => [w.winnerId!, w._count.id]));
        const bracketMatchCountMap = new Map<string, number>();
        for (const m of bracketPlayed) {
            if (m.player1Id) bracketMatchCountMap.set(m.player1Id, (bracketMatchCountMap.get(m.player1Id) ?? 0) + 1);
            if (m.player2Id) bracketMatchCountMap.set(m.player2Id, (bracketMatchCountMap.get(m.player2Id) ?? 0) + 1);
        }

        // Batch fetch clan memberships for all players
        const clanMemberships = await prisma.clanMember.findMany({
            where: { playerId: { in: playerIds } },
            select: {
                playerId: true,
                clan: { select: { id: true, name: true, tag: true, logoUrl: true } },
            },
        });
        const clanMap = new Map(
            clanMemberships.map((cm) => [cm.playerId, cm.clan])
        );

        // Fetch admin-featured character players (show character image without RP)
        const featuredSetting = await prisma.appSetting.findUnique({
            where: { key: "featured_character_players" },
        });
        const featuredPlayerIds = new Set(
            (featuredSetting?.value || "").split(",").map((s) => s.trim()).filter(Boolean)
        );


        // Category: use win rate for bracket games (PES), K/D for BR games (BGMI/FF)
        const isBracketGame = GAME.scoringSystem === "bracket";

        // Flatten the data — compute category (always fresh)
        let allData = players.map((p) => {
            const st = statsMap.get(p.id) ?? { kills: 0, matches: 0 };
            const wins = winsMap.get(p.id) ?? 0;
            const bracketMatches = bracketMatchCountMap.get(p.id) ?? 0;
            // For bracket games, use bracket matches; for BR use TeamPlayerStats matches
            const totalMatches = st.matches > 0 ? st.matches : bracketMatches;
            const kd = st.matches > 0 ? st.kills / st.matches : 0;
            const losses = bracketMatches - wins;
            const category = isBracketGame
                ? getCategoryFromWinRate(wins, bracketMatches)
                : getCategoryFromKDValue(kd);
            const playerClan = clanMap.get(p.id) ?? null;
            return {
                id: p.id,
                displayName: p.displayName,
                bio: censorProfanity(p.bio || (() => {
                    const article = /^[aeiou]/i.test(category) ? "an" : "a";
                    return t("defaultBio", { name: p.displayName || p.user.username, article, category });
                })()),
                username: p.user.username,
                imageUrl: p.customProfileImageUrl || p.user.imageUrl,
                category,
                isBanned: p.isBanned,
                phoneNumber: p.phoneNumber || null,
                stats: {
                    kills: st.kills,
                    matches: totalMatches,
                    kd: Number(kd.toFixed(2)),
                    wins,
                    losses: losses > 0 ? losses : 0,
                    deaths: 0,
                },
                balance: p.wallet?.balance ?? 0,
                hasRoyalPass: p.hasRoyalPass,
                isAdmin: p.user.role === "SUPER_ADMIN" || p.user.role === "ADMIN",
                characterImage: ((p.hasRoyalPass || featuredPlayerIds.has(p.id)) && p.characterImage)
                    ? {
                        url: p.characterImage.publicUrl,
                        isAnimated: p.characterImage.isAnimated,
                        isVideo: p.characterImage.isVideo,
                        thumbnailUrl: p.characterImage.thumbnailUrl,
                    }
                    : null,
                clan: playerClan,
                level: p.level,
                hasDiscord: !!p.discordId,
                discordUsername: p.discordUsername || null,
            };
        });

        // Apply tier filter on dynamic category
        if (tier && tier !== "All") {
            allData = allData.filter((p) => p.category === tier);
        }

        let data;
        let hasMore: boolean;
        let nextCursor: string | null;

        if (prismaSort) {
            // Prisma already sorted & paginated
            hasMore = allData.length > limit;
            data = hasMore ? allData.slice(0, limit) : allData;
            nextCursor = hasMore ? data[data.length - 1]?.id : null;
        } else {
            // JS sort for kd/kills/matches/balance/wins/winRate
            const sortKey = sortBy as "kd" | "kills" | "matches" | "balance" | "wins" | "winRate";
            allData.sort((a, b) => {
                let aVal: number, bVal: number;
                if (sortKey === "balance") {
                    aVal = a.balance; bVal = b.balance;
                } else if (sortKey === "wins") {
                    aVal = a.stats.wins; bVal = b.stats.wins;
                } else if (sortKey === "winRate") {
                    aVal = a.stats.matches > 0 ? a.stats.wins / a.stats.matches : 0;
                    bVal = b.stats.matches > 0 ? b.stats.wins / b.stats.matches : 0;
                } else {
                    aVal = a.stats[sortKey as keyof typeof a.stats] as number;
                    bVal = b.stats[sortKey as keyof typeof b.stats] as number;
                }
                return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
            });

            // Manual cursor-based pagination
            let startIdx = 0;
            if (cursor) {
                const cursorIdx = allData.findIndex((p) => p.id === cursor);
                startIdx = cursorIdx >= 0 ? cursorIdx + 1 : 0;
            }
            const slice = allData.slice(startIdx, startIdx + limit + 1);
            hasMore = slice.length > limit;
            data = hasMore ? slice.slice(0, limit) : slice;
            nextCursor = hasMore ? data[data.length - 1]?.id : null;
        }

        // Check if the requester is admin for meta data
        const user = await getCurrentUser();

        const meta: Record<string, unknown> = {
            hasMore,
            nextCursor,
            count: data.length,
        };

        // Add balance totals for super admins from central wallet (exclude admin wallets)
        if (user?.role === "SUPER_ADMIN") {
            try {
                // Get admin emails to exclude from totals
                const adminUsers = await prisma.user.findMany({
                    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] } },
                    select: { id: true },
                });
                const adminPlayerIds = (await prisma.player.findMany({
                    where: { userId: { in: adminUsers.map(u => u.id) } },
                    select: { id: true },
                })).map(p => p.id);

                const aggregations = await prisma.wallet.aggregate({
                    where: { playerId: { notIn: adminPlayerIds } },
                    _sum: { balance: true },
                });
                const negativeSum = await prisma.wallet.aggregate({
                    where: { playerId: { notIn: adminPlayerIds }, balance: { lt: 0 } },
                    _sum: { balance: true },
                });
                meta.totalBalance = aggregations._sum.balance ?? 0;
                meta.negativeBalance = negativeSum._sum.balance ?? 0;
            } catch {
                meta.totalBalance = 0;
                meta.negativeBalance = 0;
            }
        }

        return SuccessResponse({
            data,
            meta,
            cache: CACHE.SHORT,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch players", error });
    }
}
