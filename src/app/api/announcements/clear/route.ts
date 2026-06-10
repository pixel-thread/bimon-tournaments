import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";

/**
 * DELETE /api/announcements/clear
 * Clear ALL announcements. Called when a new tournament starts.
 * Admin only.
 */
export async function DELETE() {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return ErrorResponse({ message: "Admin only", status: 403 });
        }

        // Delete replies first (children), then parents
        await prisma.announcement.deleteMany({ where: { parentId: { not: null } } });
        await prisma.announcement.deleteMany();

        return SuccessResponse({
            message: "All announcements cleared",
            data: null,
            cache: CACHE.NONE,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to clear announcements", error });
    }
}
