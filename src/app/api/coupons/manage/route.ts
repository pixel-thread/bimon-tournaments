import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getAuthEmail } from "@/lib/auth";

/**
 * GET /api/coupons/manage
 * Returns all coupons created by the current verifier.
 */
export async function GET() {
    try {
        const email = await getAuthEmail();
        if (!email) return ErrorResponse({ message: "Unauthorized", status: 401 });

        const player = await prisma.player.findFirst({
            where: { user: { email } },
            select: { id: true, isCouponVerifier: true },
        });
        if (!player?.isCouponVerifier) {
            return ErrorResponse({ message: "Not authorized", status: 403 });
        }

        const coupons = await prisma.sponsorCoupon.findMany({
            where: { createdById: player.id },
            include: {
                claimedBy: {
                    select: {
                        displayName: true,
                        user: { select: { username: true } },
                    },
                },
                poll: {
                    select: {
                        tournament: { select: { name: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // Auto-expire old coupons
        const now = new Date();
        const expiredIds = coupons
            .filter((c) => c.status === "AVAILABLE" || c.status === "CLAIMED")
            .filter((c) => c.expiresAt < now)
            .map((c) => c.id);
        if (expiredIds.length > 0) {
            await prisma.sponsorCoupon.updateMany({
                where: { id: { in: expiredIds } },
                data: { status: "EXPIRED" },
            });
        }

        return SuccessResponse({
            data: coupons.map((c) => ({
                id: c.id,
                code: c.code,
                discountPct: c.discountPct,
                maxDiscount: c.maxDiscount,
                sponsorName: c.sponsorName,
                description: c.description,
                status: expiredIds.includes(c.id) ? "EXPIRED" : c.status,
                expiresAt: c.expiresAt,
                createdAt: c.createdAt,
                claimedAt: c.claimedAt,
                usedAt: c.usedAt,
                claimedByName: c.claimedBy?.displayName || c.claimedBy?.user?.username || null,
                tournamentName: c.poll?.tournament?.name ?? null,
                pollId: c.pollId,
            })),
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch coupons", error });
    }
}
