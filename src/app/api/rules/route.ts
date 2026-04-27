import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/rules
 * Public — fetch all rules ordered by `order`.
 */
export async function GET() {
    try {
        const rules = await prisma.rule.findMany({
            orderBy: { order: "asc" },
        });
        return NextResponse.json({ success: true, data: rules });
    } catch (error) {
        console.error("Error fetching rules:", error);
        return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 });
    }
}

/**
 * POST /api/rules
 * Admin only — create a new rule.
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const body = await req.json();
        const { title, content, order, category } = body;

        if (!title?.trim() || !content?.trim()) {
            return NextResponse.json({ error: "Title and content required" }, { status: 400 });
        }

        const rule = await prisma.rule.create({
            data: {
                title: title.trim(),
                content: content.trim(),
                category: category || "BOTH",
                order: order ?? 0,
                createdBy: user.id,
            },
        });

        return NextResponse.json({ success: true, data: rule });
    } catch (error) {
        console.error("Error creating rule:", error);
        return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
    }
}

/**
 * DELETE /api/rules
 * Admin only — delete all rules.
 */
export async function DELETE() {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        await prisma.rule.deleteMany();
        return NextResponse.json({ success: true, message: "All rules deleted" });
    } catch (error) {
        console.error("Error deleting rules:", error);
        return NextResponse.json({ error: "Failed to delete rules" }, { status: 500 });
    }
}
