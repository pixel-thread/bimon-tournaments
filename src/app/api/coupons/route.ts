import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getAuthEmail } from "@/lib/auth";

function generateCouponCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion
    let code = "BGMI-";
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

/**
 * POST /api/coupons
 * Create a sponsor coupon for a poll.
 * Only isCouponVerifier players can create.
 * Body: { pollId, discountPct, maxDiscount, sponsorName, expiryDays }
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
            return ErrorResponse({ message: "Not authorized to create coupons", status: 403 });
        }

        const body = await req.json();
        const {
            pollId,
            discountPct = 10,
            maxDiscount = 200,
            sponsorName = "",
            expiryDays = 180, // 6 months default
        } = body;

        if (!pollId) return ErrorResponse({ message: "pollId is required", status: 400 });

        // Verify poll exists and is ranked
        const poll = await prisma.poll.findUnique({
            where: { id: pollId },
            select: { id: true, allowSquads: true },
        });
        if (!poll) return ErrorResponse({ message: "Poll not found", status: 404 });
        if (!poll.allowSquads) return ErrorResponse({ message: "Coupons only for ranked polls", status: 400 });

        // Check if poll already has a coupon
        const existing = await prisma.sponsorCoupon.findUnique({ where: { pollId } });
        if (existing) return ErrorResponse({ message: "This poll already has a coupon", status: 400 });

        // Generate unique code
        let code: string;
        let attempts = 0;
        do {
            code = generateCouponCode();
            const exists = await prisma.sponsorCoupon.findUnique({ where: { code } });
            if (!exists) break;
            attempts++;
        } while (attempts < 10);

        const description = `${discountPct}% off up to ₹${maxDiscount}`;
        const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

        const coupon = await prisma.sponsorCoupon.create({
            data: {
                code,
                discountPct,
                maxDiscount,
                sponsorName,
                description,
                expiresAt,
                createdById: player.id,
                pollId,
            },
        });

        return SuccessResponse({
            data: coupon,
            message: `Coupon ${code} created`,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to create coupon", error });
    }
}
