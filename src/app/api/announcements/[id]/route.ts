import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";

/**
 * DELETE /api/announcements/[id]
 * Delete an announcement.
 * - Admin: can delete any message
 * - Author: can delete own message
 */
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Sign in required", status: 401 });
        }

        const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
        const { id } = await params;

        // Check ownership if not admin
        if (!isAdmin) {
            const msg = await prisma.announcement.findUnique({
                where: { id },
                select: { authorId: true },
            });
            if (!msg || msg.authorId !== user.player.id) {
                return ErrorResponse({ message: "You can only delete your own messages", status: 403 });
            }
        }

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

/**
 * PATCH /api/announcements/[id]
 * Edit an announcement's content.
 * - Admin: can edit any message
 * - Author: can edit own message
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Sign in required", status: 401 });
        }

        const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
        const { id } = await params;
        const body = await req.json();
        const { content } = body;

        if (!content || typeof content !== "string" || content.trim().length === 0) {
            return ErrorResponse({ message: "Content is required", status: 400 });
        }

        // Check ownership if not admin
        if (!isAdmin) {
            const msg = await prisma.announcement.findUnique({
                where: { id },
                select: { authorId: true },
            });
            if (!msg || msg.authorId !== user.player.id) {
                return ErrorResponse({ message: "You can only edit your own messages", status: 403 });
            }
        }

        const updated = await prisma.announcement.update({
            where: { id },
            data: { content: content.trim() },
            include: {
                author: {
                    select: {
                        id: true,
                        displayName: true,
                        customProfileImageUrl: true,
                        user: { select: { imageUrl: true } },
                    },
                },
                _count: { select: { replies: true } },
            },
        });

        return SuccessResponse({
            message: "Updated",
            data: updated,
            cache: CACHE.NONE,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to update", error });
    }
}
