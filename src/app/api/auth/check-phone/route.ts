import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { type NextRequest } from "next/server";

/**
 * Normalize phone number to 10 digits.
 */
function normalizePhone(phone: string): string {
    const digits = phone.replace(/[\s\-\(\)]/g, "");
    if (digits.startsWith("+91") && digits.length === 13) return digits.slice(3);
    if (digits.startsWith("91") && digits.length === 12) return digits.slice(2);
    return digits;
}

/**
 * POST /api/auth/check-phone
 * Public endpoint (no auth required).
 * Check if a phone number belongs to an existing real (non-ghost) player.
 * Returns the player's display name and previous roster if found.
 *
 * Body: { phone: string, pollId?: string }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { phone: rawPhone, pollId } = body as { phone?: string; pollId?: string };

        if (!rawPhone) {
            return ErrorResponse({ message: "Phone number required", status: 400 });
        }

        const phone = normalizePhone(rawPhone);

        if (phone.length !== 10 || !/^\d{10}$/.test(phone)) {
            return ErrorResponse({ message: "Enter a valid 10-digit phone number", status: 400 });
        }

        // Look for a real (non-ghost) player with this phone
        const player = await prisma.player.findFirst({
            where: {
                phoneNumber: phone,
                isGhost: false,
                isBanned: false,
            },
            select: {
                id: true,
                displayName: true,
                customProfileImageUrl: true,
                user: {
                    select: {
                        imageUrl: true,
                    },
                },
            },
        });

        if (!player) {
            return SuccessResponse({ data: { found: false } });
        }

        // Fetch previous roster if pollId provided
        let previousRoster = null;
        if (pollId) {
            const previousSquad = await prisma.squad.findFirst({
                where: {
                    captainId: player.id,
                    pollId: { not: pollId },
                    status: { in: ["FORMING", "FULL", "REGISTERED", "CANCELLED"] },
                },
                orderBy: { createdAt: "desc" },
                select: {
                    name: true,
                    fullName: true,
                    invites: {
                        where: {
                            status: "ACCEPTED",
                            playerId: { not: player.id },
                        },
                        select: {
                            playerId: true,
                            isSub: true,
                            player: {
                                select: {
                                    displayName: true,
                                    isGhost: true,
                                    isBanned: true,
                                    phoneNumber: true,
                                    customProfileImageUrl: true,
                                    user: { select: { username: true, imageUrl: true } },
                                },
                            },
                        },
                    },
                },
            });

            if (previousSquad && previousSquad.invites.length > 0) {
                // Check availability for current poll
                const memberIds = previousSquad.invites.map((i) => i.playerId);
                const inCurrentPoll = await prisma.squadInvite.findMany({
                    where: {
                        playerId: { in: memberIds },
                        status: { in: ["PENDING", "ACCEPTED"] },
                        squad: { pollId, status: { in: ["FORMING", "FULL"] } },
                    },
                    select: { playerId: true, squad: { select: { name: true } } },
                });
                const inPollMap = new Map<string, string>();
                for (const inv of inCurrentPoll) {
                    inPollMap.set(inv.playerId, inv.squad.name);
                }

                previousRoster = {
                    squadName: previousSquad.name,
                    fullName: previousSquad.fullName,
                    members: previousSquad.invites.map((inv) => {
                        const p = inv.player;
                        const existingTeam = inPollMap.get(inv.playerId) || null;
                        return {
                            playerId: inv.playerId,
                            displayName: p.displayName ?? p.user.username ?? "Player",
                            imageUrl: p.customProfileImageUrl ?? p.user.imageUrl ?? "",
                            isGhost: p.isGhost,
                            isSub: inv.isSub,
                            phone: p.phoneNumber || null,
                            available: !existingTeam && !p.isBanned,
                        };
                    }),
                };
            }
        }

        return SuccessResponse({
            data: {
                found: true,
                displayName: player.displayName,
                imageUrl: player.customProfileImageUrl ?? player.user.imageUrl ?? null,
                previousRoster,
            },
        });
    } catch (error) {
        console.error("Failed to check phone:", error);
        return ErrorResponse({ message: "Failed to check phone", error });
    }
}
