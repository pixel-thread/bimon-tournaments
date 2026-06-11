import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addMembers, sendMessage } from "@/lib/whatsapp";

export const maxDuration = 60;

/**
 * POST /api/whatsapp/test-add
 * Add members to a WhatsApp group for testing.
 * Body: { groupId: string, phones: [{phone, name}] }
 */
export async function POST(req: Request) {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { groupId, phones, message } = await req.json();

    // If message provided, send a message to the group
    if (message && groupId) {
        try {
            await sendMessage(groupId, message);
            return NextResponse.json({ success: true, action: "message_sent" });
        } catch (error) {
            return NextResponse.json({ error: (error as Error).message }, { status: 500 });
        }
    }

    // Otherwise add members
    if (!groupId || !phones?.length) {
        return NextResponse.json({ error: "groupId and phones required" }, { status: 400 });
    }

    try {
        const result = await addMembers(groupId, phones);
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
