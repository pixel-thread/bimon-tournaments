import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { type NextRequest } from "next/server";
import { getSettings } from "@/lib/settings";
import { GAME } from "@/lib/game-config";
import { getAvailableBalance } from "@/lib/wallet-service";
import { checkAndGrantWelcomeBack } from "@/lib/logic/welcomeBack";
import { checkKdGate } from "@/lib/logic/kd-gate";

/**
 * POST /api/polls/vote
 * Cast or update a vote on a poll (IN/OUT/SOLO/ADD_ENTRY/REMOVE_ENTRY).
 * ADD_ENTRY and REMOVE_ENTRY: multi-entry for PES (games with hasMultiEntry).
 */
export async function POST(request: NextRequest) {
    try {
        const userId = await getAuthEmail();
        if (!userId) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        const body = await request.json();
        const { pollId, vote } = body as {
            pollId: string;
            vote: "IN" | "OUT" | "SOLO" | "ADD_ENTRY" | "REMOVE_ENTRY";
        };

        const validVotes = ["IN", "OUT", "SOLO", "ADD_ENTRY", "REMOVE_ENTRY"];
        if (!pollId || !validVotes.includes(vote)) {
            return ErrorResponse({
                message: "Invalid request: pollId and vote required",
                status: 400,
            });
        }

        // Run player + poll lookups in parallel (saves ~100ms)
        const [user, poll] = await Promise.all([
            prisma.user.findFirst({
                where: userWhereEmail(userId),
                select: {
                    id: true,
                    role: true,
                    player: {
                        select: {
                            id: true,
                            isBanned: true,
                            isTrusted: true,
                            discordId: true,
                            wallet: { select: { balance: true } },
                        },
                    },
                },
            }),
            prisma.poll.findUnique({
                where: { id: pollId },
                select: {
                    id: true,
                    isActive: true,
                    allowSquads: true,
                    teamType: true,
                    luckyVoterId: true,
                    tournament: { select: { fee: true, seasonId: true } },
                },
            }),
        ]);

        if (!user?.player) {
            return ErrorResponse({
                message: "⚠️ Complete your profile setup first before voting",
                status: 404,
            });
        }

        if (user.player.isBanned) {
            return ErrorResponse({
                message: "🚫 You are currently banned and cannot vote. Contact admin for help.",
                status: 403,
            });
        }

        // Discord linking is mandatory for IN/SOLO votes
        if ((vote === "IN" || vote === "SOLO") && !user.player.discordId) {
            return ErrorResponse({
                message: "🔗 Link your Discord account first to vote. Go to your Profile to connect Discord.",
                status: 403,
            });
        }

        if (!poll || !poll.isActive) {
            return ErrorResponse({
                message: "⏰ This poll has been closed and is no longer accepting votes",
                status: 404,
            });
        }

        // Block individual vote if player is in a squad for this poll
        if (poll.allowSquads && (vote === "IN" || vote === "SOLO")) {
            const inSquad = await prisma.squadInvite.findFirst({
                where: {
                    playerId: user.player.id,
                    status: { in: ["PENDING", "ACCEPTED"] },
                    squad: {
                        pollId,
                        status: { in: ["FORMING", "FULL"] },
                    },
                },
                include: { squad: { select: { captainId: true, name: true } } },
            });
            if (inSquad) {
                const isCaptain = inSquad.squad.captainId === user.player.id;
                return ErrorResponse({
                    message: isCaptain
                        ? `⚠️ You're the leader of "${inSquad.squad.name}". Cancel your squad first to vote individually.`
                        : `⚠️ You're in squad "${inSquad.squad.name}". Leave the squad first to vote individually.`,
                    status: 400,
                });
            }
        }

        // Block OUT vote if player is in an accepted squad
        if (poll.allowSquads && vote === "OUT") {
            const acceptedSquad = await prisma.squadInvite.findFirst({
                where: {
                    playerId: user.player.id,
                    status: "ACCEPTED",
                    squad: {
                        pollId,
                        status: { in: ["FORMING", "FULL"] },
                    },
                },
                include: { squad: { select: { name: true } } },
            });
            if (acceptedSquad) {
                return ErrorResponse({
                    message: `⚠️ You're in squad "${acceptedSquad.squad.name}". Leave the squad first to vote out.`,
                    status: 400,
                });
            }
        }

        // Balance gate for IN/SOLO votes — uses AVAILABLE balance (total − reserved)
        // Trusted:  can go negative down to -200 (extended credit for loyal players)
        // PLAYER:   must have at least the per-player entry fee
        // USER:     must have balance >= entry fee (need coins first)
        if (vote !== "OUT") {
            const { available, reserved } = await getAvailableBalance(userId);
            const fullFee = poll.tournament?.fee ?? 0;
            // Squad polls: fee is per-team, split by team size (TRIO=3, SQUAD=4, etc.)
            // Casual polls: fee is per-player.
            let entryFee = fullFee;
            if (poll.allowSquads && fullFee > 0) {
                const teamSizeMap: Record<string, number> = { SOLO: 1, DUO: 2, TRIO: 3, SQUAD: GAME.squadSize, DYNAMIC: GAME.squadSize };
                const teamSize = teamSizeMap[poll.teamType] ?? GAME.squadSize;
                entryFee = teamSize > 1 ? Math.ceil(fullFee / teamSize) : fullFee;
            }
            const isPlayer = user.role === "PLAYER" || user.role === "ADMIN" || user.role === "SUPER_ADMIN";

            if (user.player.isTrusted) {
                if (available < -200) {
                    return ErrorResponse({
                        message: `${GAME.currencyEmoji} Not enough ${GAME.currency} to vote IN — you need ${entryFee} ${GAME.currency} but have ${available} available`,
                        status: 403,
                    });
                }
            } else if (isPlayer) {
                if (available < entryFee) {
                    return ErrorResponse({
                        message: `${GAME.currencyEmoji} Not enough ${GAME.currency} to vote IN — you need ${entryFee} ${GAME.currency} but have ${available} available`,
                        status: 403,
                    });
                }
            } else {
                if (available < entryFee) {
                    return ErrorResponse({
                        message: `${GAME.currencyEmoji} Not enough ${GAME.currency} to vote IN — you need ${entryFee} ${GAME.currency} but have ${available} available`,
                        status: 403,
                    });
                }
            }
        }

        // KD range gate — block IN/SOLO if player's KD is out of the poll's range
        if (vote === "IN" || vote === "SOLO") {
            const kdResult = await checkKdGate(user.player.id, pollId);
            if (!kdResult.allowed) {
                return ErrorResponse({ message: kdResult.message!, status: 403 });
            }
        }

        const playerId = user.player.id;

        // ─── Multi-Entry: ADD_ENTRY / REMOVE_ENTRY (PES only) ───
        if (vote === "ADD_ENTRY" || vote === "REMOVE_ENTRY") {
            if (!GAME.features.hasMultiEntry) {
                return ErrorResponse({ message: "Multi-entry is not available for this game", status: 400 });
            }

            const existing = await prisma.playerPollVote.findUnique({
                where: { playerId_pollId: { playerId, pollId } },
            });

            if (vote === "ADD_ENTRY") {
                if (!existing || !["IN", "SOLO"].includes(existing.vote)) {
                    return ErrorResponse({ message: "You must vote IN first before adding entries", status: 400 });
                }

                const newCount = existing.voteCount + 1;
                const entryFee = poll.tournament?.fee ?? 0;
                const { available, reserved } = await getAvailableBalance(userId);
                const additionalCost = entryFee; // 1 more entry
                const reservedNote = reserved > 0 ? ` (${reserved} ${GAME.currency} reserved)` : "";

                if (available < additionalCost) {
                    return ErrorResponse({
                        message: `${GAME.currencyEmoji} Not enough ${GAME.currency} for another entry — need ${entryFee} ${GAME.currency} but have ${available} available${reservedNote}`,
                        status: 403,
                    });
                }

                await prisma.playerPollVote.update({
                    where: { id: existing.id },
                    data: { voteCount: newCount },
                });

                return SuccessResponse({
                    data: { voteCount: newCount },
                    message: `Entry #${newCount} added! You now have ${newCount} entries.`,
                });
            }

            if (vote === "REMOVE_ENTRY") {
                if (!existing || existing.voteCount <= 1) {
                    return ErrorResponse({ message: "No extra entries to remove. Use OUT to cancel.", status: 400 });
                }

                const newCount = existing.voteCount - 1;
                await prisma.playerPollVote.update({
                    where: { id: existing.id },
                    data: { voteCount: newCount },
                });

                return SuccessResponse({
                    data: { voteCount: newCount },
                    message: `Entry removed. You now have ${newCount} entries.`,
                });
            }
        }

        // ─── Standard voting: IN / OUT / SOLO ───

        // Check if this is a first-time vote or a change
        const existingVote = await prisma.playerPollVote.findUnique({
            where: { playerId_pollId: { playerId, pollId } },
            select: { id: true },
        });
        const isFirstVote = !existingVote;

        // Upsert the vote (reset voteCount to 1 on new vote/change)
        const result = await prisma.playerPollVote.upsert({
            where: {
                playerId_pollId: {
                    playerId,
                    pollId,
                },
            },
            create: {
                playerId,
                pollId,
                vote,
                voteCount: 1,
            },
            update: {
                vote,
                voteCount: 1, // reset on vote change
                createdAt: new Date(),
            },
        });

        // Lucky voter lottery — weighted by losses: biggest losers get highest chance
        let isLuckyVoter = poll.luckyVoterId === playerId;
        const entryFee = poll.tournament?.fee ?? 0;

        // Cheap checks first — skip entire block for most votes
        if (
            isFirstVote &&
            !isLuckyVoter &&
            !poll.luckyVoterId &&
            (vote === "IN" || vote === "SOLO") &&
            entryFee > 0
        ) {
            const settings = await getSettings();
            if (settings.enableLuckyVoters) {
                // Calculate this player's loss in the current season
                const seasonId = poll.tournament?.seasonId;
                let lossChance = 5; // base 5% for everyone

                // Run independent lookups in parallel
                let alreadyWonThisSeason = false;
                if (seasonId) {
                    const [existingWin, seasonTeams, prizeTransactions, season] = await Promise.all([
                        // Check if player already won lucky voter in this season
                        prisma.poll.findFirst({
                            where: { luckyVoterId: playerId, tournament: { seasonId } },
                            select: { id: true },
                        }),
                        // Get total fees paid in this season
                        prisma.team.findMany({
                            where: {
                                seasonId,
                                players: { some: { id: playerId } },
                                tournament: { fee: { gt: 0 } },
                            },
                            select: { tournament: { select: { fee: true } } },
                        }),
                        // Get total prizes won in this season
                        prisma.transaction.findMany({
                            where: { playerId, type: "CREDIT", description: { contains: "place" } },
                            select: { amount: true },
                        }),
                        // Get season dates for Razorpay top-up check
                        prisma.season.findUnique({
                            where: { id: seasonId },
                            select: { startDate: true, endDate: true },
                        }),
                    ]);

                    alreadyWonThisSeason = !!existingWin;

                    if (!alreadyWonThisSeason) {
                        const totalFeesPaid = seasonTeams.reduce(
                            (sum, t) => sum + (t.tournament?.fee ?? 0), 0
                        );
                        const totalPrizes = prizeTransactions.reduce(
                            (sum, t) => sum + t.amount, 0
                        );

                        // Net loss (positive = losing money)
                        const netLoss = totalFeesPaid - totalPrizes;

                        // Scale chance: 5% base → up to 40% for biggest losers
                        // Every 30 UC of loss adds ~5% chance, capped at 40%
                        if (netLoss > 0) {
                            lossChance = Math.min(40, 5 + Math.floor(netLoss / 30) * 5);
                        }

                        // Razorpay top-up boost: players who topped up this season
                        // get 35% minimum chance (close to 40% biggest loser cap)
                        if (season) {
                            const hasRazorpayTopUp = await prisma.payment.findFirst({
                                where: {
                                    playerId,
                                    status: "paid",
                                    createdAt: {
                                        gte: season.startDate,
                                        lte: season.endDate ?? new Date(),
                                    },
                                },
                                select: { id: true },
                            });
                            if (hasRazorpayTopUp) {
                                lossChance = Math.max(lossChance, 35);
                            }
                        }
                    }
                }

                if (!alreadyWonThisSeason) {
                    const roll = Math.floor(Math.random() * 100);
                    if (roll < lossChance) {
                        await prisma.poll.update({
                            where: { id: pollId },
                            data: { luckyVoterId: playerId },
                        });
                        isLuckyVoter = true;
                    }
                }
            } // end enableLuckyVoters
        }

        // ─── Welcome Back Coupon — returning players (2+ seasons inactive) ───
        // Non-blocking: grant coupon silently, player sees notification
        if (isFirstVote && (vote === "IN" || vote === "SOLO")) {
            try {
                const coupon = await checkAndGrantWelcomeBack(
                    playerId,
                    poll.tournament?.seasonId,
                );
                if (coupon) {
                    // Create in-app notification
                    await prisma.notification.create({
                        data: {
                            userId: user.id,
                            title: "🎉 Welcome Back!",
                            message: `We missed you! Here's a free entry pass worth ${coupon.amount} ${GAME.currency} — it'll be auto-applied on your next tournament!`,
                            type: "WELCOME_BACK",
                            playerId,
                        },
                    });
                }
            } catch (err) {
                // Non-critical — don't fail the vote
                console.error("[polls/vote] Welcome back check failed:", err);
            }
        }

        return SuccessResponse({
            data: { id: result.id, vote: result.vote, isLuckyVoter },
            message: isLuckyVoter
                ? "🎉 Congratulations! You won FREE ENTRY!"
                : "Vote cast successfully",
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to cast vote", error });
    }
}

/**
 * DELETE /api/polls/vote
 * Secret unvote — removes the player's vote entirely.
 * Body: { pollId }
 */
export async function DELETE(request: NextRequest) {
    try {
        const userId = await getAuthEmail();
        if (!userId) return ErrorResponse({ message: "Unauthorized", status: 401 });

        const body = await request.json();
        const { pollId } = body as { pollId: string };
        if (!pollId) return ErrorResponse({ message: "pollId required", status: 400 });

        const user = await prisma.user.findFirst({
            where: userWhereEmail(userId),
            select: { player: { select: { id: true } } },
        });
        if (!user?.player) return ErrorResponse({ message: "Player not found", status: 404 });

        const deleted = await prisma.playerPollVote.deleteMany({
            where: { playerId: user.player.id, pollId },
        });

        if (deleted.count === 0) {
            return ErrorResponse({ message: "No vote found", status: 404 });
        }

        return SuccessResponse({ message: "Vote removed" });
    } catch (error) {
        return ErrorResponse({ message: "Failed to remove vote", error });
    }
}
