import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getAuthEmail } from "@/lib/auth";

/**
 * POST /api/coupons/use
 * Mark a coupon as used. Only the verifier who created it can do this.
 * Body: { couponId }
 */
export async function POST(req: NextRequest) {
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

        const body = await req.json();
        const { couponId } = body;
        if (!couponId) return ErrorResponse({ message: "couponId is required", status: 400 });

        const coupon = await prisma.sponsorCoupon.findUnique({
            where: { id: couponId },
        });
        if (!coupon) return ErrorResponse({ message: "Coupon not found", status: 404 });
        if (coupon.createdById !== player.id) {
            return ErrorResponse({ message: "Not your coupon", status: 403 });
        }
        if (coupon.status === "USED") {
            return ErrorResponse({ message: "Coupon already used", status: 400 });
        }
        if (coupon.status !== "CLAIMED") {
            return ErrorResponse({ message: "Coupon is not claimed yet", status: 400 });
        }

        await prisma.sponsorCoupon.update({
            where: { id: couponId },
            data: { status: "USED", usedAt: new Date() },
        });

        return SuccessResponse({ message: "Coupon marked as used" });
    } catch (error) {
        return ErrorResponse({ message: "Failed to use coupon", error });
    }
}
