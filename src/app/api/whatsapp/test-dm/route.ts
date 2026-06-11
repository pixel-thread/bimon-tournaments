import { NextResponse } from "next/server";
import { connectAndExecute } from "@/lib/whatsapp";
import { prisma } from "@/lib/database";

/**
 * GET /api/whatsapp/test-dm?phone=918837011018
 * Quick test: send invite link DM to a phone number.
 */
export async function GET(req: Request) {
    const url = new URL(req.url);
    const phone = url.searchParams.get("phone") || "918837011018";
    const jid = `${phone}@s.whatsapp.net`;

    const inviteLink = "https://chat.whatsapp.com/IdKfL0h5PIRCjufSy4PuC9";
    const name = "BGMI Tournament";

    try {
        await connectAndExecute(async (sock) => {
            const message = [
                `🏆 *${name}*`,
                ``,
                `Hi! You're a team leader.`,
                ``,
                `📲 Join the WhatsApp group:`,
                inviteLink,
            ].join("\n");

            await sock.sendMessage(jid, { text: message });
        });
        return NextResponse.json({ success: true, sentTo: phone, tournament: name, inviteLink });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
