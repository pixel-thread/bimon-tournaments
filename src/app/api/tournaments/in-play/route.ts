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
                    hasTeams: t._count.teams > 0,
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
