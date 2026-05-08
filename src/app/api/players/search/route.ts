import { prisma } from "@/lib/database";
import { requireAdmin } from "@/lib/auth";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { playerSearchFilter } from "@/lib/player-search";
import { type NextRequest } from "next/server";

/**
 * GET /api/players/search?q=xxx
 * Admin-only: Search players by displayName, username, or email.
 * Returns a lightweight list for autocomplete.
 */
export async function GET(request: NextRequest) {
    try {
        const admin = await requireAdmin();
        if (!admin) {
            return ErrorResponse({ message: "Admin access required", status: 403 });
        }

        const q = request.nextUrl.searchParams.get("q")?.trim();
        if (!q || q.length < 2) {
            return SuccessResponse({ data: [] });
        }

        const players = await prisma.player.findMany({
            where: {
                OR: playerSearchFilter(q, { includeEmail: true }),
            },
            select: {
                id: true,
                displayName: true,
                user: {
                    select: {
                        email: true,
                        username: true,
                        imageUrl: true,
                    },
                },
            },
            take: 8,
        });

        const data = players.map((p) => ({
            id: p.id,
            displayName: p.displayName,
            username: p.user.username,
            email: p.user.email,
            imageUrl: p.user.imageUrl,
        }));

        return SuccessResponse({ data });
    } catch (error) {
        return ErrorResponse({ message: "Search failed", error });
    }
}
