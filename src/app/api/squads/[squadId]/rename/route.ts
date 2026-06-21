import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { containsProfanity } from "@/lib/profanity";
import { type NextRequest } from "next/server";

/**
 * PATCH /api/squads/[squadId]/rename
 * Rename a squad. Only the captain can rename.
 * Body: { name: string, fullName?: string }
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ squadId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Player profile required", status: 403 });
        }

        const { squadId } = await params;
        const body = await request.json();
        const { name, fullName } = body as { name: string; fullName?: string };

        const trimmedName = (name || "").trim();
        const trimmedFullName = (fullName || "").trim() || null;

        if (!trimmedName) {
            return ErrorResponse({ message: "Team name is required", status: 400 });
        }

        if (trimmedName.length > 7) {
            return ErrorResponse({ message: "Team name must be 7 characters or less", status: 400 });
        }

        // Profanity check
        const badWord = containsProfanity(trimmedName) || (trimmedFullName ? containsProfanity(trimmedFullName) : null);
        if (badWord) {
            return ErrorResponse({ message: "Team name contains inappropriate language", status: 400 });
        }

        // Verify squad exists and user is captain
        const squad = await prisma.squad.findUnique({
            where: { id: squadId },
            select: { id: true, captainId: true, name: true, status: true },
        });

        if (!squad) {
            return ErrorResponse({ message: "Squad not found", status: 404 });
        }

        if (squad.captainId !== user.player.id) {
            return ErrorResponse({ message: "Only the team leader can rename", status: 403 });
        }

        if (squad.status === "CANCELLED") {
            return ErrorResponse({ message: "Cannot rename a cancelled squad", status: 400 });
        }

        // Update
        const updated = await prisma.squad.update({
            where: { id: squadId },
            data: {
                name: trimmedName,
                ...(trimmedFullName !== undefined && { fullName: trimmedFullName }),
            },
            select: { name: true, fullName: true },
        });

        return SuccessResponse({
            data: updated,
            message: `Team renamed to "${updated.name}"`,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to rename squad", error });
    }
}
