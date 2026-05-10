import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { getLevelFromXP } from "@/lib/clan-xp";

/**
 * GET /api/clans
 * Fetch the current player's clan (if any) with full member list,
 * plus any pending clan invites they've received.
 */
export async function GET() {
    try {
        const email = await getAuthEmail();
        if (!email) return ErrorResponse({ message: "Unauthorized", status: 401 });

        const user = await prisma.user.findFirst({
            where: userWhereEmail(email),
            select: { player: { select: { id: true } } },
        });
        if (!user?.player) return ErrorResponse({ message: "Player not found", status: 404 });

        const playerId = user.player.id;

        // Get clan membership + pending invites in parallel
        const [membership, pendingInvites] = await Promise.all([
            prisma.clanMember.findUnique({
                where: { playerId },
                include: {
                    clan: {
                        include: {
                            members: {
                                include: {
                                    player: {
                                        select: {
                                            id: true,
                                            displayName: true,
                                            customProfileImageUrl: true,
                                            user: { select: { username: true, imageUrl: true } },
                                        },
                                    },
                                },
                                orderBy: { joinedAt: "asc" },
                            },
                        },
                    },
                },
            }),
            prisma.clanInvite.findMany({
                where: { playerId, status: "PENDING" },
                include: {
                    clan: {
                        select: {
                            id: true,
                            name: true,
                            tag: true,
                            description: true,
                            logoUrl: true,
                            leader: {
                                select: {
                                    displayName: true,
                                    customProfileImageUrl: true,
                                    user: { select: { username: true, imageUrl: true } },
                                },
                            },
                            _count: { select: { members: true } },
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
        ]);

        const clan = membership
            ? {
                id: membership.clan.id,
                name: membership.clan.name,
                tag: membership.clan.tag,
                description: membership.clan.description,
                logoUrl: membership.clan.logoUrl,
                leaderId: membership.clan.leaderId,
                level: membership.clan.level,
                levelProgress: getLevelFromXP(membership.clan.xp).progress,
                myRole: membership.role,
                members: membership.clan.members.map((m) => ({
                    id: m.player.id,
                    displayName: m.player.displayName || m.player.user.username,
                    imageUrl: m.player.customProfileImageUrl || m.player.user.imageUrl,
                    role: m.role,
                    joinedAt: m.joinedAt,
                })),
            }
            : null;

        const invites = pendingInvites.map((inv) => ({
            id: inv.id,
            clanId: inv.clan.id,
            clanName: inv.clan.name,
            clanTag: inv.clan.tag,
            clanDescription: inv.clan.description,
            clanLogoUrl: inv.clan.logoUrl,
            leaderName:
                inv.clan.leader.displayName ||
                inv.clan.leader.user.username,
            leaderImageUrl:
                inv.clan.leader.customProfileImageUrl ||
                inv.clan.leader.user.imageUrl,
            memberCount: inv.clan._count.members,
            createdAt: inv.createdAt,
        }));

        return SuccessResponse({ data: { clan, pendingInvites: invites }, cache: CACHE.NONE });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch clan", error });
    }
}

/**
 * POST /api/clans
 * Create a new clan. Requires:
 *  - Player not already in a clan
 */
export async function POST(request: Request) {
    try {
        const email = await getAuthEmail();
        if (!email) return ErrorResponse({ message: "Unauthorized", status: 401 });

        const user = await prisma.user.findFirst({
            where: userWhereEmail(email),
            select: { player: { select: { id: true } } },
        });
        if (!user?.player) return ErrorResponse({ message: "Player not found", status: 404 });

        const playerId = user.player.id;
        const body = await request.json();
        const { name, tag, description } = body as {
            name?: string;
            tag?: string;
            description?: string;
        };

        // Validate inputs
        if (!name?.trim() || !tag?.trim()) {
            return ErrorResponse({ message: `${GAME.clanLabel} name and tag are required`, status: 400 });
        }

        const cleanName = name.trim();
        const cleanTag = tag.trim().toUpperCase();

        if (cleanName.length < 3 || cleanName.length > 30) {
            return ErrorResponse({ message: `${GAME.clanLabel} name must be 3–30 characters`, status: 400 });
        }
        if (cleanTag.length < 2 || cleanTag.length > 4) {
            return ErrorResponse({ message: "Tag must be 2–4 characters", status: 400 });
        }
        if (!/^[A-Z0-9]+$/.test(cleanTag)) {
            return ErrorResponse({ message: "Tag can only contain letters and numbers", status: 400 });
        }

        // Check if already in a clan
        const existingMembership = await prisma.clanMember.findUnique({
            where: { playerId },
        });
        if (existingMembership) {
            return ErrorResponse({ message: `You are already in a ${GAME.clanLabel.toLowerCase()}`, status: 400 });
        }


        // Check uniqueness
        const [nameExists, tagExists] = await Promise.all([
            prisma.clan.findUnique({ where: { name: cleanName } }),
            prisma.clan.findUnique({ where: { tag: cleanTag } }),
        ]);
        if (nameExists) {
            return ErrorResponse({ message: `A ${GAME.clanLabel.toLowerCase()} with this name already exists`, status: 400 });
        }
        if (tagExists) {
            return ErrorResponse({ message: "A tag with this name already exists", status: 400 });
        }

        // Create clan + add leader as first member
        const clan = await prisma.clan.create({
            data: {
                name: cleanName,
                tag: cleanTag,
                description: description?.trim() || null,
                leaderId: playerId,
                members: {
                    create: {
                        playerId,
                        role: "LEADER",
                    },
                },
            },
        });

        return SuccessResponse({ data: clan, status: 201 });
    } catch (error) {
        return ErrorResponse({ message: `Failed to create ${GAME.clanLabel.toLowerCase()}`, error });
    }
}
