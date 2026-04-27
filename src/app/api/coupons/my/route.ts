import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getAuthEmail } from "@/lib/auth";

/**
 * GET /api/coupons/my
 * Returns the current player's active (CLAIMED) coupons for wallet display.
 * Only shows coupons that are CLAIMED and not expired.
 */
export async function GET() {
    try {
        const email = await getAuthEmail();
        if (!email) return ErrorResponse({ message: "Unauthorized", status: 401 });

        const player = await prisma.player.findFirst({
            where: { user: { email } },
            select: { id: true },
        });
        if (!player) return ErrorResponse({ message: "Player not found", status: 404 });

        const coupons = await prisma.sponsorCoupon.findMany({
            where: {
                claimedById: player.id,
                status: "CLAIMED",
                expiresAt: { gt: new Date() }, // not expired
            },
            select: {
                id: true,
                code: true,
                discountPct: true,
                maxDiscount: true,
                sponsorName: true,
                description: true,
                expiresAt: true,
                claimedAt: true,
                poll: {
                    select: {
                        tournament: {
                            select: { name: true },
                        },
                    },
                },
            },
            orderBy: { claimedAt: "desc" },
        });

        return SuccessResponse({
            data: coupons.map((c) => ({
                id: c.id,
                code: c.code,
                discountPct: c.discountPct,
                maxDiscount: c.maxDiscount,
                sponsorName: c.sponsorName,
                description: c.description,
                expiresAt: c.expiresAt,
                claimedAt: c.claimedAt,
                tournamentName: c.poll?.tournament?.name ?? null,
            })),
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch coupons", error });
    }
}
