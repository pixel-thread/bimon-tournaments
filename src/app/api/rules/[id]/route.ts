import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";

/**
 * PUT /api/rules/[id]
 * Admin only — update a rule.
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { id } = await params;
        const body = await req.json();
        const { title, content, order, category } = body;

        if (!title?.trim() || !content?.trim()) {
            return NextResponse.json({ error: "Title and content required" }, { status: 400 });
        }

        const rule = await prisma.rule.update({
            where: { id },
            data: {
                title: title.trim(),
                content: content.trim(),
                category: category || undefined,
                order: order ?? undefined,
            },
        });

        return NextResponse.json({ success: true, data: rule });
    } catch (error) {
        console.error("Error updating rule:", error);
        return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
    }
}

/**
 * DELETE /api/rules/[id]
 * Admin only — delete a single rule.
 */
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { id } = await params;
        await prisma.rule.delete({ where: { id } });

        return NextResponse.json({ success: true, message: "Rule deleted" });
    } catch (error) {
        console.error("Error deleting rule:", error);
        return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
    }
}
