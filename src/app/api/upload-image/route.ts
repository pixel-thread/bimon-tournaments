import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/upload-image
 * Uploads a base64 image to ImgBB and returns the public URL.
 * Admin only. Body: { image: "data:image/jpeg;base64,..." }
 */
export async function POST(req: Request) {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    try {
        const { image } = await req.json();
        if (!image || typeof image !== "string") {
            return NextResponse.json({ error: "No image provided" }, { status: 400 });
        }

        // Extract base64 from data URL
        const base64 = image.includes(",") ? image.split(",")[1] : image;

        const imgbbForm = new FormData();
        imgbbForm.append("key", process.env.IMGBB_API_KEY!);
        imgbbForm.append("image", base64);
        imgbbForm.append("name", `channel_${Date.now()}`);

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
        return NextResponse.json({ url: imgbbData.data.url });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
