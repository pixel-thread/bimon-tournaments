import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { ALL_TOURNAMENT_TYPES } from "@/lib/bracket-types";

/**
 * GET /api/polls
 * Fetches active polls with vote counts and user's vote status.
 * Uses the actual schema: Poll → PollOption → PlayerPollVote
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const all = searchParams.get("all") === "true";
        const seasonId = searchParams.get("seasonId");

        const user = await getCurrentUser();
        const playerId = user?.player?.id;

        const polls = await prisma.poll.findMany({
            where: {
                ...(all ? {} : { isActive: true }),
                ...(seasonId ? { tournament: { seasonId } } : {}),
            },
            include: {
                tournament: {
                    select: {
                        id: true,
                        name: true,
                        fee: true,
                        type: true,
                        seasonId: true,
                        isTDM: true,
                        isWoW: true,
                        _count: { select: { teams: true } },
                    },
                },
                options: {
                    select: {
                        id: true,
                        name: true,
                        vote: true,
                    },
                },
                votes: {
                    select: {
                        id: true,
                        playerId: true,
                        vote: true,
                        voteCount: true,
                        createdAt: true,
                        player: {
                            select: {
                                displayName: true,
                                customProfileImageUrl: true,
                                user: {
                                    select: {
                                        username: true,
                                        imageUrl: true,
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                },
                // Count active squads for prize pool display
                _count: {
                    select: {
                        squads: { where: { status: { in: ["FORMING", "FULL", "REGISTERED"] } } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // Fetch donation totals for each tournament
        const tournamentIds = [...new Set(polls.map(p => p.tournament?.id).filter(Boolean))] as string[];
        const donationTotals = new Map<string, { total: number; donations: { amount: number; playerName: string | null; isAnonymous: boolean }[] }>();
        if (tournamentIds.length > 0) {
            const allDonations = await prisma.prizePoolDonation.findMany({
                where: { tournamentId: { in: tournamentIds } },
                select: { tournamentId: true, amount: true, playerName: true, isAnonymous: true },
            });
            for (const d of allDonations) {
                const existing = donationTotals.get(d.tournamentId) ?? { total: 0, donations: [] };
                existing.total += d.amount;
                existing.donations.push({ amount: d.amount, playerName: d.playerName, isAnonymous: d.isAnonymous });
                donationTotals.set(d.tournamentId, existing);
            }
        }

        // Fetch sponsor coupons for polls
        const pollIds = polls.map(p => p.id);
        const sponsorCoupons = await prisma.sponsorCoupon.findMany({
            where: { pollId: { in: pollIds } },
            select: {
                pollId: true,
                sponsorName: true,
                discountPct: true,
                maxDiscount: true,
                description: true,
                status: true,
            },
        });
        const couponByPollId = new Map(sponsorCoupons.map(c => [c.pollId, c]));

        const data = polls.map((poll) => {
            const totalVotes = poll.votes.length;
            // Sum voteCount for multi-entry — each extra entry counts as an additional participant
            const inVotes = poll.votes.filter((v: any) => v.vote === "IN").reduce((sum: number, v: any) => sum + (v.voteCount ?? 1), 0);
            const outVotes = poll.votes.filter((v: any) => v.vote === "OUT").length;
            const soloVotes = poll.votes.filter((v: any) => v.vote === "SOLO").reduce((sum: number, v: any) => sum + (v.voteCount ?? 1), 0);
            const userVote = playerId
                ? poll.votes.find((v: any) => v.playerId === playerId)?.vote ?? null
                : null;
            const userVoteCount = playerId
                ? (poll.votes.find((v: any) => v.playerId === playerId) as any)?.voteCount ?? 1
                : 1;

            const tDonations = poll.tournament?.id ? donationTotals.get(poll.tournament.id) : null;

            return {
                id: poll.id,
                question: poll.question,
                days: poll.days,
                teamType: poll.teamType,
                allowSquads: poll.allowSquads,
                scheduledDate: poll.scheduledDate,
                scheduledTime: poll.scheduledTime,
                matchSchedule: poll.matchSchedule ?? null,
                enableFund: poll.enableFund,
                prizePoolFee: poll.prizePoolFee,
                whatsappGroupLink: poll.whatsappGroupLink,
                orgCutFixed: poll.orgCutFixed,
                isChampionship: poll.isChampionship,
                tournament: poll.tournament ? {
                    id: poll.tournament.id,
                    name: poll.tournament.name,
                    fee: poll.tournament.fee,
                    type: poll.tournament.type,
                    seasonId: poll.tournament.seasonId,
                    isTDM: poll.tournament.isTDM,
                    isWoW: poll.tournament.isWoW,
                    hasTeams: ((poll.tournament as any)._count?.teams ?? 0) > 0,
                } : null,
                luckyVoterId: poll.luckyVoterId,
                options: poll.options,
                isActive: poll.isActive,
                createdAt: poll.createdAt,
                totalVotes,
                inVotes,
                outVotes,
                soloVotes,
                inPercentage:
                    totalVotes > 0 ? Math.round((inVotes / totalVotes) * 100) : 0,
                userVote,
                userVoteCount,
                hasVoted: !!userVote,
                squadCount: (poll as any)._count?.squads ?? 0,
                donations: tDonations ?? { total: 0, donations: [] },
                sponsorCoupon: couponByPollId.get(poll.id) ?? null,
                playersVotes: poll.votes.map((v: any) => ({
                    playerId: v.playerId,
                    vote: v.vote,
                    voteCount: v.voteCount ?? 1,
                    createdAt: v.createdAt,
                    displayName: v.player.displayName ?? v.player.user?.username ?? "Unknown",
                    imageUrl: v.player.customProfileImageUrl ?? v.player.user?.imageUrl ?? "",
                })),
            };
        });

        // Check player flags directly (not from getCurrentUser cache)
        let isCouponVerifier = false;
        let isUCExempt = false;
        if (playerId) {
            const playerFlags = await prisma.player.findUnique({
                where: { id: playerId },
                select: { isCouponVerifier: true, isUCExempt: true },
            });
            isCouponVerifier = playerFlags?.isCouponVerifier ?? false;
            isUCExempt = playerFlags?.isUCExempt ?? false;
        }

        // Sort: nearest play date first (works for both scheduledDate and day-name polls)
        const DAY_NAMES: Record<string, number> = {
            sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2,
            wed: 3, wednesday: 3, thu: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
        };
        const getEffectiveDate = (poll: any): number => {
            if (poll.scheduledDate) return new Date(poll.scheduledDate).getTime();
            if (poll.days) {
                const lower = poll.days.toLowerCase();
                for (const [name, idx] of Object.entries(DAY_NAMES)) {
                    const pos = lower.indexOf(name);
                    if (pos >= 0 && (pos === 0 || /\W/.test(lower[pos - 1]))) {
                        const now = new Date();
                        const diff = (idx - now.getDay() + 7) % 7;
                        const next = new Date(now);
                        next.setDate(next.getDate() + diff);
                        return next.getTime();
                    }
                }
            }
            return Infinity;
        };
        data.sort((a: any, b: any) => getEffectiveDate(a) - getEffectiveDate(b));

        return SuccessResponse({ data: { polls: data, currentPlayerId: playerId ?? null, isCouponVerifier, isUCExempt }, cache: CACHE.NONE });
    } catch (error) {
        console.error("[GET /api/polls] Error:", error);
        return ErrorResponse({ message: "Failed to fetch polls", error });
    }
}

/**
 * POST /api/polls
 * Create a new poll (admin only).
 */
