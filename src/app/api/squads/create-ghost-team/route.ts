import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { containsProfanity } from "@/lib/profanity";
import { checkKdGate } from "@/lib/logic/kd-gate";
import { getAvailableBalance } from "@/lib/wallet-service";
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
        const { pollId, name, fullName: rawFullName, captainName, captainPhone, captainPlayerId, chargeEntryFee, members = [] } = body as {
            pollId: string;
            name: string;
            fullName?: string;
            captainName: string;
            captainPhone?: string;
            captainPlayerId?: string;
            chargeEntryFee?: boolean;
            members: string[];
        };

        if (!pollId) return ErrorResponse({ message: "pollId is required", status: 400 });

        const trimmedName = (name || "").trim().slice(0, 7);
        const fullName = rawFullName?.trim() || null;

        if (!trimmedName) return ErrorResponse({ message: "Team tag is required", status: 400 });
        if (!captainName?.trim()) return ErrorResponse({ message: "Captain name is required", status: 400 });

        const cleanCaptainName = captainName.trim().slice(0, 20);

        // Phone is only required when no existing player is selected
        let cleanPhone = "";
        if (!captainPlayerId) {
            if (!captainPhone?.trim()) return ErrorResponse({ message: "Captain phone is required — needed for prize payouts", status: 400 });
            cleanPhone = captainPhone.replace(/\D/g, "").slice(-10);
            if (cleanPhone.length !== 10) {
                return ErrorResponse({ message: "Captain phone must be 10 digits", status: 400 });
            }
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

        // Try to find existing player by ID (admin-selected) or by phone
        const existingPlayer = captainPlayerId
            ? await prisma.player.findUnique({
                where: { id: captainPlayerId },
                select: { id: true, displayName: true },
            })
            : cleanPhone
                ? await prisma.player.findFirst({
                    where: { phoneNumber: cleanPhone, isGhost: false },
                    select: { id: true, displayName: true },
                })
                : null;

        // Check if captain is already in a squad for this poll
        if (existingPlayer) {
            // Check if player is captain of an active squad in this poll
            const existingCaptainSquad = await prisma.squad.findFirst({
                where: {
                    pollId,
                    captainId: existingPlayer.id,
                    status: { in: ["FORMING", "FULL"] },
                },
            });
            if (existingCaptainSquad) {
                return ErrorResponse({
                    message: `${existingPlayer.displayName} is already captain of "${existingCaptainSquad.name}" in this tournament`,
                    status: 400,
                });
            }

            // Check if player is a member of another squad
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

            // If there's a CANCELLED squad with this captain+poll combo, delete it to avoid unique constraint
            await prisma.squad.deleteMany({
                where: {
                    pollId,
                    captainId: existingPlayer.id,
                    status: "CANCELLED",
                },
            });
        }

        // Create everything in a transaction (increased timeout for complex multi-step operation)
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

            // ─── Balance check when chargeEntryFee is on ───
            let insufficientBalance = false;
            if (chargeEntryFee && entryFee > 0 && existingPlayer) {
                const captainUser = await tx.player.findUnique({
                    where: { id: captainPlayerId },
                    select: { isTrusted: true, user: { select: { email: true, secondaryEmail: true } } },
                });
                if (captainUser && !captainUser.isTrusted) {
                    const email = captainUser.user?.email || captainUser.user?.secondaryEmail;
                    if (email) {
                        const { balance } = await getAvailableBalance(email);
                        insufficientBalance = balance < entryFee;
                    }
                }
            }

            // ─── Create Squad ───
            // Clean up any cancelled/old squads for this captain+poll to avoid unique constraint
            await tx.squad.deleteMany({
                where: { pollId, captainId: captainPlayerId, status: "CANCELLED" },
            });

            const allCount = 1 + cleanMembers.length;
            const squad = await tx.squad.create({
                data: {
                    pollId,
                    captainId: captainPlayerId,
                    name: trimmedName,
                    fullName,
                    entryFee,
                    status: allCount >= GAME.maxSquadSize ? "FULL" : "FORMING",
                    confirmedAt: new Date(), // Admin-created squads are always confirmed
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

            // When charging entry fee with a real player, remove their individual vote
            // so it behaves exactly like a self-created squad
            if (chargeEntryFee && existingPlayer) {
                await tx.playerPollVote.deleteMany({
                    where: { pollId, playerId: captainPlayerId },
                });
            }

            // Member invites
            for (let i = 0; i < memberPlayerIds.length; i++) {
                const member = memberPlayerIds[i]!;
                await tx.squadInvite.create({
                    data: {
                        squadId: squad.id,
                        playerId: member.id,
                        status: "ACCEPTED",
                        initiatedBy: "CAPTAIN",
                        respondedAt: new Date(),
                        isSub: false,
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
        }, { timeout: 15000 });

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
