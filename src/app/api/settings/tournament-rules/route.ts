import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRequestPrisma, prisma } from "@/lib/database";

const RULES_KEY = "tournament_rules";

export interface TournamentRule {
    id: string;
    text: string;
    imageUrl?: string;
}

/**
 * GET /api/settings/tournament-rules
 * Fetch saved tournament rules.
 */
export async function GET() {
    try {
        const user = await getCurrentUser();
        const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
        const isUCExempt = user?.player
            ? (await prisma.player.findUnique({ where: { id: user.player.id }, select: { isUCExempt: true } }))?.isUCExempt
            : false;
        if (!user || (!isAdmin && !isUCExempt)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const db = await getRequestPrisma();
        const row = await db.appConfig.findUnique({ where: { key: RULES_KEY } });
        const rules: TournamentRule[] = row ? JSON.parse(row.value) : [];

        return NextResponse.json({ success: true, data: rules });
    } catch (error) {
        console.error("Error fetching tournament rules:", error);
        return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 });
    }
}

/**
 * PUT /api/settings/tournament-rules
 * Save tournament rules (array of { id, text, imageUrl? }).
 */
export async function PUT(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
        const isUCExempt = user?.player
            ? (await prisma.player.findUnique({ where: { id: user.player.id }, select: { isUCExempt: true } }))?.isUCExempt
            : false;
        if (!user || (!isAdmin && !isUCExempt)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { rules } = await req.json() as { rules: TournamentRule[] };

        if (!Array.isArray(rules)) {
            return NextResponse.json({ error: "rules must be an array" }, { status: 400 });
        }

        // Sanitize
        const cleaned = rules
            .filter(r => r.text?.trim())
            .map(r => ({
                id: r.id || crypto.randomUUID(),
                text: r.text.trim(),
                imageUrl: r.imageUrl || undefined,
            }));

        const db = await getRequestPrisma();
        await db.appConfig.upsert({
            where: { key: RULES_KEY },
            create: { key: RULES_KEY, value: JSON.stringify(cleaned) },
            update: { value: JSON.stringify(cleaned) },
        });

        return NextResponse.json({ success: true, data: cleaned });
    } catch (error) {
        console.error("Error saving tournament rules:", error);
        return NextResponse.json({ error: "Failed to save rules" }, { status: 500 });
    }
}

/**
 * POST /api/settings/tournament-rules
 * Upload an image for a rule (via ImgBB).
 * FormData: { image: File }
 * Returns: { imageUrl: string }
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

        const formData = await req.formData();
        const file = formData.get("image") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No image provided" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");

        const imgbbForm = new FormData();
        imgbbForm.append("key", process.env.IMGBB_API_KEY!);
        imgbbForm.append("image", base64);
        imgbbForm.append("name", `rule_${Date.now()}`);

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
        const imageUrl: string = imgbbData.data.url;

        return NextResponse.json({ success: true, data: { imageUrl } });
    } catch (error) {
        console.error("Error uploading rule image:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
