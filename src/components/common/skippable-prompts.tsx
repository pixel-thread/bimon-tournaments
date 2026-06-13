"use client";

import { useState, useEffect } from "react";
import { PwaInstallPrompt } from "@/components/common/pwa-install-prompt";
import { PushGuard } from "@/components/common/push-guard";

const SKIP_KEY = "skip-prompts-until";
const SKIP_DURATION = 7 * 24 * 60 * 60 * 1000; // 1 week

/**
 * SkippablePrompts — Shows PWA install + push notification prompts,
 * but allows the user to skip them for 1 week.
 */
export function SkippablePrompts() {
    const [skipped, setSkipped] = useState(true); // default hidden until check

    useEffect(() => {
        const until = localStorage.getItem(SKIP_KEY);
        if (until && Date.now() < Number(until)) {
            setSkipped(true);
        } else {
            setSkipped(false);
        }
    }, []);

    const handleSkip = () => {
        localStorage.setItem(SKIP_KEY, String(Date.now() + SKIP_DURATION));
        setSkipped(true);
    };

    if (skipped) return null;

    return (
        <>
            <PwaInstallPrompt />
            <PushGuard />
            {/* Floating skip button */}
            <button
                type="button"
                onClick={handleSkip}
                className="fixed bottom-20 right-4 z-[9999] px-3 py-1.5 rounded-full bg-default-100 border border-divider text-xs font-semibold text-foreground/50 hover:text-foreground/70 hover:bg-default-200 transition-colors shadow-lg cursor-pointer"
            >
                Skip for now
            </button>
        </>
    );
}