export async function POST(request: Request) {
    try {
        const { requireAdmin } = await import("@/lib/auth");
        const admin = await requireAdmin();
        if (!admin) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        const body = await request.json();
        const { question, days, teamType, tournamentId, tournamentType, options: customOptions, allowSquads, enableFund, prizePoolFee, scheduledDate, scheduledTime, matchSchedule, isTDM: tdmFlag, isWoW: wowFlag, whatsappGroupLink, orgCutFixed } = body;

        if (!question || !tournamentId) {
            return ErrorResponse({ message: "question and tournamentId are required", status: 400 });
        }

        // Guard against duplicate polls for the same tournament (tournamentId is @unique)
        const existingPoll = await prisma.poll.findUnique({
            where: { tournamentId },
            select: { id: true },
        });
        if (existingPoll) {
            return ErrorResponse({ message: "A poll already exists for this tournament. Please edit the existing poll instead.", status: 409 });
        }

        // If tournamentType is provided (PES/TDM/WoW flow), update the linked tournament's type + flags
        if (tournamentType && (ALL_TOURNAMENT_TYPES as readonly string[]).includes(tournamentType)) {
            await prisma.tournament.update({
                where: { id: tournamentId },
                data: {
                    type: tournamentType,
                    ...(tdmFlag && { isTDM: true }),
                    ...(wowFlag && { isWoW: true }),
                },
            });
        } else if (tdmFlag) {
            // TDM without explicit type — just set the flag
            await prisma.tournament.update({
                where: { id: tournamentId },
                data: { isTDM: true },
            });
        } else if (wowFlag) {
            // WoW without explicit type — just set the flag
            await prisma.tournament.update({
                where: { id: tournamentId },
                data: { isWoW: true },
            });
        }

        // Use custom option names if provided, otherwise use defaults
        const { GAME } = await import("@/lib/game-config");
        type VoteType = "IN" | "OUT" | "SOLO";
        const defaultOptions: { name: string; vote: VoteType }[] = GAME.features.hasTeamSizes
            ? [
                { name: GAME.locale === "kha" ? "Nga Leh 😎" : "I'm In 😎", vote: "IN" },
                { name: GAME.locale === "kha" ? "Leh rei" : "I'm Out", vote: "OUT" },
                { name: GAME.locale === "kha" ? "Nga Leh solo 🫩" : "Solo 🫩", vote: "SOLO" },
            ]
            : [
                { name: GAME.locale === "kha" ? "Nga Leh 😎" : "I'm In 😎", vote: "IN" },
                { name: GAME.locale === "kha" ? "Leh rei" : "I'm Out", vote: "OUT" },
            ];

        const pollOptions: { name: string; vote: VoteType }[] = Array.isArray(customOptions) && customOptions.length > 0
            ? customOptions.map((o: { name: string; vote: string }) => ({ name: o.name, vote: o.vote as VoteType }))
            : defaultOptions;

        const poll = await prisma.poll.create({
            data: {
                question,
                days: days || "Monday",
                teamType: teamType || "DUO",
                allowSquads: allowSquads ?? false,
                isChampionship: false,
                scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
                scheduledTime: scheduledTime || "20:00",
                matchSchedule: matchSchedule ?? null,
                enableFund: enableFund ?? true,
                prizePoolFee: prizePoolFee != null ? Number(prizePoolFee) : null,
                whatsappGroupLink: whatsappGroupLink?.trim() || null,
                orgCutFixed: orgCutFixed != null ? Number(orgCutFixed) : null,
                tournamentId,
                options: {
                    create: pollOptions,
                },
            },
            include: {
                tournament: { select: { id: true, name: true, fee: true, type: true } },
            },
        });

        return SuccessResponse({ data: poll });
    } catch (error) {
        return ErrorResponse({ message: "Failed to create poll", error });
    }
}

