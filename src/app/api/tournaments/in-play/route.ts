import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";

/**
 * GET /api/tournaments/in-play
 * Returns ACTIVE tournaments (with or without teams).
 * Used by Room Info and WhatsApp Groups pages.
 */
export async function GET() {
    try {
        const tournaments = await prisma.tournament.findMany({
            where: {
                status: "ACTIVE",
                isWinnerDeclared: false,
            },
            select: {
                id: true,
                name: true,
                type: true,
                season: { select: { name: true } },
                _count: { select: { teams: true } },
                poll: {
                    select: {
                        id: true,
                        allowSquads: true,
                        question: true,
                        isChampionship: true,
                    },
                },
                championshipEntries: {
                    where: { status: "ACTIVE" },
                    select: { group: true },
                    distinct: ["group"],
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // Check which polls have registered/full squads (for pre-team leader messaging)
        const pollIds = tournaments.map(t => t.poll?.id).filter(Boolean) as string[];
        const squadCounts = pollIds.length > 0
            ? await prisma.squad.groupBy({
                by: ["pollId"],
                where: { pollId: { in: pollIds }, status: { in: ["FORMING", "FULL", "REGISTERED"] } },
                _count: { id: true },
            })
            : [];
        const squadCountMap = new Map(squadCounts.map(s => [s.pollId, s._count.id]));

        return SuccessResponse({
            data: tournaments.map((t) => {
                const isChampionship = t.poll?.isChampionship ?? false;
                const groups = isChampionship
                    ? [...new Set(t.championshipEntries.map(e => e.group).filter(Boolean))].sort()
                    : [];

                return {
                    id: t.id,
                    name: t.name,
                    type: t.type,
                    seasonName: t.season?.name ?? null,
                    hasTeams: t._count.teams > 0,
                    hasSquads: (t.poll?.allowSquads && (squadCountMap.get(t.poll?.id ?? "") ?? 0) > 0) || false,
                    pollId: t.poll?.id ?? null,
                    allowSquads: t.poll?.allowSquads ?? false,
                    question: t.poll?.question ?? t.name,
                    isChampionship,
                    groups, // ["A", "B", "C", ...] or []
                };
            }),
            cache: CACHE.SHORT,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch in-play tournaments", error });
    }
}
