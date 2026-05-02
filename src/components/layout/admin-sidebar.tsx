"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    BarChart3,
    Users,
    Vote,
    Settings,
    Swords,
    DollarSign,
    Shield,
    Gamepad2,
    BookOpen,
    Briefcase,
    Crown,
    Loader2,
    ChevronDown,
    Eye,
    Clover,
    Star,
    ImageIcon,
    Scale,
    HelpCircle,
    MapPin,
    UserX,
} from "lucide-react";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useState, useEffect, useCallback } from "react";
import { PubgmiLogo } from "@/components/common/pubgmi-logo";
import { GAME } from "@/lib/game-config";

interface SidebarItem {
    label: string;
    href: string;
    icon: typeof BarChart3;
    superAdminOnly?: boolean;
    /** If set, only show when this feature is enabled in GAME.features */
    feature?: keyof typeof GAME.features;
}

interface SidebarSection {
    section: string;
    superAdminOnly?: boolean;
    items: SidebarItem[];
}

const sidebarItems: SidebarSection[] = [
    {
        section: "Tournament",
        items: [
            { label: "Dashboard", href: "/dashboard", icon: BarChart3 },
            { label: "Teams", href: "/dashboard/teams", icon: Swords, feature: "hasTeamSizes" },
            { label: "Players", href: "/dashboard/players", icon: Users, superAdminOnly: true },
            { label: GAME.clanLabel + "s", href: "/dashboard/clan", icon: Shield },
            { label: "Polls", href: "/dashboard/polls", icon: Vote },
            { label: "Operations", href: "/dashboard/operations", icon: Settings },
        ],
    },
    {
        section: "Platform",
        items: [
            { label: "Games", href: "/dashboard/games", icon: Gamepad2 },
            { label: "Job Listings", href: "/dashboard/job-listings", icon: Briefcase },
            { label: "Merit", href: "/dashboard/merit", icon: Star, superAdminOnly: true, feature: "hasMerit" },
            { label: "Rules", href: "/dashboard/rules", icon: BookOpen },
            { label: "Gallery", href: "/dashboard/gallery", icon: ImageIcon },
            ...(GAME.mode === "mlbb" ? [{ label: "Help Contacts", href: "/dashboard/help", icon: HelpCircle }] : []),
        ],
    },
    {
        section: "Insights",
        superAdminOnly: true,
        items: [
            { label: "Player Insights", href: "/dashboard/player-insights", icon: Eye },
            { label: GAME.passName, href: "/dashboard/royal-pass", icon: Crown, feature: "hasRoyalPass" },
            { label: "Referrals", href: "/dashboard/refer", icon: Users, superAdminOnly: true, feature: "hasReferrals" },
            { label: "Lucky Voters", href: "/dashboard/lucky-voters", icon: Clover, feature: "hasLuckyVoters" },
            { label: "Income", href: "/dashboard/income", icon: DollarSign },
        ],
    },
    {
        section: "Admin",
        items: [
            { label: "Locations", href: "/dashboard/locations", icon: MapPin, superAdminOnly: true },
            { label: "Duplicates", href: "/dashboard/duplicates", icon: UserX, superAdminOnly: true },
            { label: "Settlement", href: "/dashboard/settlement", icon: Scale, superAdminOnly: true },
            { label: "Admins", href: "/dashboard/admins", icon: Shield, superAdminOnly: true },
            { label: "Settings", href: "/dashboard/settings", icon: Settings, superAdminOnly: true },
        ],
    },
];

export { sidebarItems };

export function AdminSidebar() {
    const pathname = usePathname();
    const { isSuperAdmin } = useAuthUser();
    const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

    // Filter sections and items by permission + feature flags
    const filteredSections = sidebarItems
        .filter((section) => !section.superAdminOnly || isSuperAdmin)
        .map((section) => ({
            ...section,
            items: section.items.filter((item) => {
                if (item.superAdminOnly && !isSuperAdmin) return false;
                if (item.feature && !GAME.features[item.feature]) return false;
                return true;
            }),
        }))
        .filter((section) => section.items.length > 0);

    // Check if a section contains the active page
    const sectionHasActive = useCallback((section: SidebarSection) => {
        return section.items.some(
            (item) =>
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href))
        );
    }, [pathname]);

    // Initialize collapsed state — expand sections with active items
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        for (const section of sidebarItems) {
            initial[section.section] = !sectionHasActive(section);
        }
        return initial;
    });

    // Clear loading when pathname changes (navigation complete)
    useEffect(() => {
        setNavigatingTo(null);
    }, [pathname]);

    // Auto-expand section when navigating to it
    useEffect(() => {
        for (const section of filteredSections) {
            if (sectionHasActive(section) && collapsed[section.section]) {
                setCollapsed((prev) => ({ ...prev, [section.section]: false }));
            }
        }
    }, [pathname]);

    const toggleSection = (sectionName: string) => {
        setCollapsed((prev) => ({ ...prev, [sectionName]: !prev[sectionName] }));
    };

    return (
        <aside className="hidden w-64 shrink-0 border-r border-divider bg-background/50 lg:block sticky top-0 h-dvh">
            <div className="flex h-full flex-col">
                {/* Logo */}
                <div className="flex h-14 items-center gap-2 border-b border-divider px-4">
                    <Swords className="h-6 w-6 text-primary" />
                    <PubgmiLogo variant="header" className="text-lg" />
                    <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        Admin
                    </span>
                </div>

                {/* Nav sections */}
                <nav className="flex-1 space-y-1 overflow-y-auto p-4">
                    {filteredSections.map((section) => {
                        const isCollapsed = collapsed[section.section] ?? false;
                        const hasActive = sectionHasActive(section);

                        return (
                            <div key={section.section}>
                                <button
                                    onClick={() => toggleSection(section.section)}
                                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 mb-1 transition-colors hover:bg-default-100 ${hasActive ? "text-foreground/60" : "text-foreground/40"
                                        }`}
                                >
                                    <span className="text-[11px] font-semibold uppercase tracking-wider">
                                        {section.section}
                                    </span>
                                    <ChevronDown
                                        className={`h-3 w-3 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""
                                            }`}
                                    />
                                </button>
                                <div
                                    className={`overflow-hidden transition-all duration-200 ${isCollapsed ? "max-h-0 opacity-0" : "max-h-96 opacity-100"
                                        }`}
                                >
                                    <ul className="space-y-0.5 pb-3">
                                        {section.items.map((item) => {
                                            const isActive =
                                                pathname === item.href ||
                                                (item.href !== "/dashboard" &&
                                                    pathname.startsWith(item.href));
                                            const isLoading = navigatingTo === item.href && !isActive;
                                            return (
                                                <li key={item.href}>
                                                    <Link
                                                        href={item.href}
                                                        onClick={() => {
                                                            if (!isActive) setNavigatingTo(item.href);
                                                        }}
                                                        className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-all ${isActive
                                                            ? "bg-primary/10 font-medium text-primary"
                                                            : "text-foreground/60 hover:bg-default-100 hover:text-foreground"
                                                            }`}
                                                    >
                                                        {isLoading ? (
                                                            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                                                        ) : (
                                                            <item.icon className="h-4 w-4 shrink-0" />
                                                        )}
                                                        {item.label}
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            </div>
                        );
                    })}
                </nav>
            </div>
        </aside>
    );
}

