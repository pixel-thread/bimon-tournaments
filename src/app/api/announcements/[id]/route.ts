import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";

/**
 * DELETE /api/announcements/[id]
 * Delete an announcement. Admin only.
 * Cascade deletes all replies.
 */
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return ErrorResponse({ message: "Admin only", status: 403 });
        }

        const { id } = await params;

        await prisma.announcement.delete({ where: { id } });

        return SuccessResponse({
            message: "Deleted",
            data: null,
            cache: CACHE.NONE,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to delete", error });
    }
}
