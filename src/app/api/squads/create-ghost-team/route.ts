import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { containsProfanity } from "@/lib/profanity";
import { checkKdGate } from "@/lib/logic/kd-gate";
import { type NextRequest } from "next/server";

/**
 * POST /api/squads/create-ghost-team
 * Admin-only: Create a full squad in one shot.
 *
 * Captain is looked up by phone — if a real player exists, they become captain.
 * Otherwise a ghost captain is created with that phone for contact.
 * Rest of the roster are name-only ghost players.
 *
 * Body: {
 *   pollId: string,
 *   name: string,              // team tag (max 7 chars)
 *   fullName?: string,         // optional full team name
 *   captainName: string,       // captain display name
 *   captainPhone: string,      // captain phone (required — for prize contact)
 *   members: string[],         // array of member names (name-only ghosts)
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
        if (!isAdmin) {
            return ErrorResponse({ message: "Admin only", status: 403 });
        }

        const body = await request.json();
        const { pollId, name, fullName: rawFullName, captainName, captainPhone, members = [] } = body as {
            pollId: string;
            name: string;
            fullName?: string;
            captainName: string;
            captainPhone: string;
            members: string[];
        };

        if (!pollId) return ErrorResponse({ message: "pollId is required", status: 400 });

        const trimmedName = (name || "").trim().slice(0, 7);
        const fullName = rawFullName?.trim() || null;

        if (!trimmedName) return ErrorResponse({ message: "Team tag is required", status: 400 });
        if (!captainName?.trim()) return ErrorResponse({ message: "Captain name is required", status: 400 });
        if (!captainPhone?.trim()) return ErrorResponse({ message: "Captain phone is required — needed for prize payouts", status: 400 });

        const cleanCaptainName = captainName.trim().slice(0, 20);
        const cleanPhone = captainPhone.replace(/\D/g, "").slice(-10);
        if (cleanPhone.length !== 10) {
            return ErrorResponse({ message: "Captain phone must be 10 digits", status: 400 });
        }

        const totalPlayers = 1 + members.length; // captain + members
        if (totalPlayers > GAME.maxSquadSize) {
            return ErrorResponse({ message: `Max ${GAME.maxSquadSize} players (captain + ${GAME.maxSquadSize - 1} members)`, status: 400 });
        }

        // Clean member names
        const cleanMembers = members.map(n => (n || "").trim().slice(0, 20)).filter(Boolean);

        // Profanity check
        const badWord = containsProfanity(trimmedName) || (fullName ? containsProfanity(fullName) : null);
        if (badWord) {
            return ErrorResponse({ message: "Team name contains inappropriate language", status: 400 });
        }

        // Verify poll
        const poll = await prisma.poll.findUnique({
            where: { id: pollId },
            include: {
                tournament: { select: { id: true, fee: true, status: true } },
            },
        });

        if (!poll) return ErrorResponse({ message: "Poll not found", status: 400 });
        if (!poll.allowSquads) return ErrorResponse({ message: "Squads are not enabled", status: 400 });

        // KD gate — admins bypass, so ghosts are allowed
        const ghostKdResult = await checkKdGate("ghost", pollId, { isGhost: true, isAdmin: true });
        if (!ghostKdResult.allowed) {
            return ErrorResponse({ message: "Ghost teams cannot be created for KD-restricted tournaments. All players must have verifiable stats.", status: 403 });
        }

        const entryFee = poll.tournament?.fee ?? 0;

        // Try to find existing player by phone
        const existingPlayer = await prisma.player.findFirst({
            where: { phoneNumber: cleanPhone, isGhost: false },
            select: { id: true, displayName: true },
        });

        // Check if captain is already in a squad for this poll
        if (existingPlayer) {
            const existingSquadInvite = await prisma.squadInvite.findFirst({
                where: {
                    playerId: existingPlayer.id,
                    status: "ACCEPTED",
                    squad: { pollId, status: { in: ["FORMING", "FULL"] } },
                },
            });
            if (existingSquadInvite) {
                return ErrorResponse({
                    message: `${existingPlayer.displayName} is already in a squad for this tournament`,
                    status: 400,
                });
            }
        }

        // Create everything in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // ─── Captain ───
            let captainPlayerId: string;

            if (existingPlayer) {
                // Real player found — use them as captain
                captainPlayerId = existingPlayer.id;
            } else {
                // Create ghost captain with phone
                const ghostClerkId = `ghost_phone_${cleanPhone}`;
                let ghostUser = await tx.user.findFirst({ where: { clerkId: ghostClerkId } });
                if (!ghostUser) {
                    ghostUser = await tx.user.create({
                        data: { clerkId: ghostClerkId, username: ghostClerkId, email: null },
                    });
                }
                let ghostPlayer = await tx.player.findFirst({ where: { userId: ghostUser.id } });
                if (!ghostPlayer) {
                    ghostPlayer = await tx.player.create({
                        data: {
                            userId: ghostUser.id,
                            displayName: cleanCaptainName,
                            phoneNumber: cleanPhone,
                            isGhost: true,
                        },
                    });
                } else {
                    // Update display name
                    await tx.player.update({
                        where: { id: ghostPlayer.id },
                        data: { displayName: cleanCaptainName, phoneNumber: cleanPhone },
                    });
                }
                captainPlayerId = ghostPlayer.id;
            }

            // ─── Ghost Members ───
            const memberPlayerIds: { id: string; name: string }[] = [];

            for (const memberName of cleanMembers) {
                const contactKey = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                const ghostClerkId = `ghost_${contactKey}`;

                const ghostUser = await tx.user.create({
                    data: { clerkId: ghostClerkId, username: ghostClerkId, email: null },
                });

                const ghostPlayer = await tx.player.create({
                    data: {
                        userId: ghostUser.id,
                        displayName: memberName,
                        isGhost: true,
                    },
                });

                memberPlayerIds.push({ id: ghostPlayer.id, name: memberName });
            }

            // ─── Create Squad ───
            const allCount = 1 + cleanMembers.length;
            const squad = await tx.squad.create({
                data: {
                    pollId,
                    captainId: captainPlayerId,
                    name: trimmedName,
                    fullName,
                    entryFee,
                    status: allCount >= GAME.squadSize ? "FULL" : "FORMING",
                },
            });

            // Captain invite
            await tx.squadInvite.create({
                data: {
                    squadId: squad.id,
                    playerId: captainPlayerId,
                    status: "ACCEPTED",
                    initiatedBy: "CAPTAIN",
                    respondedAt: new Date(),
                    isSub: false,
                },
            });

            // Member invites
            for (let i = 0; i < memberPlayerIds.length; i++) {
                const member = memberPlayerIds[i]!;
                const isSub = (i + 1) >= GAME.squadSize; // captain is slot 0
                await tx.squadInvite.create({
                    data: {
                        squadId: squad.id,
                        playerId: member.id,
                        status: "ACCEPTED",
                        initiatedBy: "CAPTAIN",
                        respondedAt: new Date(),
                        isSub,
                    },
                });
            }

            // Remove any poll votes
            const allIds = [captainPlayerId, ...memberPlayerIds.map(m => m.id)];
            await tx.playerPollVote.deleteMany({
                where: { playerId: { in: allIds }, pollId },
            });

            return {
                squad,
                captainIsReal: !!existingPlayer,
                captainName: existingPlayer?.displayName ?? cleanCaptainName,
                memberCount: cleanMembers.length,
            };
        });

        const captainLabel = result.captainIsReal
            ? `${result.captainName} (linked)`
            : `${result.captainName} (📱 ${cleanPhone})`;

        return SuccessResponse({
            data: {
                squadId: result.squad.id,
                squadName: trimmedName,
                captainIsReal: result.captainIsReal,
            },
            message: `Team "${trimmedName}" created! Captain: ${captainLabel}, ${result.memberCount} members 🎉`,
        });
    } catch (error) {
        console.error("Failed to create ghost team:", error);
        return ErrorResponse({ message: "Failed to create team", error });
    }
}
