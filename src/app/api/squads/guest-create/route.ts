import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { GAME } from "@/lib/game-config";
import { type NextRequest } from "next/server";
import { containsProfanity } from "@/lib/profanity";

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
 * POST /api/squads/guest-create
 * Public endpoint — no auth required.
 * Creates a ghost captain + squad + ghost teammates in one call.
 *
 * Body: {
 *   pollId: string,
 *   captainName: string,
 *   captainPhone: string,
 *   teamName: string,
 *   teamFullName?: string,
 *   members: { name: string, phone?: string }[]
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            pollId,
            captainName: rawCaptainName,
            captainPhone: rawCaptainPhone,
            teamName: rawTeamName,
            teamFullName,
            members = [],
        } = body as {
            pollId: string;
            captainName: string;
            captainPhone: string;
            teamName: string;
            teamFullName?: string;
            members?: { name: string; phone?: string }[];
        };

        if (!pollId) return ErrorResponse({ message: "pollId is required", status: 400 });
        if (!rawCaptainName?.trim()) return ErrorResponse({ message: "Captain name is required", status: 400 });
        if (!rawCaptainPhone) return ErrorResponse({ message: "Phone number is required", status: 400 });

        const captainName = rawCaptainName.trim().slice(0, 20);
        const captainPhone = normalizePhone(rawCaptainPhone);
        const teamName = (rawTeamName || "").trim().slice(0, 7);
        const fullName = teamFullName?.trim().slice(0, 30) || null;

        if (captainPhone.length !== 10 || !/^\d{10}$/.test(captainPhone)) {
            return ErrorResponse({ message: "Enter a valid 10-digit phone number", status: 400 });
        }

        if (!teamName) {
            return ErrorResponse({ message: "Team name is required", status: 400 });
        }

        // Profanity check
        const badWord = containsProfanity(teamName) || (fullName ? containsProfanity(fullName) : null) || containsProfanity(captainName);
        if (badWord) {
            return ErrorResponse({ message: "Name contains inappropriate language", status: 400 });
        }

        // Validate poll
        const poll = await prisma.poll.findUnique({
            where: { id: pollId },
            include: {
                tournament: { select: { id: true, fee: true, status: true, isMangoScrim: true } },
            },
        });

        if (!poll || !poll.isActive) {
            return ErrorResponse({ message: "Tournament voting is not active", status: 400 });
        }
        if (!poll.allowSquads) {
            return ErrorResponse({ message: "Squads are not enabled for this tournament", status: 400 });
        }

        const entryFee = poll.tournament?.fee ?? 0;
        const isMangoScrim = poll.tournament?.isMangoScrim ?? false;

        // Check registration cap
        const registrationCap = isMangoScrim ? 18 : 32;
        const activeSquadCount = await prisma.squad.count({
            where: { pollId, status: { in: ["FORMING", "FULL"] } },
        });
        if (activeSquadCount >= registrationCap) {
            return ErrorResponse({
                message: `All ${registrationCap} slots are filled. Try again next tournament!`,
                status: 400,
            });
        }

        // Find or create ghost captain
        // Check if a ghost player with this phone already exists
        let captainPlayer = await prisma.player.findFirst({
            where: { phoneNumber: captainPhone, isGhost: true },
            select: { id: true, displayName: true, userId: true },
        });

        if (captainPlayer) {
            // Update name
            await prisma.player.update({
                where: { id: captainPlayer.id },
                data: { displayName: captainName },
            });

            // Check if already in a squad for this poll
            const existingSquad = await prisma.squad.findFirst({
                where: {
                    pollId,
                    status: { in: ["FORMING", "FULL"] },
                    OR: [
                        { captainId: captainPlayer.id },
                        { invites: { some: { playerId: captainPlayer.id, status: { in: ["PENDING", "ACCEPTED"] } } } },
                    ],
                },
            });
            if (existingSquad) {
                return ErrorResponse({ message: "This phone number is already registered for this tournament", status: 400 });
            }
        } else {
            // Check if a real (non-ghost) player has this phone — they should sign in instead
            const realPlayer = await prisma.player.findFirst({
                where: { phoneNumber: captainPhone, isGhost: false },
                select: { id: true, displayName: true },
            });
            if (realPlayer) {
                // Still allow ghost creation, but the check-phone API would have caught this
                // and prompted the user. They chose "No" so we proceed.
            }

            // Create ghost user + player
            const ghostClerkId = `ghost_${captainPhone}`;
            let ghostUser = await prisma.user.findFirst({
                where: { clerkId: ghostClerkId },
            });

            if (!ghostUser) {
                ghostUser = await prisma.user.create({
                    data: {
                        clerkId: ghostClerkId,
                        username: `ghost_${captainPhone}`,
                        email: null,
                        role: "USER",
                        isOnboarded: false,
                    },
                });
            }

            captainPlayer = await prisma.player.create({
                data: {
                    userId: ghostUser.id,
                    displayName: captainName,
                    phoneNumber: captainPhone,
                    isGhost: true,
                },
            });
        }

        // Create squad
        const squad = await prisma.$transaction(async (tx) => {
            // Check for cancelled squad to reuse
            const cancelledSquad = await tx.squad.findFirst({
                where: { pollId, captainId: captainPlayer!.id, status: "CANCELLED" },
            });

            let newSquad;
            if (cancelledSquad) {
                await tx.squadInvite.deleteMany({ where: { squadId: cancelledSquad.id } });
                newSquad = await tx.squad.update({
                    where: { id: cancelledSquad.id },
                    data: {
                        name: teamName,
                        fullName,
                        status: "FORMING",
                        entryFee,
                        createdAt: new Date(),
                        confirmedAt: new Date(), // Ghost captains auto-confirmed
                        invites: {
                            create: {
                                playerId: captainPlayer!.id,
                                status: "ACCEPTED",
                                respondedAt: new Date(),
                            },
                        },
                    },
                });
            } else {
                newSquad = await tx.squad.create({
                    data: {
                        name: teamName,
                        fullName,
                        pollId,
                        captainId: captainPlayer!.id,
                        entryFee,
                        confirmedAt: new Date(), // Ghost captains auto-confirmed
                        invites: {
                            create: {
                                playerId: captainPlayer!.id,
                                status: "ACCEPTED",
                                respondedAt: new Date(),
                            },
                        },
                    },
                });
            }

            // Add ghost teammates
            let totalCount = 1; // captain

            for (const member of members.slice(0, GAME.maxSquadSize - 1)) {
                if (!member.name?.trim()) continue;

                const memberName = member.name.trim().slice(0, 20);
                const memberPhone = member.phone ? normalizePhone(member.phone) : null;

                // Find or create ghost player for this member
                let memberPlayer = null;

                if (memberPhone && memberPhone.length === 10) {
                    memberPlayer = await tx.player.findFirst({
                        where: { phoneNumber: memberPhone, isGhost: true },
                    });

                    if (memberPlayer) {
                        // Update name
                        await tx.player.update({
                            where: { id: memberPlayer.id },
                            data: { displayName: memberName },
                        });
                    }
                }

                if (!memberPlayer) {
                    const contactKey = memberPhone || `anon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                    const ghostClerkId = `ghost_${contactKey}`;
                    const ghostUsername = `ghost_${contactKey}`;

                    let ghostUser = await tx.user.findFirst({
                        where: { clerkId: ghostClerkId },
                    });

                    if (!ghostUser) {
                        ghostUser = await tx.user.create({
                            data: {
                                clerkId: ghostClerkId,
                                username: ghostUsername,
                                email: null,
                                role: "USER",
                                isOnboarded: false,
                            },
                        });
                    }

                    // Check if ghost player already exists for this user
                    memberPlayer = await tx.player.findFirst({
                        where: { userId: ghostUser.id },
                    });

                    if (!memberPlayer) {
                        memberPlayer = await tx.player.create({
                            data: {
                                userId: ghostUser.id,
                                displayName: memberName,
                                phoneNumber: memberPhone || null,
                                isGhost: true,
                            },
                        });
                    } else {
                        await tx.player.update({
                            where: { id: memberPlayer.id },
                            data: { displayName: memberName },
                        });
                    }
                }

                // Check if already in a squad for this poll
                const existing = await tx.squadInvite.findFirst({
                    where: {
                        playerId: memberPlayer.id,
                        status: { in: ["PENDING", "ACCEPTED"] },
                        squad: { pollId, status: { in: ["FORMING", "FULL"] } },
                    },
                });
                if (existing) continue;

                if (totalCount >= GAME.maxSquadSize) continue;

                await tx.squadInvite.create({
                    data: {
                        squadId: newSquad.id,
                        playerId: memberPlayer.id,
                        status: "ACCEPTED",
                        initiatedBy: "CAPTAIN",
                        isSub: false,
                        respondedAt: new Date(),
                    },
                });

                totalCount++;
            }

            // Update status
            if (totalCount >= GAME.maxSquadSize) {
                await tx.squad.update({
                    where: { id: newSquad.id, status: "FORMING" },
                    data: { status: "FULL" },
                });
            }

            return newSquad;
        });

        return SuccessResponse({
            data: { id: squad.id, name: squad.name },
            message: `Team "${teamName}" created! 🎉`,
        });
    } catch (error) {
        console.error("Failed to create guest squad:", error);
        return ErrorResponse({ message: "Failed to create team", error });
    }
}
