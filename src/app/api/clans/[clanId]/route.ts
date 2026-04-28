import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { type NextRequest } from "next/server";

/**
 * GET /api/clans/[clanId]
 * Public clan view — anyone can see a clan's member list.
 * Used when clicking a clan badge on the player stats modal.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ clanId: string }> }
) {
    try {
        const { clanId } = await params;

        const clan = await prisma.clan.findUnique({
            where: { id: clanId },
            include: {
                members: {
                    include: {
                        player: {
                            select: {
                                id: true,
                                displayName: true,
                                category: true,
                                customProfileImageUrl: true,
                                characterImage: {
                                    select: {
                                        publicUrl: true,
                                        thumbnailUrl: true,
                                        isVideo: true,
                                    },
                                },
                                user: {
                                    select: {
                                        username: true,
                                        imageUrl: true,
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { joinedAt: "asc" },
                },
            },
        });

        if (!clan) {
            return ErrorResponse({ message: "Clan not found", status: 404 });
        }

        return SuccessResponse({
            data: {
                id: clan.id,
                name: clan.name,
                tag: clan.tag,
                description: clan.description,
                logoUrl: clan.logoUrl,
                leaderId: clan.leaderId,
                members: clan.members.map((m) => ({
                    id: m.player.id,
                    displayName: m.player.displayName || m.player.user.username,
                    username: m.player.user.username,
                    imageUrl: m.player.customProfileImageUrl || m.player.user.imageUrl,
                    category: m.player.category,
                    role: m.role,
                    joinedAt: m.joinedAt,
                })),
                memberCount: clan.members.length,
                createdAt: clan.createdAt,
            },
            cache: CACHE.SHORT,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch clan", error });
    }
}
