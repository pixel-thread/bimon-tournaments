"use client";

import { useAuthGate } from "@/components/common/auth-gate-provider";
import { AuthRequired } from "@/components/common/auth-required";

/**
 * Layout for auth-protected pages (profile, wallet, settings, etc.)
 * Shows skeleton while session loads, then blurred skeleton + login modal for guests.
 */
export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { isSignedIn, isLoading } = useAuthGate();

    // Show a skeleton while auth session resolves (avoids blank page on refresh)
    if (isLoading) return (
        <div className="flex min-h-[80dvh] items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
    );

    if (!isSignedIn) {
        return <AuthRequired />;
    }

    return <>{children}</>;
}
