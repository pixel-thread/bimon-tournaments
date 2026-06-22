import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { type NextRequest } from "next/server";

/**
 * Normalize phone number to 10 digits.
 * Strips +91, 91 prefix, spaces, dashes.
 */
function normalizePhone(phone: string): string {
    const digits = phone.replace(/[\s\-\(\)]/g, "");
    // Strip +91 or 91 prefix
    if (digits.startsWith("+91") && digits.length === 13) return digits.slice(3);
    if (digits.startsWith("91") && digits.length === 12) return digits.slice(2);
    return digits;
}

/**
 * POST /api/squads/[squadId]/add-member
 * 
 * Add a teammate by phone/email + name.
 * - If phone/email matches a real player → return { matched: true, player } for confirmation
 * - If matches a ghost player → update name, add to squad directly
 * - If no match → create ghost User + Player, add to squad
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ squadId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        const { squadId } = await params;
        const body = await request.json();
        const { phone: rawPhone, email: rawEmail, name, isSub, confirm } = body as {
            phone?: string;
            email?: string;
            name: string;
            isSub?: boolean;
            confirm?: boolean; // admin: skip confirmation, add directly
        };

        const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

        const phone = rawPhone ? normalizePhone(rawPhone) : null;
        const email = rawEmail?.trim().toLowerCase() || null;

        if (!phone && !email && !name?.trim()) {
            return ErrorResponse({ message: "Player name is required", status: 400 });
        }

        if (phone && (phone.length !== 10 || !/^\d{10}$/.test(phone))) {
            return ErrorResponse({ message: "Enter a valid 10-digit phone number", status: 400 });
        }

        if (!name?.trim()) {
            return ErrorResponse({ message: "Player name is required", status: 400 });
        }

        const trimmedName = name.trim().slice(0, 20);
        const currentPlayerId = user.player.id;

        // Verify captain owns this squad and squad is forming
        const squad = await prisma.squad.findUnique({
            where: { id: squadId },
            select: {
                id: true,
                captainId: true,
                status: true,
                pollId: true,
                poll: { select: { allowSquads: true } },
                invites: { select: { playerId: true, status: true, isSub: true } },
            },
        });

        if (!squad) {
            return ErrorResponse({ message: "Squad not found", status: 404 });
        }

        if (squad.captainId !== currentPlayerId && !isAdmin) {
            return ErrorResponse({ message: "Only the captain can add members", status: 403 });
        }

        if (!['FORMING', 'FULL'].includes(squad.status)) {
            return ErrorResponse({ message: "Squad is not accepting members", status: 400 });
        }

        if (!squad.poll.allowSquads) {
            return ErrorResponse({ message: "This tournament doesn't support ghost members", status: 400 });
        }

        // Check squad roster size
        const activeMembers = squad.invites.filter(
            (i) => i.status === "ACCEPTED" && !i.isSub
        ).length;
        const subs = squad.invites.filter(
            (i) => i.status === "ACCEPTED" && i.isSub
        ).length;
        const maxActive = GAME.squadSize;
        const maxTotal = GAME.maxSquadSize;

        // Auto-assign as sub if active slots are full
        if (!isSub && activeMembers >= maxActive) {
            isSub = true; // auto-promote to sub
        }

        if (isSub && subs >= maxTotal - maxActive) {
            return ErrorResponse({ message: "All slots are filled (active + subs)", status: 400 });
        }
        if (!isSub && activeMembers >= maxActive) {
            return ErrorResponse({ message: "All active slots are filled", status: 400 });
        }

        // Check if contact already in this squad
        const existingInSquad = squad.invites.find((i) => {
            return i.status === "ACCEPTED" || i.status === "PENDING";
        });

        // Search for existing player by phone or email
        let foundPlayer = null;

        if (phone) {
            foundPlayer = await prisma.player.findFirst({
                where: { phoneNumber: phone },
                select: {
                    id: true,
                    displayName: true,
                    isGhost: true,
                    phoneNumber: true,
                    customProfileImageUrl: true,
                    user: { select: { email: true, username: true, imageUrl: true } },
                },
            });
        }

        if (!foundPlayer && email) {
            const userByEmail = await prisma.user.findFirst({
                where: {
                    OR: [
                        { email },
                        { secondaryEmail: email },
                    ],
                },
                include: {
                    player: {
                        select: {
                            id: true,
                            displayName: true,
                            isGhost: true,
                            phoneNumber: true,
                            customProfileImageUrl: true,
                            user: { select: { email: true, username: true, imageUrl: true } },
                        },
                    },
                },
            });
            foundPlayer = userByEmail?.player || null;
        }

        // If found player is the captain themselves, reject
        if (foundPlayer?.id === currentPlayerId) {
            return ErrorResponse({ message: "You're already in this squad!", status: 400 });
        }

        // If found player is already in this squad
        if (foundPlayer) {
            const alreadyInSquad = squad.invites.some(
                (i) => i.playerId === foundPlayer!.id && (i.status === "ACCEPTED" || i.status === "PENDING")
            );
            if (alreadyInSquad) {
                return ErrorResponse({ message: "This player is already in your squad", status: 400 });
            }

            // Check if player is in another squad for this tournament
            const inOtherSquad = await prisma.squadInvite.findFirst({
                where: {
                    playerId: foundPlayer.id,
                    status: { in: ["ACCEPTED", "PENDING"] },
                    squad: {
                        pollId: squad.pollId,
                        status: { in: ["FORMING", "FULL"] },
                        id: { not: squadId },
                    },
                },
            });
            if (inOtherSquad) {
                return ErrorResponse({
                    message: "This player is already in another squad for this tournament",
                    status: 400,
                });
            }
        }

        // ─── Case A: Real player found ───
        if (foundPlayer && !foundPlayer.isGhost) {
            // Admin with confirm=true → add directly with ACCEPTED status
            if (isAdmin && confirm) {
                // Remove any existing poll vote
                await prisma.playerPollVote.deleteMany({
                    where: { pollId: squad.pollId, playerId: foundPlayer.id },
                });

                await prisma.squadInvite.create({
                    data: {
                        squadId,
                        playerId: foundPlayer.id,
                        status: "ACCEPTED",
                        initiatedBy: "CAPTAIN",
                        isSub: isSub ?? false,
                        respondedAt: new Date(),
                    },
                });

                await updateSquadStatus(squadId);

                return SuccessResponse({
                    data: {
                        added: true,
                        player: {
                            id: foundPlayer.id,
                            displayName: foundPlayer.displayName ?? foundPlayer.user.username,
                            isGhost: false,
                        },
                    },
                    message: `✅ ${foundPlayer.displayName} added to squad`,
                });
            }

            // Non-admin or no confirm → return for confirmation
            return SuccessResponse({
                data: {
                    matched: true,
                    player: {
                        id: foundPlayer.id,
                        displayName: foundPlayer.displayName ?? foundPlayer.user.username,
                        imageUrl: foundPlayer.customProfileImageUrl ?? foundPlayer.user.imageUrl,
                        phone: foundPlayer.phoneNumber || null,
                        email: foundPlayer.user.email || null,
                    },
                },
            });
        }

        // ─── Case B: Ghost player found → update name, add to squad ───
        if (foundPlayer && foundPlayer.isGhost) {
            // Update display name (latest wins)
            await prisma.player.update({
                where: { id: foundPlayer.id },
                data: { displayName: trimmedName },
            });

            // Create squad invite
            await prisma.squadInvite.create({
                data: {
                    squadId,
                    playerId: foundPlayer.id,
                    status: "ACCEPTED",
                    initiatedBy: "CAPTAIN",
                    isSub: isSub ?? false,
                    respondedAt: new Date(),
                },
            });

            // Update squad status if full
            await updateSquadStatus(squadId);

            return SuccessResponse({
                data: {
                    added: true,
                    player: {
                        id: foundPlayer.id,
                        displayName: trimmedName,
                        isGhost: true,
                    },
                },
                message: `👻 ${trimmedName} added to squad`,
            });
        }

        // ─── Case C: No match → create ghost User + Player ───
        const contactKey = phone || email || `anon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const ghostClerkId = `ghost_${contactKey}`;
        const ghostUsername = `ghost_${contactKey}`;

        // Check if ghost user already exists (edge case — ghost User without Player)
        let ghostUser = await prisma.user.findFirst({
            where: { clerkId: ghostClerkId },
        });

        if (!ghostUser) {
            ghostUser = await prisma.user.create({
                data: {
                    clerkId: ghostClerkId,
                    username: ghostUsername,
                    email: null,
                    role: "USER",
                    isOnboarded: false,
                },
            });
        }

        // Create ghost player
        const ghostPlayer = await prisma.player.create({
            data: {
                userId: ghostUser.id,
                displayName: trimmedName,
                phoneNumber: phone || null,
                isGhost: true,
            },
        });

        // Create squad invite
        await prisma.squadInvite.create({
            data: {
                squadId,
                playerId: ghostPlayer.id,
                status: "ACCEPTED",
                initiatedBy: "CAPTAIN",
                isSub: isSub ?? false,
                respondedAt: new Date(),
            },
        });

        // Update squad status if full
        await updateSquadStatus(squadId);

        return SuccessResponse({
            data: {
                added: true,
                player: {
                    id: ghostPlayer.id,
                    displayName: trimmedName,
                    isGhost: true,
                },
            },
            message: `${trimmedName} added to squad`,
        });
    } catch (error) {
        console.error("Failed to add member:", error);
        return ErrorResponse({ message: "Failed to add member", error });
    }
}

/**
 * Update squad status to FULL if all active slots are filled.
 */
async function updateSquadStatus(squadId: string) {
    const squad = await prisma.squad.findUnique({
        where: { id: squadId },
        select: {
            status: true,
            invites: {
                where: { status: "ACCEPTED", isSub: false },
                select: { id: true },
            },
        },
    });

    if (!squad) return;

    const activeCount = squad.invites.length;
    if (activeCount >= GAME.squadSize && squad.status === "FORMING") {
        await prisma.squad.update({
            where: { id: squadId },
            data: { status: "FULL" },
        });
    }
}
