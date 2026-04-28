import { NextResponse } from "next/server";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { prisma } from "@/lib/database";
import { GAME } from "@/lib/game-config";

/**
 * POST /api/clans/upload-logo
 * Uploads a clan logo to ImgBB and saves the URL in Clan.logoUrl.
 * Only the clan leader can upload.
 */
export async function POST(req: Request) {
    const email = await getAuthEmail();
    if (!email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findFirst({
            where: userWhereEmail(email),
            select: { player: { select: { id: true } } },
        });
        if (!user?.player) {
            return NextResponse.json({ error: "Player not found" }, { status: 404 });
        }

        // Verify caller is a clan leader
        const clan = await prisma.clan.findUnique({
            where: { leaderId: user.player.id },
        });
        if (!clan) {
            return NextResponse.json(
                { error: `You are not a ${GAME.clanLabel.toLowerCase()} leader` },
                { status: 403 }
            );
        }

        const formData = await req.formData();
        const file = formData.get("image") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No image provided" }, { status: 400 });
        }

        // Convert file to base64
        const bytes = await file.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");

        // Upload to ImgBB
        const imgbbForm = new FormData();
        imgbbForm.append("key", process.env.IMGBB_API_KEY!);
        imgbbForm.append("image", base64);
        imgbbForm.append("name", `clan_logo_${clan.id}_${Date.now()}`);

        const imgbbRes = await fetch("https://api.imgbb.com/1/upload", {
            method: "POST",
            body: imgbbForm,
        });

        if (!imgbbRes.ok) {
            const err = await imgbbRes.text();
            console.error("ImgBB upload failed:", err);
            return NextResponse.json({ error: "Image upload failed" }, { status: 500 });
        }

        const imgbbData = await imgbbRes.json();
        const logoUrl = imgbbData.data.url;

        // Update clan logo
        await prisma.clan.update({
            where: { id: clan.id },
            data: { logoUrl },
        });

        return NextResponse.json({ success: true, logoUrl });
    } catch (error) {
        console.error("Clan logo upload error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
