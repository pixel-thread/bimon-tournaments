import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getAuthEmail } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { censorProfanity } from "@/lib/logic/profanityFilter";
import { t } from "@/lib/translations";
import { getLevelFromXP } from "@/lib/xp";

/**
 * GET /api/profile
 * Fetches the current user's complete profile with player data,
 * detailed stats, wallet, streak, and computed performance metrics.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const mode = searchParams.get("mode") ?? "casual"; // "casual" | "ranked"

        const userId = await getAuthEmail();
        if (!userId) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        // Run user + season queries in parallel (they're independent)
        const [user, activeSeason] = await Promise.all([
            prisma.user.findFirst({
                where: {
                    OR: [
                        { email: userId },
                        { secondaryEmail: userId },
                    ],
                },
                include: {
                    player: {
                        include: {
                            wallet: { select: { balance: true, diamondBalance: true } },
                            streak: { select: { current: true, longest: true } },
                            characterImage: {
                                select: {
                                    publicUrl: true,
                                    thumbnailUrl: true,
                                    isAnimated: true,
                                    isVideo: true,
                                },
                            },
                            clanMembership: {
                                include: {
                                    clan: {
                                        select: { id: true, name: true, tag: true, logoUrl: true },
                                    },
                                },
                            },
                        },
                    },
                },
            }),
            prisma.season.findFirst({
                where: { status: "ACTIVE" },
                select: { id: true },
            }),
        ]);

        if (!user) {
            return ErrorResponse({ message: "User not found", status: 404 });
        }

        const player = user.player;

        // Compute detailed stats
        let detailedStats = null;

        if (player) {
            const seasonId = activeSeason?.id;
            const tpsSeasonFilter = seasonId ? { seasonId } : {};

            // Mode filter: casual = random teams (no poll OR poll.allowSquads=false), ranked = squad teams
            const modeFilter: Record<string, unknown> = {};
            if (mode === "ranked") {
                modeFilter.match = { tournament: { poll: { allowSquads: true } } };
            } else if (mode === "casual") {
                // Include matches where poll is null (no poll = casual by default) OR allowSquads is false
                modeFilter.match = {
                    tournament: {
                        OR: [
                            { poll: null },
                            { poll: { allowSquads: false } },
                        ],
                    },
                };
            }

            // All stats queries in parallel
            const [
                statsAgg,
                seasonsPlayed,
                teamPlacements,
                bestKillRecord,
                lastTwoMatches,
            ] = await Promise.all([
                prisma.teamPlayerStats.aggregate({
                    where: { playerId: player.id, present: true, ...tpsSeasonFilter, ...modeFilter },
                    _count: { matchId: true },
                    _sum: { kills: true },
                }),
                prisma.playerStats.count({ where: { playerId: player.id, matches: { gt: 0 } } }),
                // Use TeamPlayerStats → teamStats to get positions (more reliable than TeamStats.players relation)
                prisma.teamPlayerStats.findMany({
                    where: { playerId: player.id, present: true, ...tpsSeasonFilter, ...modeFilter },
                    select: {
                        teamStats: {
                            select: { position: true, tournamentId: true },
                        },
                    },
                }),
                prisma.teamPlayerStats.findFirst({
                    where: { playerId: player.id, present: true, ...tpsSeasonFilter, ...modeFilter },
                    orderBy: { kills: "desc" },
                    select: { kills: true },
                }),
                prisma.teamPlayerStats.findMany({
                    where: { playerId: player.id, present: true, ...tpsSeasonFilter, ...modeFilter },
                    orderBy: { createdAt: "desc" },
                    take: 2,
                    select: { kills: true },
                }),
            ]);

            const totalKills = statsAgg._sum.kills ?? 0;
            const totalMatches = statsAgg._count.matchId;
            const kd = totalMatches > 0 ? totalKills / totalMatches : 0;

            // "Wins" = 1st place finishes only
            const wins = teamPlacements.filter((t) => t.teamStats.position === 1).length;
            const top10 = teamPlacements.filter((t) => t.teamStats.position >= 1 && t.teamStats.position <= 5).length;
            const totalTournaments = new Set(teamPlacements.map((t) => t.teamStats.tournamentId).filter(Boolean)).size;
            // Win rate & top 10 rate are per-match (teamPlacements is now per-match via TeamPlayerStats)
            const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
            const top10Rate = totalMatches > 0 ? Math.round((top10 / totalMatches) * 100) : 0;



            const bestMatchKills = bestKillRecord?.kills ?? 0;
            const lastMatchKills = lastTwoMatches[0]?.kills ?? 0;

            let kdTrend: "up" | "down" | "same" = "same";
            let kdChange = 0;
            if (totalMatches > 1 && lastTwoMatches.length >= 2) {
                const prevKd = (totalKills - lastMatchKills) / (totalMatches - 1);
                kdChange = Number((kd - prevKd).toFixed(2));
                kdTrend = kdChange > 0 ? "up" : kdChange < 0 ? "down" : "same";
            }

            const avgKillsPerMatch = totalMatches > 0 ? Number((totalKills / totalMatches).toFixed(1)) : 0;

            detailedStats = {
                kills: totalKills,
                matches: totalMatches,
                kd: Number(kd.toFixed(2)),
                kdTrend,
                kdChange,
                lastMatchKills,
                seasonsPlayed,
                totalTournaments,
                bestMatchKills,
                wins,
                top10,
                winRate,
                top10Rate,
                avgKillsPerMatch,

            };
        }

        // Clan data
        let clanData = null;
        let pendingClanInvites = 0;
        if (player) {
            const clanMembership = (player as any).clanMembership;
            if (clanMembership?.clan) {
                clanData = {
                    id: clanMembership.clan.id,
                    name: clanMembership.clan.name,
                    tag: clanMembership.clan.tag,
                    logoUrl: clanMembership.clan.logoUrl,
                };
            }
            pendingClanInvites = await prisma.clanInvite.count({
                where: { playerId: player.id, status: "PENDING" },
            });
        }

        const data = {
            id: user.id,
            clerkId: user.clerkId,
            username: user.username,
            email: user.email,
            secondaryEmail: user.secondaryEmail || null,
            imageUrl: player?.customProfileImageUrl || user.imageUrl,
            role: user.role,
            player: player
                ? {
                    id: player.id,
                    displayName: player.displayName || user.username,
                    uid: player.uid || null,
                    phoneNumber: player.phoneNumber || null,
                    bio: censorProfanity(player.bio || (() => {
                        const cat = player.category.charAt(0) + player.category.slice(1).toLowerCase();
                        const article = /^[aeiou]/i.test(cat) ? "an" : "a";
                        return t("defaultBio", { name: player.displayName || user.username, article, category: cat });
                    })()),
                    category: player.category,
                    hasRoyalPass: player.hasRoyalPass,
                    isBanned: player.isBanned,
                    isCouponVerifier: player.isCouponVerifier ?? false,
                    state: player.state || null,
                    district: player.district || null,
                    town: player.town || null,
                    characterImage: player.characterImage
                        ? {
                            url: player.characterImage.publicUrl,
                            thumbnailUrl: player.characterImage.thumbnailUrl,
                            isAnimated: player.characterImage.isAnimated,
                            isVideo: player.characterImage.isVideo,
                        }
                        : null,
                    stats: detailedStats,
                    wallet: {
                        balance: player.wallet?.balance ?? 0,
                        diamondBalance: player.wallet?.diamondBalance ?? 0,
                    },
                    streak: player.streak
                        ? {
                            current: player.streak.current,
                            longest: player.streak.longest,
                        }
                        : { current: 0, longest: 0 },
                    clan: clanData,
                    pendingClanInvites,
                    level: detailedStats
                        ? getLevelFromXP((detailedStats.kills * 5) + (detailedStats.matches * 15) + (detailedStats.wins * 15)).level
                        : 1,
                }
                : null,
        };

        return SuccessResponse({ data, cache: CACHE.NONE });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch profile", error });
    }
}
