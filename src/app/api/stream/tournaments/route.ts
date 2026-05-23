import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";

function validateToken(request: NextRequest): boolean {
    const token = request.nextUrl.searchParams.get("token");
    const expected = process.env.STREAM_TOKEN;
    if (!expected) return false;
    return token === expected;
}

/**
 * GET /api/stream/tournaments?token=xxx
 * Returns recent tournaments for the control panel dropdown.
 */
export async function GET(request: NextRequest) {
    if (!validateToken(request)) {
        return ErrorResponse({ message: "Invalid token", status: 401 });
    }

    try {
        const tournaments = await prisma.tournament.findMany({
            where: {
                status: { not: "DELETED" },
            },
            select: {
                id: true,
                name: true,
                startDate: true,
                status: true,
                type: true,
                _count: {
                    select: { teams: true },
                },
            },
            orderBy: { startDate: "desc" },
            take: 30,
        });

        const data = tournaments.map((t) => ({
            id: t.id,
            name: t.name,
            startDate: t.startDate,
            status: t.status,
            type: t.type,
            teamCount: t._count.teams,
        }));

        return SuccessResponse({ data });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch tournaments", error });
    }
}
