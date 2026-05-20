"use client";

import { Spinner } from "@heroui/react";

/**
 * Loading state for the dashboard route group.
 */
export default function DashboardLoading() {
    return (
        <div className="flex min-h-[80dvh] items-center justify-center">
            <Spinner size="lg" />
        </div>
    );
}
