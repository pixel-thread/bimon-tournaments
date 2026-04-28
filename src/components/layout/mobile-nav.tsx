"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Users,
    Vote,
    Gamepad2,
    LayoutDashboard,
    Loader2,
    MessageCircle,
    Swords,
    HelpCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useAuthUser } from "@/hooks/use-auth-user";
import { type LucideIcon } from "lucide-react";
import { sidebarItems } from "./admin-sidebar";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";
import { useSquadInviteCount } from "@/hooks/use-squad-invite-count";
import { useClanInviteCount } from "@/hooks/use-clan-invite-count";

type Tab = {
    label: string;
    href: string;
    icon?: LucideIcon;
};

// Build tabs based on game features
const tabs: Tab[] = [
    { label: "Players", href: "/players", icon: Users },
    { label: "Vote", href: "/vote", icon: Vote },
    ...(GAME.features.hasBracket
        ? [{ label: "Matches", href: "/bracket", icon: Swords }]
        : [{ label: "Games", href: "/games", icon: Gamepad2 }]),
    { label: "Profile", href: "/profile" },
];

/**
 * Bottom tab bar for mobile — only visible on small screens.
 * Profile tab uses the user's real profile picture.
 * Shows a spinner on the icon while navigating to a new tab.
 */
export function MobileNav() {
    const pathname = usePathname();
    const { isAdmin, balance } = useAuthUser();
    const { data: session } = useSession();
    const user = session?.user;
    const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
    const pendingInviteCount = useSquadInviteCount();
    const pendingClanInviteCount = useClanInviteCount();

    const { data: profileData } = useQuery<{ imageUrl?: string; player?: { displayName?: string; customProfileImageUrl?: string | null } | null; username?: string }>({
        queryKey: ["profile"],
        queryFn: async () => {
            const res = await fetch("/api/profile");
            if (!res.ok) return {};
            const json = await res.json();
            return json.data || {};
        },
        enabled: !!user,
        staleTime: 5 * 60 * 1000,
    });
    const profile = {
        imageUrl: profileData?.player?.customProfileImageUrl || profileData?.imageUrl,
        displayName: profileData?.player?.displayName || profileData?.username,
    };

    // Clear loading when pathname changes (navigation complete)
    useEffect(() => {
        setNavigatingTo(null);
    }, [pathname]);

    // Remember the last dashboard page visited (persisted via localStorage)
    const [lastDashboard, setLastDashboard] = useState<{ label: string; icon: LucideIcon; href: string }>(() => {
        if (typeof window === "undefined") return { label: "Admin", icon: LayoutDashboard, href: "/dashboard" };
        try {
            const saved = localStorage.getItem("lastDashboardPage");
            if (saved) {
                const parsed = JSON.parse(saved);
                // Restore icon from sidebarItems
                let icon: LucideIcon = LayoutDashboard;
                for (const section of sidebarItems) {
                    for (const item of section.items) {
                        if (parsed.href === item.href || (item.href !== "/dashboard" && parsed.href?.startsWith(item.href))) {
                            icon = item.icon;
                            break;
                        }
                    }
                }
                return { label: parsed.label || "Admin", icon, href: parsed.href || "/dashboard" };
            }
        } catch { }
        return { label: "Admin", icon: LayoutDashboard, href: "/dashboard" };
    });

    // Update when on a dashboard page
    useEffect(() => {
        if (pathname.startsWith("/dashboard")) {
            const sub = pathname.split("/")[2];
            // Use the sidebar item's real label, shortened for nav
            let label = sub ? sub.charAt(0).toUpperCase() + sub.slice(1) : "Admin";
            for (const section of sidebarItems) {
                for (const item of section.items) {
                    if (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))) {
                        // Use last word of multi-word labels (e.g. "Player Insights" → "Insights")
                        const words = item.label.split(" ");
                        label = words.length > 1 ? words[words.length - 1] : item.label;
                        break;
                    }
                }
            }

            let icon: LucideIcon = LayoutDashboard;
            for (const section of sidebarItems) {
                for (const item of section.items) {
                    if (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))) {
                        icon = item.icon;
                        break;
                    }
                }
            }

            setLastDashboard({ label, icon, href: pathname });
            try {
                localStorage.setItem("lastDashboardPage", JSON.stringify({ label, href: pathname }));
            } catch { }
        }
    }, [pathname]);

    const allTabs = isAdmin
        ? [{ label: lastDashboard.label, href: lastDashboard.href, icon: lastDashboard.icon }, ...tabs]
        : tabs;

    const initials = user?.name?.[0]?.toUpperCase() || "?";

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-divider bg-background/80 backdrop-blur-xl lg:hidden game-bottom-nav">
            <div className="mx-auto flex max-w-lg items-center justify-around">
                {allTabs.map((tab) => {
                    const isActive = pathname.startsWith(tab.href);
                    const isProfile = tab.label === "Profile";
                    const profileLabel = profile?.displayName?.split(" ")[0] || user?.name?.split(" ")[0] || "Profile";
                    const isLoading = navigatingTo === tab.href && !isActive;

                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            onClick={() => {
                                if (!isActive) setNavigatingTo(tab.href);
                            }}
                            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${isActive
                                ? "game-nav-active"
                                : "text-foreground/50 active:text-foreground"
                                }`}
                        >
                            {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : isProfile ? (
                                (profile?.imageUrl || user?.image) ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={profile?.imageUrl || user?.image || ""}
                                        alt="Profile"
                                        className={`h-5 w-5 rounded-full object-cover transition-transform ${isActive ? "scale-110 ring-1.5 ring-primary" : ""
                                            }`}
                                    />
                                ) : (
                                    <div
                                        className={`flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[8px] font-bold text-primary transition-transform ${isActive ? "scale-110" : ""
                                            }`}
                                    >
                                        {initials}
                                    </div>
                                )
                            ) : tab.icon ? (
                                <tab.icon
                                    className={`h-5 w-5 transition-transform ${isActive ? "scale-110" : ""}`}
                                    strokeWidth={isActive ? 2.5 : 1.5}
                                />
                            ) : null}
                            {tab.label === "Vote" && pendingInviteCount > 0 && !isActive && (
                                <span className="absolute top-1.5 right-1/2 translate-x-4 h-2 w-2 rounded-full bg-danger animate-pulse" />
                            )}
                            {isProfile && pendingClanInviteCount > 0 && !isActive && (
                                <span className="absolute top-1.5 right-1/2 translate-x-4 h-2 w-2 rounded-full bg-danger animate-pulse" />
                            )}
                            <span className={`max-w-[64px] truncate ${isActive ? "font-semibold" : "font-normal"}`}>
                                {isProfile ? profileLabel : tab.label}
                            </span>
                            {isActive && (
                                <div className="absolute top-0 h-0.5 w-8 rounded-full game-nav-active-bar" />
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
