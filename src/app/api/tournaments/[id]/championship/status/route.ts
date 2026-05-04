import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getChampionshipStatus } from "@/lib/logic/championship";

/**
 * GET /api/tournaments/[id]/championship/status
 * Fetch current championship state (entries, matches, phase).
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: tournamentId } = await params;
        const status = await getChampionshipStatus(tournamentId);

        return NextResponse.json({ success: true, data: status });
    } catch (error: any) {
        console.error("[championship/status] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch championship status" },
            { status: 500 }
        );
    }
}
