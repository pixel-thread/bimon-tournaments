import { prisma } from "@/lib/database";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { BRACKET_TYPES } from "@/lib/bracket-types";

/**
 * POST /api/cron/cleanup-bracket-images
 *
 * Deletes Cloudinary images for tournaments that are no longer visible
 * on /bracket (winner declared > 24h ago).
 * 
 * Keeps the data (scores, match records) but nulls out screenshotUrl
 * and deletes the actual images from Cloudinary.
 *
 * Can be called by:
 *  - Vercel cron (add to vercel.json)
 *  - Admin manually
 */
export async function POST() {
    try {
        // Auth check — must be admin or cron secret
        const userId = await getAuthEmail();
        if (!userId) return ErrorResponse({ message: "Unauthorized", status: 401 });

        const user = await prisma.user.findFirst({
            where: userWhereEmail(userId),
            select: { role: true },
        });
        if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
            return ErrorResponse({ message: "Admin access required", status: 403 });
        }

        const DAY_MS = 24 * 60 * 60 * 1000;
        const cutoff = new Date(Date.now() - DAY_MS);

        // Find tournaments whose winner was declared > 24h ago
        const expiredTournaments = await prisma.tournament.findMany({
            where: {
                isWinnerDeclared: true,
                updatedAt: { lt: cutoff },
                type: { in: [...BRACKET_TYPES] },
            },
            select: { id: true, name: true },
        });

        if (expiredTournaments.length === 0) {
            return SuccessResponse({ message: "No expired tournaments to clean up", data: { cleaned: 0 } });
        }

        const tournamentIds = expiredTournaments.map(t => t.id);

        // Get all bracket results with Cloudinary screenshot URLs
        const resultsWithScreenshots = await prisma.bracketResult.findMany({
            where: {
                bracketMatch: { tournamentId: { in: tournamentIds } },
                screenshotUrl: { not: null },
            },
            select: { id: true, screenshotUrl: true },
        });

        // Filter for Cloudinary URLs only (not ImgBB legacy)
        const cloudinaryResults = resultsWithScreenshots.filter(
            r => r.screenshotUrl?.includes("res.cloudinary.com")
        );

        // Delete from Cloudinary via Admin API
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;
        let deletedFromCloud = 0;

        if (cloudName && apiKey && apiSecret && cloudinaryResults.length > 0) {
            // Extract public IDs from Cloudinary URLs
            // URL format: https://res.cloudinary.com/{cloud}/image/upload/{transforms}/{public_id}.{ext}
            const publicIds = cloudinaryResults
                .map(r => {
                    const url = r.screenshotUrl!;
                    const match = url.match(/\/upload\/(?:[^/]+\/)*(.+)\.\w+$/);
                    return match?.[1] ?? null;
                })
                .filter((id): id is string => id !== null);

            // Cloudinary allows batch delete up to 100 at a time
            for (let i = 0; i < publicIds.length; i += 100) {
                const batch = publicIds.slice(i, i + 100);
                const timestamp = Math.floor(Date.now() / 1000);
                const paramsStr = `public_ids=${batch.join(",")}&timestamp=${timestamp}`;

                // Generate signature: sha1(params + api_secret)
                const encoder = new TextEncoder();
                const data = encoder.encode(paramsStr + apiSecret);
                const hashBuffer = await crypto.subtle.digest("SHA-1", data);
                const signature = Array.from(new Uint8Array(hashBuffer))
                    .map(b => b.toString(16).padStart(2, "0"))
                    .join("");

                const formData = new FormData();
                batch.forEach(id => formData.append("public_ids[]", id));
                formData.append("timestamp", String(timestamp));
                formData.append("api_key", apiKey);
                formData.append("signature", signature);

                const res = await fetch(
                    `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload`,
                    { method: "DELETE", body: formData }
                );

                if (res.ok) {
                    const result = await res.json();
                    deletedFromCloud += Object.keys(result.deleted || {}).length;
                }
            }
        }

        // Null out screenshotUrl in the database for all expired tournament results
        const allResultIds = resultsWithScreenshots.map(r => r.id);
        if (allResultIds.length > 0) {
            await prisma.bracketResult.updateMany({
                where: { id: { in: allResultIds } },
                data: { screenshotUrl: null },
            });
        }

        return SuccessResponse({
            message: `Cleaned up ${expiredTournaments.length} tournament(s): ${deletedFromCloud} images deleted from Cloudinary, ${allResultIds.length} DB records cleared`,
            data: {
                tournaments: expiredTournaments.map(t => t.name),
                imagesDeleted: deletedFromCloud,
                dbRecordsCleared: allResultIds.length,
            },
        });
    } catch (error) {
        return ErrorResponse({ message: "Cleanup failed", error });
    }
}