/**
 * PATCH /api/polls
 * Update an existing poll (admin only). Pass { id, ...fields }.
 */
export async function PATCH(request: Request) {
    try {
        const { requireAdmin } = await import("@/lib/auth");
        const admin = await requireAdmin();
        if (!admin) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        const body = await request.json();
        const { id, question, days, teamType, isActive, options, tournamentType, allowSquads, enableFund, prizePoolFee, expectedPrizePool, scheduledDate, scheduledTime, matchSchedule, whatsappGroupLink, orgCutFixed } = body;

        if (!id) {
            return ErrorResponse({ message: "id is required", status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (question !== undefined) updateData.question = question;
        if (days !== undefined) updateData.days = days;
        if (teamType !== undefined) updateData.teamType = teamType;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (allowSquads !== undefined) updateData.allowSquads = allowSquads;

        if (enableFund !== undefined) updateData.enableFund = enableFund;
        if (prizePoolFee !== undefined) updateData.prizePoolFee = prizePoolFee != null ? Number(prizePoolFee) : null;
        if (expectedPrizePool !== undefined) updateData.expectedPrizePool = expectedPrizePool != null ? Number(expectedPrizePool) : null;
        if (scheduledDate !== undefined) updateData.scheduledDate = scheduledDate ? new Date(scheduledDate) : null;
        if (scheduledTime !== undefined) updateData.scheduledTime = scheduledTime;
        if (whatsappGroupLink !== undefined) updateData.whatsappGroupLink = whatsappGroupLink?.trim() || null;
        if (matchSchedule !== undefined) updateData.matchSchedule = matchSchedule;
        if (orgCutFixed !== undefined) updateData.orgCutFixed = orgCutFixed != null ? Number(orgCutFixed) : null;

        // If tournamentType is provided, update the linked tournament's type
        if (tournamentType && (ALL_TOURNAMENT_TYPES as readonly string[]).includes(tournamentType)) {
            const poll = await prisma.poll.findUnique({
                where: { id },
                select: { tournamentId: true },
            });
            if (poll?.tournamentId) {
                await prisma.tournament.update({
                    where: { id: poll.tournamentId },
                    data: { type: tournamentType },
                });
            }
        }

        // Update poll + options in a transaction
        const poll = await prisma.$transaction(async (tx) => {
            // Update poll fields if any
            let updatedPoll;
            if (Object.keys(updateData).length > 0) {
                updatedPoll = await tx.poll.update({
                    where: { id },
                    data: updateData,
                    include: {
                        tournament: { select: { id: true, name: true, fee: true, type: true } },
                        options: { select: { id: true, name: true, vote: true } },
                    },
                });
            } else {
                updatedPoll = await tx.poll.findUniqueOrThrow({
                    where: { id },
                    include: {
                        tournament: { select: { id: true, name: true, fee: true, type: true } },
                        options: { select: { id: true, name: true, vote: true } },
                    },
                });
            }

            // Update option names if provided
            if (options && Array.isArray(options)) {
                for (const opt of options) {
                    if (opt.id && opt.name !== undefined) {
                        await tx.pollOption.update({
                            where: { id: opt.id },
                            data: { name: opt.name },
                        });
                    }
                }
                // Re-fetch to get updated options
                updatedPoll = await tx.poll.findUniqueOrThrow({
                    where: { id },
                    include: {
                        tournament: { select: { id: true, name: true, fee: true, type: true } },
                        options: { select: { id: true, name: true, vote: true } },
                    },
                });
            }

            return updatedPoll;
        });

        return SuccessResponse({ data: poll });
    } catch (error) {
        return ErrorResponse({ message: "Failed to update poll", error });
    }
}
