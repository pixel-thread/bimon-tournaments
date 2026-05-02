import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { type NextRequest } from "next/server";

/**
 * GET /api/clans/all?search=xxx
 * Admin-only: List all clans with member counts, leaders, and logos.
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        const search = request.nextUrl.searchParams.get("search")?.trim() || "";

        const where: Record<string, unknown> = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { tag: { contains: search, mode: "insensitive" } },
                { leader: { displayName: { contains: search, mode: "insensitive" } } },
                { leader: { user: { username: { contains: search, mode: "insensitive" } } } },
                { leader: { user: { email: { contains: search, mode: "insensitive" } } } },
            ];
        }

        const clans = await prisma.clan.findMany({
            where,
            include: {
                leader: {
                    select: {
                        id: true,
                        displayName: true,
                        customProfileImageUrl: true,
                        user: { select: { username: true, imageUrl: true } },
                    },
                },
                _count: {
                    select: { members: true, teams: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const data = clans.map((clan) => ({
            id: clan.id,
            name: clan.name,
            tag: clan.tag,
            description: clan.description,
            logoUrl: clan.logoUrl,
            createdAt: clan.createdAt,
            leader: {
                id: clan.leader.id,
                displayName: clan.leader.displayName ?? clan.leader.user.username,
                imageUrl: clan.leader.customProfileImageUrl ?? clan.leader.user.imageUrl ?? "",
            },
            memberCount: clan._count.members,
            teamCount: clan._count.teams,
        }));

        return SuccessResponse({ data, cache: CACHE.NONE });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch clans", error });
    }
}
