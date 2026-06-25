import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/tournaments/[id]/highlighted-rules
 * Fetch highlighted rules for a tournament (admin only).
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { id } = await params;

        const tournament = await prisma.tournament.findUnique({
            where: { id },
            select: { highlightedRules: true },
        });

        if (!tournament) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        return NextResponse.json({
            highlightedRules: tournament.highlightedRules || [],
        });
    } catch (error) {
        console.error("[HighlightedRules] Error:", error);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}

/**
 * PUT /api/tournaments/[id]/highlighted-rules
 * Save highlighted rules to DB only (no WhatsApp send).
 * Body: { rules: string[] }
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
        const { rules } = await req.json();

        if (!Array.isArray(rules)) {
            return NextResponse.json({ error: "rules[] required" }, { status: 400 });
        }

        await prisma.tournament.update({
            where: { id },
            data: { highlightedRules: rules },
        });

        return NextResponse.json({ success: true, message: "Rules saved!" });
    } catch (error) {
        console.error("[HighlightedRules] PUT Error:", error);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
