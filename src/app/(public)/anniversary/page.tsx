import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPrisma } from "@/lib/database";
import AnniversaryClient from "@/components/anniversary/anniversary-client";
import type { AnniversaryData } from "@/components/anniversary/anniversary-client";

export const metadata: Metadata = {
    title: "1 Year Anniversary — BGMI Tournament Community",
    description:
        "Celebrating one year of BGMI tournaments. March 2025 → April 2026. Thank you to every warrior who made this possible.",
    openGraph: {
        title: "🎉 1 Year of BGMI Tournaments",
        description:
            "From a small group of friends to a thriving community. Celebrating our first anniversary.",
    },
};

export const revalidate = 3600; // revalidate every hour

async function getAnniversaryData(): Promise<AnniversaryData> {
    const db = getPrisma("bgmi");

    // Get all seasons ordered
    const seasons = await db.season.findMany({ orderBy: { startDate: "asc" } });
    const s1Id = seasons[0]?.id;

    if (!s1Id) {
        throw new Error("Season 1 not found");
    }

    const laterSeasonIds = seasons.slice(1).map((s) => s.id);

    // Get all S1 players with current display names (displayName is on Player table)
    const s1Players = await db.$queryRaw<{ name: string; playerId: string }[]>`
        SELECT DISTINCT COALESCE(p."displayName", u.username) as name, mpp."playerId" as "playerId"
        FROM "MatchPlayerPlayed" mpp
        JOIN "Tournament" t ON t.id = mpp."tournamentId"
        JOIN "Player" p ON p.id = mpp."playerId"
        JOIN "User" u ON u.id = p."userId"
        WHERE t."seasonId" = ${s1Id}
        ORDER BY name ASC
    `;

    // For each S1 player, check if they played in any later season
    const s1PlayerData = await Promise.all(
        s1Players.map(async (sp) => {
            const laterCount = await db.matchPlayerPlayed.count({
                where: {
                    playerId: sp.playerId,
                    tournament: { seasonId: { in: laterSeasonIds } },
                },
            });
            return {
                name: sp.name,
                active: laterCount > 0,
            };
        })
    );

    // Overall stats
    const [totalPlayers, totalTournaments, totalTeams, totalMatches, killsAgg] =
        await Promise.all([
            db.player.count(),
            db.tournament.count(),
            db.team.count(),
            db.matchPlayerPlayed.count(),
            db.teamPlayerStats.aggregate({ _sum: { kills: true } }),
        ]);

    // Top killers all time
    const topKillerRows = await db.teamPlayerStats.groupBy({
        by: ["playerId"],
        _sum: { kills: true },
        orderBy: { _sum: { kills: "desc" } },
        take: 10,
    });

    const topKillers = await Promise.all(
        topKillerRows.map(async (k) => {
            const [nameRow] = await db.$queryRaw<{ name: string }[]>`
                SELECT COALESCE(p."displayName", u.username) as name
                FROM "Player" p JOIN "User" u ON u.id = p."userId"
                WHERE p.id = ${k.playerId}
            `;
            const tCount = await db.matchPlayerPlayed.groupBy({
                by: ["tournamentId"],
                where: { playerId: k.playerId },
            });
            return {
                name: nameRow?.name || "?",
                kills: k._sum.kills || 0,
                tournaments: tCount.length,
            };
        })
    );

    // Most matches all time — using TeamPlayerStats as it's more complete than MatchPlayerPlayed
    const mostMatchRows = await db.$queryRaw<
        { playerId: string; name: string; matches: bigint; tournaments: bigint }[]
    >`
        SELECT tps."playerId",
               COALESCE(p."displayName", u.username) as name,
               COUNT(tps.id) as matches,
               COUNT(DISTINCT team."tournamentId") as tournaments
        FROM "TeamPlayerStats" tps
        JOIN "Team" team ON team.id = tps."teamId"
        JOIN "Player" p ON p.id = tps."playerId"
        JOIN "User" u ON u.id = p."userId"
        GROUP BY tps."playerId", p."displayName", u.username
        ORDER BY matches DESC
        LIMIT 10
    `;

    const mostActive = mostMatchRows.map((m) => ({
        name: m.name,
        matches: Number(m.matches),
        tournaments: Number(m.tournaments),
    }));

    // Season info for timeline
    const seasonTimeline = [
        {
            name: "Season 1",
            period: "Mar – Jul 2025",
            tournaments: 37,
            desc: "Where it all began. 68 players battled across 37 tournaments.",
            highlight: "First tournament: Leh Kai Sngewtynnad 3",
        },
        {
            name: "Season 2",
            period: "Jul – Sep 2025",
            tournaments: 15,
            desc: "The community grew steadily. New players joined, rivalries formed.",
            highlight: "New players joining every week",
        },
        {
            name: "Season 3",
            period: "Sep – Nov 2025",
            tournaments: 27,
            desc: "Our busiest season yet. 27 tournaments packed into just 2 months.",
            highlight: "Peak tournament activity",
        },
        {
            name: "Season 4",
            period: "Dec 2025 – Jan 2026",
            tournaments: 21,
            desc: "The platform got a major upgrade. Full stat tracking and modern features launched.",
            highlight: "Platform upgraded",
        },
        {
            name: "Season 4.2",
            period: "Jan – Mar 2026",
            tournaments: 21,
            desc: "Wallet system, Royal Pass, merit ratings — the platform evolved.",
            highlight: "BP economy launched",
        },
        {
            name: "Season 4.3",
            period: "Mar 2026 – Present",
            tournaments: 9,
            desc: "The current season. Still going strong after a full year.",
            highlight: "🎉 1 Year Anniversary!",
        },
    ];

    return {
        stats: {
            daysActive: Math.floor(
                (Date.now() - new Date("2025-03-24").getTime()) / (1000 * 60 * 60 * 24)
            ),
            totalPlayers,
            totalTournaments,
            totalKills: killsAgg._sum.kills || 0,
            totalMatches,
            totalTeams,
        },
        season1Players: s1PlayerData,
        topKillers,
        mostActive,
        seasons: seasonTimeline,
    };
}

export default async function AnniversaryPage() {
    // Only show on BGMI deployment
    const gameMode = process.env.NEXT_PUBLIC_GAME_MODE || "bgmi";
    if (gameMode !== "bgmi") notFound();

    const data = await getAnniversaryData();
    return <AnniversaryClient data={data} />;
}
