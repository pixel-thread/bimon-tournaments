import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth";

/**
 * GET /api/survey/results
 * Admin-only: returns aggregated survey results.
 */
export async function GET() {
    try {
        await requireAdmin();

        const surveys = await prisma.playerSurvey.findMany({
            select: {
                maps: true,
                timing: true,
                device: true,
            },
        });

        const totalResponses = surveys.length;

        // Aggregate map votes
        const mapCounts: Record<string, number> = {};
        for (const s of surveys) {
            for (const m of s.maps) {
                mapCounts[m] = (mapCounts[m] || 0) + 1;
            }
        }
        const mapResults = Object.entries(mapCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        // Aggregate timing votes
        const timingCounts: Record<string, number> = {};
        for (const s of surveys) {
            timingCounts[s.timing] = (timingCounts[s.timing] || 0) + 1;
        }
        const timingResults = Object.entries(timingCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        // Aggregate device votes
        const deviceCounts: Record<string, number> = {};
        for (const s of surveys) {
            deviceCounts[s.device] = (deviceCounts[s.device] || 0) + 1;
        }
        const deviceResults = Object.entries(deviceCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        return SuccessResponse({
            data: {
                totalResponses,
                maps: mapResults,
                timings: timingResults,
                devices: deviceResults,
            },
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch survey results", error });
    }
}
