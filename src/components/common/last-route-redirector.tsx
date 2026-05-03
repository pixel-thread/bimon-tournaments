"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const STORAGE_KEY = "pubgmi_last_route";

/**
 * On mount, checks localStorage for a previously saved route.
 * If one exists, redirects there immediately (replaces the history entry).
 * This should be placed on the landing/home page so returning
 * PWA users are taken straight to where they left off.
 */
export function LastRouteRedirector() {
    const router = useRouter();

    useEffect(() => {
        try {
            const lastRoute = localStorage.getItem(STORAGE_KEY);
            if (lastRoute && lastRoute !== "/") {
                // Returning user — validate the route still exists before redirecting
                fetch(lastRoute, { method: "HEAD" })
                    .then((res) => {
                        if (res.ok) {
                            router.replace(lastRoute);
                        } else {
                            // Route no longer exists — clear and stay on landing
                            localStorage.removeItem(STORAGE_KEY);
                        }
                    })
                    .catch(() => {
                        // Network error — just redirect anyway (offline PWA)
                        router.replace(lastRoute);
                    });
            }
            // No saved route → first-time visitor — stay on landing page
            // so Google's crawler (and new users) see the content
        } catch {
            // localStorage unavailable — do nothing
        }
    }, [router]);

    return null;
}
