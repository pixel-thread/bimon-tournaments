import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";

/**
 * GET /api/tournaments/in-play
 * Returns tournaments that are ACTIVE, have teams generated, and winner not yet declared.
 * Used by the Room Info Generator to show in-play tournaments.
 */
export async function GET() {
    try {
        const tournaments = await prisma.tournament.findMany({
            where: {
                status: "ACTIVE",
                isWinnerDeclared: false,
                teams: { some: {} },
            },
            select: {
                id: true,
                name: true,
                type: true,
                poll: {
                    select: {
                        id: true,
                        allowSquads: true,
                        question: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return SuccessResponse({
            data: tournaments.map((t) => ({
                id: t.id,
                name: t.name,
                type: t.type,
                pollId: t.poll?.id ?? null,
                allowSquads: t.poll?.allowSquads ?? false,
                question: t.poll?.question ?? t.name,
            })),
            cache: CACHE.SHORT,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch in-play tournaments", error });
    }
}
