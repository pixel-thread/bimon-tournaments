"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { GAME, GAME_MODE } from "@/lib/game-config";

if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        capture_pageview: false, // We capture manually below
        capture_pageleave: true,
        persistence: "localStorage",
    });
    // Tag every event with the game so we can filter BGMI vs MLBB in one project
    posthog.register({ game: GAME_MODE, game_name: GAME.name });
}

/** Track page views on route change */
function PostHogPageView() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const ph = usePostHog();

    useEffect(() => {
        if (pathname && ph) {
            let url = window.origin + pathname;
            const search = searchParams?.toString();
            if (search) url += `?${search}`;
            ph.capture("$pageview", { $current_url: url });
        }
    }, [pathname, searchParams, ph]);

    return null;
}

/** Identify logged-in users */
function PostHogIdentify() {
    const { data: session } = useSession();
    const ph = usePostHog();

    useEffect(() => {
        if (session?.user && ph) {
            ph.identify(session.user.email || session.user.id, {
                email: session.user.email,
                name: session.user.name,
            });
        }
    }, [session, ph]);

    return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        return <>{children}</>;
    }

    return (
        <PHProvider client={posthog}>
            <PostHogPageView />
            <PostHogIdentify />
            {children}
        </PHProvider>
    );
}
