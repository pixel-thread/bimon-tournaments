import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendTournamentRules } from "@/lib/discord-service";
import { prisma } from "@/lib/database";

/**
 * POST /api/discord/send-rules
 *
 * Sends pre-configured tournament rules (banned items, slot scam prevention,
 * server issues) to the tournament's Discord channel.
 * Admin or UC-exempt players.
 *
 * Body: { tournamentId, tournamentName }
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
        const isUCExempt = user?.player
            ? (await prisma.player.findUnique({ where: { id: user.player.id }, select: { isUCExempt: true } }))?.isUCExempt
            : false;
        if (!user || (!isAdmin && !isUCExempt)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { tournamentId, tournamentName } = await req.json();

        if (!tournamentId || !tournamentName) {
            return NextResponse.json({ error: "Missing tournamentId or tournamentName" }, { status: 400 });
        }

        await sendTournamentRules(tournamentId, tournamentName);

        // Also send rules to WhatsApp group (fire-and-forget)
        import("@/lib/whatsapp").then(async ({ sendMessage }) => {
            try {
                const tournament = await prisma.tournament.findUnique({
                    where: { id: tournamentId },
                    select: { whatsappGroupId: true },
                });
                if (!tournament?.whatsappGroupId) return;

                // Load saved rules
                const rulesRow = await prisma.appConfig.findUnique({
                    where: { key: "tournament_rules" },
                });
                interface SavedRule { id: string; text: string }
                const rules: SavedRule[] = rulesRow ? JSON.parse(rulesRow.value) : [];

                if (rules.length === 0) return;

                const rulesText = [
                    `📜 *Tournament Rules — ${tournamentName}*`,
                    ``,
                    ...rules.map((r, i) => `${i + 1}. ${r.text}`),
                    ``,
                    `⚠️ Violating rules may lead to disqualification.`,
                ].join("\n");

                await sendMessage(tournament.whatsappGroupId, rulesText);
                console.log(`[Rules] WhatsApp sent for ${tournamentId}`);
            } catch (err) {
                console.error("[Rules] WhatsApp error:", err);
            }
        });

        return NextResponse.json({ success: true, message: "Tournament rules sent to Discord" });
    } catch (error) {
        console.error("Discord send-rules error:", error);
        return NextResponse.json({ error: "Failed to send rules to Discord" }, { status: 500 });
    }
}
