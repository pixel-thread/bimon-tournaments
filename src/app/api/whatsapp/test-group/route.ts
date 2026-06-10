import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createGroup, deleteGroup } from "@/lib/whatsapp";

export const maxDuration = 60;

/**
 * POST /api/whatsapp/test-group
 * Creates a test WhatsApp group to verify the bot works.
 */
export async function POST() {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    try {
        const groupId = await createGroup("🧪 BGMI Test Group");
        return NextResponse.json({
            success: true,
            groupId,
            message: "Test group created! Check your WhatsApp.",
        });
    } catch (error) {
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/whatsapp/test-group
 * Deletes a test group by ID.
 */
export async function DELETE(req: Request) {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { groupId } = await req.json();
    if (!groupId) {
        return NextResponse.json({ error: "groupId required" }, { status: 400 });
    }

    try {
        await deleteGroup(groupId);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 }
        );
    }
}
