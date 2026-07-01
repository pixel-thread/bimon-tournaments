import { auth } from "@/lib/auth-config";
import { NextRequest, NextResponse } from "next/server";

// Routes that require authentication (hard redirect to sign-in)
// Only truly server-gated routes go here. User-facing pages use
// the client-side (protected) layout for a nicer blurred skeleton + modal UX.
const protectedRoutes = [
    "/dashboard",
    "/onboarding",
];

// Routes that are always public (bypass auth check)
const publicRoutes = [
    "/",
    "/sign-in",
    "/sign-up",
    "/about",
    "/faq",
    "/rules",
    "/recent-matches",
    "/vote",       // guests can browse polls
    "/players",    // guests can browse player list
    "/bracket",    // guests can view brackets
    "/community",  // guests can browse community
    "/winners",    // guests can see winners
    "/games",      // guests can play memory game
    "/invite",     // guests can view squad invite links
    "/jobs",       // guests can see job listings
    "/help",       // guests can view help
    "/tournaments",  // public tournament history
    "/leaderboard",  // public leaderboard
    "/blog",         // blog articles
    "/api/auth", // NextAuth handler
    "/api/cron",
    "/api/payments/webhook",
    "/api/public", // public data endpoints
];

// ─── Domain → Game Mode mapping ─────────────────────────────
const DOMAIN_GAME_MAP: Record<string, string> = {
    // pixel-thread.in domains (new)
    "bgmi.pixel-thread": "bgmi",
    "ff.pixel-thread": "freefire",
    "pes.pixel-thread": "pes",
    "ml.pixel-thread": "mlbb",
    // vercel.app domains (legacy)
    "bimon-bgmi": "bgmi",
    "bimon-boo-yah": "freefire",
    "bimon-pes": "pes",
    "bimon-ml": "mlbb",
};

function detectGameMode(hostname: string): string {
    for (const [domain, mode] of Object.entries(DOMAIN_GAME_MAP)) {
        if (hostname.includes(domain)) return mode;
    }
    // Local dev fallback: use env var or default
    return process.env.NEXT_PUBLIC_GAME_MODE || "bgmi";
}

// Wrap the auth middleware to gracefully handle corrupted session cookies
// (e.g. after AUTH_SECRET rotation). Instead of showing "Server error",
// we clear the bad cookie and redirect to sign-in.
const authMiddleware = auth((req) => {
    const { pathname } = req.nextUrl;
    const hostname = req.headers.get("host") || "";

    // ─── Detect game mode from domain ───
    const gameMode = detectGameMode(hostname);

    // Check if it's a public route
    const isPublic = publicRoutes.some(
        (route) => pathname === route || pathname.startsWith(route + "/")
    );

    if (isPublic) {
        const requestHeaders = new Headers(req.headers);
        requestHeaders.set("x-game-mode", gameMode);
        const response = NextResponse.next({
            request: { headers: requestHeaders },
        });
        response.headers.set("x-game-mode", gameMode);
        response.cookies.set("game-mode", gameMode, { path: "/", sameSite: "lax" });
        return response;
    }

    // Check if it's a protected route
    const isProtected = protectedRoutes.some(
        (route) => pathname === route || pathname.startsWith(route + "/")
    );

    if (isProtected && !req.auth) {
        const signInUrl = new URL("/sign-in", req.url);
        signInUrl.searchParams.set("callbackUrl", req.url);
        return NextResponse.redirect(signInUrl);
    }

    const reqHeaders = new Headers(req.headers);
    reqHeaders.set("x-game-mode", gameMode);
    const response = NextResponse.next({
        request: { headers: reqHeaders },
    });
    response.headers.set("x-game-mode", gameMode);
    response.cookies.set("game-mode", gameMode, { path: "/", sameSite: "lax" });
    return response;
});

export default async function middleware(req: NextRequest) {
    try {
        return await (authMiddleware as (req: NextRequest) => Promise<NextResponse>)(req);
    } catch (error) {
        // Session cookie is corrupted (e.g. AUTH_SECRET was rotated)
        // Clear the bad cookie and redirect to sign-in
        console.error("[middleware] Session error, clearing cookie:", error);
        const response = NextResponse.redirect(new URL("/sign-in", req.url));
        response.cookies.delete("authjs.session-token");
        response.cookies.delete("__Secure-authjs.session-token");
        response.cookies.delete("authjs.callback-url");
        response.cookies.delete("authjs.csrf-token");
        return response;
    }
}

export const config = {
    matcher: [
        // Skip static files and Next.js internals
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes
        "/(api|trpc)(.*)",
    ],
};
