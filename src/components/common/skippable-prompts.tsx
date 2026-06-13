"use client";

import { useState, useEffect } from "react";
import { PwaInstallPrompt } from "@/components/common/pwa-install-prompt";

const SKIP_KEY = "skip-pwa-prompt-until";
const SKIP_DURATION = 7 * 24 * 60 * 60 * 1000; // 1 week

/**
 * SkippablePrompts — Shows PWA install prompt only.
 * Push notifications are handled by PushPrompt on the notifications page.
 * "Maybe later" hides the PWA prompt for 1 week.
 */
export function SkippablePrompts() {
    const [skipped, setSkipped] = useState(true); // hidden until check

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

    return <PwaInstallPrompt onSkip={handleSkip} />;
}
