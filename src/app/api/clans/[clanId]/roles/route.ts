import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { type NextRequest } from "next/server";

/**
 * POST /api/clans/[clanId]/roles
 * Manage clan member roles.
 * Body: { playerId, action: "PROMOTE_CO_LEADER" | "DEMOTE_TO_MEMBER" | "TRANSFER_LEADER" }
 *
 * Rules:
 * - Only the LEADER can promote/demote/transfer.
 * - Max 5 CO_LEADERs per clan.
 * - TRANSFER_LEADER swaps roles: current leader becomes MEMBER, target becomes LEADER.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ clanId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Player profile required", status: 403 });
        }

        const { clanId } = await params;
        const body = await request.json();
        const { playerId, action } = body as {
            playerId: string;
            action: "PROMOTE_CO_LEADER" | "DEMOTE_TO_MEMBER" | "TRANSFER_LEADER";
        };

        if (!playerId || !action) {
            return ErrorResponse({ message: "playerId and action are required", status: 400 });
        }

        // Verify the current user is the clan leader
        const clan = await prisma.clan.findUnique({
            where: { id: clanId },
            select: { id: true, leaderId: true, name: true },
        });

        if (!clan) {
            return ErrorResponse({ message: "Clan not found", status: 404 });
        }

        if (clan.leaderId !== user.player.id) {
            return ErrorResponse({ message: "Only the clan leader can manage roles", status: 403 });
        }

        if (playerId === user.player.id) {
            return ErrorResponse({ message: "You cannot change your own role", status: 400 });
        }

        // Verify target is a member of this clan
        const targetMember = await prisma.clanMember.findFirst({
            where: { clanId, playerId },
            select: { id: true, role: true },
        });

        if (!targetMember) {
            return ErrorResponse({ message: "Player is not a member of this clan", status: 400 });
        }

        switch (action) {
            case "PROMOTE_CO_LEADER": {
                if (targetMember.role === "CO_LEADER") {
                    return ErrorResponse({ message: "Player is already a co-leader", status: 400 });
                }

                // Check max 5 co-leaders
                const coLeaderCount = await prisma.clanMember.count({
                    where: { clanId, role: "CO_LEADER" },
                });

                if (coLeaderCount >= 5) {
                    return ErrorResponse({
                        message: "Maximum 5 co-leaders allowed per clan",
                        status: 400,
                    });
                }

                await prisma.clanMember.update({
                    where: { id: targetMember.id },
                    data: { role: "CO_LEADER" },
                });

                return SuccessResponse({ message: "Player promoted to co-leader" });
            }

            case "DEMOTE_TO_MEMBER": {
                if (targetMember.role === "MEMBER") {
                    return ErrorResponse({ message: "Player is already a member", status: 400 });
                }

                await prisma.clanMember.update({
                    where: { id: targetMember.id },
                    data: { role: "MEMBER" },
                });

                return SuccessResponse({ message: "Player demoted to member" });
            }

            case "TRANSFER_LEADER": {
                // Swap: current leader → MEMBER in ClanMember table, target → LEADER (via Clan.leaderId)
                await prisma.$transaction(async (tx) => {
                    // Make the target the new leader
                    await tx.clan.update({
                        where: { id: clanId },
                        data: { leaderId: playerId },
                    });

                    // Update the target's role to LEADER (or remove from ClanMember since leader uses Clan.leaderId)
                    // Keep them as CO_LEADER/MEMBER but with leaderId pointing to them — depends on schema design
                    // Since Clan.leaderId is the canonical leader reference, we set the target's ClanMember role to LEADER
                    await tx.clanMember.update({
                        where: { id: targetMember.id },
                        data: { role: "LEADER" },
                    });

                    // Add the old leader (current user) to ClanMember as MEMBER
                    // First check if they already have a ClanMember record
                    const existingMembership = await tx.clanMember.findUnique({
                        where: { playerId: user.player!.id },
                    });

                    if (existingMembership) {
                        await tx.clanMember.update({
                            where: { id: existingMembership.id },
                            data: { role: "MEMBER" },
                        });
                    } else {
                        await tx.clanMember.create({
                            data: {
                                clanId,
                                playerId: user.player!.id,
                                role: "MEMBER",
                            },
                        });
                    }
                });

                return SuccessResponse({ message: "Leadership transferred successfully" });
            }

            default:
                return ErrorResponse({ message: "Invalid action", status: 400 });
        }
    } catch (error) {
        return ErrorResponse({ message: "Failed to manage clan role", error });
    }
}
