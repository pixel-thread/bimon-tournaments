"use client";

import { Spinner } from "@heroui/react";

/**
 * Root loading state — shown during initial page load before layouts hydrate.
 * Uses fixed positioning to guarantee perfect centering regardless of layout state.
 */
export default function RootLoading() {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
            <Spinner size="lg" />
        </div>
    );
}
