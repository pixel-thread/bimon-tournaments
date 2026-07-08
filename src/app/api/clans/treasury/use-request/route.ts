import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { GAME } from "@/lib/game-config";

/**
 * POST /api/clans/treasury/use-request
 * A clan member requests permission to use clan treasury for squad entry fee.
 * Creates a ClanWithdrawRequest with requestType = "TREASURY_USE".
 * Leader/Co-Leader reviews via /api/clans/treasury/review.
 * Body: { pollId, amount }
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
        const { pollId, amount } = body as { pollId: string; amount: number };

        if (!pollId || !amount || amount <= 0) {
            return ErrorResponse({ message: "pollId and amount required", status: 400 });
        }

        // Check clan membership
        const membership = await prisma.clanMember.findUnique({
            where: { playerId },
            include: { clan: { select: { id: true, balance: true } } },
        });

        // Also check if player is clan leader (leaders aren't in ClanMember)
        let clanId: string | null = membership?.clanId ?? null;
        let clanBalance = membership?.clan.balance ?? 0;

        if (!membership) {
            const ownedClan = await prisma.clan.findUnique({
                where: { leaderId: playerId },
                select: { id: true, balance: true },
            });
            if (ownedClan) {
                clanId = ownedClan.id;
                clanBalance = ownedClan.balance;
            }
        }

        if (!clanId) {
            return ErrorResponse({ message: `You are not in a ${GAME.clanLabel.toLowerCase()}`, status: 400 });
        }

        // Check clan has enough balance
        if (clanBalance < amount) {
            return ErrorResponse({
                message: `Insufficient treasury balance. Treasury has ${clanBalance} ${GAME.currency}.`,
                status: 400,
            });
        }

        // Find the player's squad for this poll
        const squad = await prisma.squad.findFirst({
            where: {
                pollId,
                captainId: playerId,
                status: "FORMING",
            },
            select: { id: true },
        });

        // Check for existing pending request for this poll
        const existingPending = await prisma.clanWithdrawRequest.findFirst({
            where: {
                clanId,
                playerId,
                requestType: "TREASURY_USE",
                status: "PENDING",
            },
        });
        if (existingPending) {
            return ErrorResponse({
                message: "You already have a pending treasury use request.",
                status: 400,
            });
        }

        // Create treasury use request
        await prisma.clanWithdrawRequest.create({
            data: {
                clanId,
                playerId,
                amount,
                requestType: "TREASURY_USE",
                message: `Squad entry fee for tournament`,
                squadId: squad?.id ?? null,
            },
        });

        return SuccessResponse({
            message: "Treasury use request sent to clan leadership for approval",
            status: 201,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to create treasury use request", error });
    }
}
