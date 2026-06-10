import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { linkWhatsApp, isLinked, unlinkWhatsApp } from "@/lib/whatsapp";
import QRCode from "qrcode";

// QR scan needs the function alive for up to 55s
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * GET /api/whatsapp/auth
 * Returns WhatsApp link status.
 */
export async function GET() {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const linked = await isLinked();
    return NextResponse.json({ status: linked ? "linked" : "unlinked" });
}

/**
 * POST /api/whatsapp/auth
 * Start WhatsApp linking via SSE.
 *
 * Returns a Server-Sent Events stream that:
 * 1. Sends `event: qr` with the QR code data URL when ready
 * 2. Sends `event: connected` when user scans the QR
 * 3. Sends `event: error` if something goes wrong
 *
 * The socket stays alive throughout so the scan actually works.
 */
export async function POST() {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    // Check if already linked
    const linked = await isLinked();
    if (linked) {
        return NextResponse.json({ status: "linked" });
    }

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            try {
                await linkWhatsApp(async (qrString) => {
                    // Convert QR string to data URL for display
                    const qrDataUrl = await QRCode.toDataURL(qrString, {
                        width: 300,
                        margin: 2,
                        color: { dark: "#000000", light: "#ffffff" },
                    });
                    // Send QR event to client
                    controller.enqueue(
                        encoder.encode(`event: qr\ndata: ${JSON.stringify({ qr: qrDataUrl })}\n\n`)
                    );
                });

                // linkWhatsApp resolved — user scanned successfully
                controller.enqueue(
                    encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: "linked" })}\n\n`)
                );
                controller.close();
            } catch (error) {
                // Timeout or error
                controller.enqueue(
                    encoder.encode(`event: error\ndata: ${JSON.stringify({ error: (error as Error).message })}\n\n`)
                );
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        },
    });
}

/**
 * DELETE /api/whatsapp/auth
 * Unlink WhatsApp — clears all auth credentials.
 */
export async function DELETE() {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    await unlinkWhatsApp();
    return NextResponse.json({ status: "unlinked" });
}
