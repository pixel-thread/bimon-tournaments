import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/whatsapp/send-rules
 * Admin sends custom rules to WhatsApp group + saves to tournament.highlightedRules.
 * Players see these on the My Slot page.
 *
 * Body: { tournamentId, rules: string[], group? }
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

        const { tournamentId, rules, group } = await req.json();

        if (!tournamentId || !rules || !Array.isArray(rules) || rules.length === 0) {
            return NextResponse.json(
                { error: "tournamentId and rules[] are required" },
                { status: 400 },
            );
        }

        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            select: {
                id: true,
                name: true,
                whatsappGroupId: true,
                whatsappGroupChannels: true,
            },
        });

        if (!tournament) {
            return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
        }

        // 1. Save rules to tournament
        await prisma.tournament.update({
            where: { id: tournamentId },
            data: { highlightedRules: rules },
        });

        // 2. Send to WhatsApp group
        let whatsappSent = false;
        try {
            const { sendMessage } = await import("@/lib/whatsapp");

            let groupId: string | null = null;
            if (group && tournament.whatsappGroupChannels) {
                const channels = tournament.whatsappGroupChannels as Record<string, string>;
                groupId = channels[group] || null;
            } else {
                groupId = tournament.whatsappGroupId || null;
            }

            if (groupId) {
                // Format rules with proper spacing for multi-line entries
                const formattedRules = rules.map((r, i) => {
                    const lines = r.split("\n").filter((l: string) => l.trim());
                    if (lines.length === 1) {
                        return `*${i + 1}.* ${lines[0]}`;
                    }
                    // Multi-line rule: bold the first line, indent sub-lines
                    return [
                        `*${i + 1}.* ${lines[0]}`,
                        ...lines.slice(1).map((l: string) => `      ${l.trim()}`),
                    ].join("\n");
                });

                const waMessage = [
                    `📋 *Tournament Rules — ${tournament.name}*`,
                    ``,
                    formattedRules.join("\n\n"),
                    ``,
                    `⚠️ *Breaking any rule = disqualification*`,
                ].join("\n");

                await sendMessage(groupId, waMessage);
                whatsappSent = true;
                console.log(`[SendRules] WhatsApp sent for ${tournamentId}`);
            }
        } catch (err) {
            console.error("[SendRules] WhatsApp error:", err);
        }

        return NextResponse.json({
            success: true,
            whatsappSent,
            message: whatsappSent
                ? "Rules sent to WhatsApp group & saved"
                : "Rules saved (WhatsApp send failed)",
        });
    } catch (error) {
        console.error("[SendRules] Error:", error);
        return NextResponse.json({ error: "Failed to send rules" }, { status: 500 });
    }
}
