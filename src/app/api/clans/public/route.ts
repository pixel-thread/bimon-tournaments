import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { type NextRequest } from "next/server";
import { getLevelFromXP } from "@/lib/clan-xp";

/**
 * GET /api/clans/public?search=xxx
 * Public endpoint — no auth required.
 * Returns all clans with level, member count, and optionally treasury balance.
 */
export async function GET(request: NextRequest) {
    try {
        const search = request.nextUrl.searchParams.get("search")?.trim() || "";

        const where: Record<string, unknown> = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { tag: { contains: search, mode: "insensitive" } },
            ];
        }

        const clans = await prisma.clan.findMany({
            where,
            include: {
                leader: {
                    select: {
                        displayName: true,
                        customProfileImageUrl: true,
                        user: { select: { username: true, imageUrl: true } },
                    },
                },
                _count: { select: { members: true } },
            },
            orderBy: [{ level: "desc" }, { xp: "desc" }, { createdAt: "asc" }],
            take: 100,
        });

        const data = clans.map((clan) => {
            const { progress } = getLevelFromXP(clan.xp);
            return {
                id: clan.id,
                name: clan.name,
                tag: clan.tag,
                logoUrl: clan.logoUrl,
                description: clan.description,
                level: clan.level,
                levelProgress: progress,
                memberCount: clan._count.members,
                leaderName: clan.leader.displayName ?? clan.leader.user.username,
                leaderImageUrl: clan.leader.customProfileImageUrl ?? clan.leader.user.imageUrl ?? "",
                // Only expose balance if leader opted in
                ...(clan.showTreasuryPublic ? { balance: clan.balance } : {}),
                createdAt: clan.createdAt,
            };
        });

        return SuccessResponse({ data, cache: CACHE.SHORT });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch clans", error });
    }
}
