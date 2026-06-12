"use client";

import {
    Navbar,
    NavbarBrand,
    NavbarContent,
    NavbarItem,
    NavbarMenu,
    NavbarMenuItem,
    NavbarMenuToggle,
    Popover,
    PopoverTrigger,
    PopoverContent,
} from "@heroui/react";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
    Swords,
    Users,
    Vote,
    Crown,
    Wallet,
    Gift,
    BarChart3,
    LogOut,
    User,
    Trophy,
    BookOpen,
    ChevronDown,
    Settings,
    Bell,
    Briefcase,
    Loader2,
    MessageCircle,
    HelpCircle,
    Youtube,
    Gamepad2,
    Share2,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useAuthUser } from "@/hooks/use-auth-user";
import { sidebarItems } from "./admin-sidebar";
import { PubgmiLogo } from "@/components/common/pubgmi-logo";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";
import { useSquadInviteCount } from "@/hooks/use-squad-invite-count";

const navItems = [
    { label: "Players", href: "/players", icon: Users },
    { label: "Vote", href: "/vote", icon: Vote },
    ...(GAME.features.hasBracket
        ? [{ label: "Matches", href: "/bracket", icon: Swords }]
        : []),
];

const moreItems = [
    { label: "Games", href: "/games", icon: Gamepad2 },
    { label: "Community", href: "/community", icon: MessageCircle },
    { label: "Winners", href: "/winners", icon: Trophy },
    { label: "Refer", href: "/refer", icon: Gift },
    { label: "Wallet", href: "/wallet", icon: Wallet },
    { label: "Notifications", href: "/notifications", icon: Bell },
    { label: "Rules", href: "/rules", icon: BookOpen },
];

const adminItems = [
    { label: "Dashboard", href: "/dashboard", icon: BarChart3 },
];

export function Header() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
    const pathname = usePathname();
    const isDashboard = pathname.startsWith("/dashboard");
    const router = useRouter();
    const { isAdmin, isSuperAdmin, isSignedIn, balance } = useAuthUser();
    const { data: session } = useSession();
    const user = session?.user;
    const pendingInviteCount = useSquadInviteCount();

    // Check if a section contains the active page
    const sectionHasActive = useCallback((section: typeof sidebarItems[0]) => {
        return section.items.some(
            (item) =>
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href))
        );
    }, [pathname]);

    // Collapsed state for mobile menu sections
    const [mobileCollapsed, setMobileCollapsed] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        for (const section of sidebarItems) {
            initial[section.section] = !sectionHasActive(section);
        }
        return initial;
    });

    // Defaults for public menu sections (Connect/Account start collapsed)
    const publicDefaults: Record<string, boolean> = { Play: false, Connect: true, Account: true };

    const toggleMobileSection = (sectionName: string) => {
        setMobileCollapsed((prev) => {
            const current = prev[sectionName] ?? publicDefaults[sectionName] ?? false;
            return { ...prev, [sectionName]: !current };
        });
    };

    // Clear loading spinner and close menu when pathname changes
    useEffect(() => {
        setNavigatingTo(null);
        setIsMenuOpen(false);
    }, [pathname]);

    // Auto-expand mobile section when navigating to it
    useEffect(() => {
        for (const section of sidebarItems) {
            if (sectionHasActive(section) && mobileCollapsed[section.section]) {
                setMobileCollapsed((prev) => ({ ...prev, [section.section]: false }));
            }
        }
    }, [pathname]);

    const { data: notifData } = useQuery({
        queryKey: ["notification-count"],
        queryFn: async () => {
            const res = await fetch("/api/notifications");
            if (!res.ok) return { unreadCount: 0, unclaimedRewardCount: 0 };
            const json = await res.json();
            return {
                unreadCount: json.data?.unreadCount ?? 0,
                unclaimedRewardCount: json.data?.unclaimedRewards?.length ?? 0,
                hasUnclaimedStreak: json.data?.hasUnclaimedStreakReward ?? false,
                pendingSquadInviteCount: json.data?.pendingSquadInviteCount ?? 0, // shared with useSquadInviteCount
            };
        },
        enabled: isSignedIn,
        staleTime: Infinity,
    });
    const unreadCount = notifData?.unreadCount ?? 0;
    const unclaimedRewardCount = notifData?.unclaimedRewardCount ?? 0;
    const hasUnclaimedStreak = notifData?.hasUnclaimedStreak ?? false;

    // Fetch unreviewed duplicate alerts count (admins only)
    const { data: dupData } = useQuery({
        queryKey: ["duplicate-count"],
        queryFn: async () => {
            const res = await fetch("/api/dashboard/duplicates/count");
            if (!res.ok) return { count: 0 };
            const json = await res.json();
            return json.data as { count: number };
        },
        enabled: isSignedIn && isAdmin,
        staleTime: 5 * 60 * 1000, // 5 min
    });
    const duplicateCount = dupData?.count ?? 0;

    // Red dot on hamburger shows for ALL actionable items
    const totalActionCount = unreadCount + unclaimedRewardCount + (isAdmin ? duplicateCount : 0);
    // Badge on "Notifications" label only shows notification-related counts
    const notifActionCount = unreadCount + unclaimedRewardCount;

    // Fetch runtime settings (enableElitePass toggle from dashboard)
    const { data: publicSettings } = useQuery({
        queryKey: ["public-settings"],
        queryFn: async () => {
            const res = await fetch("/api/settings/public");
            if (!res.ok) return { enableElitePass: true };
            const json = await res.json();
            return json.data ?? { enableElitePass: true };
        },
        staleTime: 5 * 60 * 1000,
    });
    const showRoyalPass = GAME.features.hasRoyalPass && (publicSettings?.enableElitePass !== false);
    const showReferrals = publicSettings?.enableReferrals !== false;
    const youtubeUrl = publicSettings?.youtubeChannelUrl || "";
    const whatsappUrl = (publicSettings?.whatsAppGroups || [])[0] || "";


    const handleSignOut = async () => {
        await signOut({ callbackUrl: "/" });
    };

    const initials = user?.name?.[0]?.toUpperCase() || "?";

    return (
        <>
            {/* Backdrop overlay — fades in/out smoothly */}
            <div
                className={`fixed inset-0 left-[280px] z-[39] bg-black/40 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${isMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                onClick={() => setIsMenuOpen(false)}
            />
            <Navbar
                isMenuOpen={isMenuOpen}
                onMenuOpenChange={setIsMenuOpen}
                maxWidth="xl"
                position="static"
                classNames={{
                    base: "!fixed !top-0 !left-0 !right-0 !z-40 backdrop-blur-xl border-b",
                    wrapper: "px-4 sm:px-6",
                    menu: `!fixed !top-[var(--navbar-height)] !h-[calc(100dvh-var(--navbar-height))] !w-[280px] !max-w-[280px] border-r shadow-xl !backdrop-blur-xl !backdrop-saturate-150 !overflow-y-auto transition-transform duration-300 ease-out ${isMenuOpen ? "!translate-x-0" : "!-translate-x-full"
                        }`,
                    toggle: "w-10 h-10",
                }}
                isBordered
            >
                {/* Logo */}
                <NavbarContent justify="start">
                    <div className="relative lg:hidden">
                        <NavbarMenuToggle aria-label={isMenuOpen ? "Close menu" : "Open menu"} />
                        {totalActionCount > 0 && (
                            <span className="absolute right-0 top-0 z-10 h-2 w-2 rounded-full bg-danger pointer-events-none" />
                        )}
                    </div>
                    <NavbarBrand>
                        <PubgmiLogo variant="header" className="text-lg game-text" />
                    </NavbarBrand>
                </NavbarContent>


                {/* Desktop Nav */}
                <NavbarContent className="hidden gap-3 lg:flex" justify="center">
                    {navItems.map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        return (
                            <NavbarItem key={item.href} isActive={isActive}>
                                <Link
                                    href={item.href}
                                    onClick={() => {
                                        if (!isActive) setNavigatingTo(item.href);
                                    }}
                                    className={`flex items-center gap-1.5 text-sm transition-colors ${isActive
                                        ? "font-semibold"
                                        : "text-foreground/70 hover:text-foreground"
                                        }`}
                                    style={isActive ? { color: 'var(--game-primary)' } : undefined}
                                >
                                    {navigatingTo === item.href && !isActive ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <item.icon className="h-4 w-4" />
                                    )}
                                    {item.label === "Wallet" ? (
                                        <span className={
                                            (balance ?? 0) > 0 ? "text-success" : (balance ?? 0) < 0 ? "text-danger" : ""
                                        }>{(balance ?? 0).toLocaleString()} <CurrencyIcon size={14} /></span>
                                    ) : item.label}
                                    {item.label === "Vote" && pendingInviteCount > 0 && (
                                        <span className="h-2 w-2 rounded-full bg-danger animate-pulse" />
                                    )}
                                </Link>
                            </NavbarItem>
                        );
                    })}
                    {isAdmin &&
                        adminItems.map((item) => {
                            const isActive = pathname.startsWith(item.href);
                            return (
                                <NavbarItem key={item.href} isActive={isActive}>
                                    <Link
                                        href={item.href}
                                        onClick={() => {
                                            if (!isActive) setNavigatingTo(item.href);
                                        }}
                                        className={`flex items-center gap-1.5 text-sm transition-colors ${isActive
                                            ? "font-semibold"
                                            : "text-foreground/70 hover:text-foreground"
                                            }`}
                                        style={isActive ? { color: 'var(--game-primary)' } : undefined}
                                    >
                                        {navigatingTo === item.href && !isActive ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <item.icon className="h-4 w-4" />
                                        )}
                                        {item.label}
                                        {item.label === "Dashboard" && duplicateCount > 0 && (
                                            <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                                                {duplicateCount}
                                            </span>
                                        )}
                                    </Link>
                                </NavbarItem>
                            );
                        })}

                    {/* More dropdown */}
                    <NavbarItem>
                        <Popover placement="bottom" showArrow offset={12}>
                            <PopoverTrigger>
                                <button
                                    className={`relative flex items-center gap-1 text-sm transition-colors ${[...moreItems.map(i => i.href), "/settings"].some((h) => pathname.startsWith(h))
                                        ? "font-semibold game-text"
                                        : "text-foreground/70 hover:text-foreground"
                                        }`}
                                >
                                    More
                                    <ChevronDown className="h-3.5 w-3.5" />
                                    {totalActionCount > 0 && (
                                        <span className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-danger" />
                                    )}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-44 p-1">
                                {moreItems
                                .filter(item => item.label !== "Refer" || showReferrals || isAdmin)
                                .map((item) => {
                                    const isActive = pathname.startsWith(item.href);
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${isActive
                                                ? "game-menu-active-medium"
                                                : "text-foreground/70 hover:bg-default-100 hover:text-foreground"
                                                }`}
                                        >
                                            <item.icon className="h-4 w-4" />
                                            {item.label}
                                            {item.label === "Notifications" && notifActionCount > 0 && (
                                                <span className="ml-auto rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                                                    {notifActionCount}
                                                </span>
                                            )}
                                        </Link>
                                    );
                                })}
                                <div className="my-1 border-t border-divider" />
                                <Link
                                    href="/settings"
                                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${pathname.startsWith("/settings")
                                        ? "game-menu-active-medium"
                                        : "text-foreground/70 hover:bg-default-100 hover:text-foreground"
                                        }`}
                                >
                                    <Settings className="h-4 w-4" />
                                    Settings
                                </Link>
                                {(youtubeUrl || whatsappUrl) && (
                                    <>
                                        <div className="my-1 border-t border-divider" />
                                        <Link
                                            href="/socials"
                                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground/70 hover:bg-default-100 transition-colors"
                                        >
                                            <Share2 className="h-4 w-4" />
                                            Socials
                                        </Link>
                                    </>
                                )}
                            </PopoverContent>
                        </Popover>
                    </NavbarItem>
                </NavbarContent>

                {/* Right section */}
                <NavbarContent justify="end">
                    {isSignedIn && (
                        <>
                            {showRoyalPass && (
                                <NavbarItem>
                                    <Link
                                        href="/royal-pass"
                                        onClick={() => {
                                            if (!pathname.startsWith("/royal-pass")) setNavigatingTo("/royal-pass");
                                        }}
                                        className="relative flex items-center justify-center rounded-full p-1.5 transition-opacity hover:opacity-80"
                                        style={{ color: 'var(--game-accent, #eab308)' }}
                                    >
                                        {navigatingTo === "/royal-pass" && !pathname.startsWith("/royal-pass") ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <Crown className="h-5 w-5" />
                                        )}
                                        {hasUnclaimedStreak && (
                                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 ring-2 ring-background animate-pulse">
                                                <Gift className="h-2.5 w-2.5 text-white" />
                                            </span>
                                        )}
                                    </Link>
                                </NavbarItem>
                            )}
                            <NavbarItem className="hidden lg:flex">
                                <Link href="/profile" className="block">
                                    {user?.image ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={user.image}
                                            alt={user.name || "avatar"}
                                            className="h-8 w-8 rounded-full object-cover ring-2 ring-primary/20 transition-all hover:ring-primary/40"
                                        />
                                    ) : (
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-2 ring-primary/20">
                                            {initials}
                                        </div>
                                    )}
                                </Link>
                            </NavbarItem>
                        </>
                    )}
                </NavbarContent>

                {/* Mobile menu */}
                <NavbarMenu className="pt-4">
                    {pathname.startsWith("/dashboard") ? (
                        /* Admin dashboard view — collapsible sidebar items */
                        <>
                            {sidebarItems
                                .filter((section) => !section.superAdminOnly || isSuperAdmin)
                                .map((section) => ({
                                    ...section,
                                    items: section.items.filter((item) => !item.superAdminOnly || isSuperAdmin),
                                }))
                                .filter((section) => section.items.length > 0)
                                .map((section) => {
                                    const isCollapsed = mobileCollapsed[section.section] ?? false;
                                    return (
                                        <NavbarMenuItem key={section.section}>
                                            <button
                                                onClick={() => toggleMobileSection(section.section)}
                                                className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 mt-2 mb-1 transition-colors hover:bg-default-100 ${sectionHasActive(section) ? "text-foreground/60" : "text-foreground/40"
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
                                                {section.items.map((item) => {
                                                    const isActive =
                                                        pathname === item.href ||
                                                        (item.href !== "/dashboard" && pathname.startsWith(item.href));
                                                    return (
                                                        <Link
                                                            key={item.href}
                                                            href={item.href}
                                                            onClick={() => {
                                                                if (!isActive) setNavigatingTo(item.href);
                                                                else setIsMenuOpen(false);
                                                            }}
                                                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isActive
                                                                ? "game-menu-active"
                                                                : "text-foreground/70 hover:bg-default-100"
                                                                }`}
                                                        >
                                                            {navigatingTo === item.href && !isActive ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <item.icon className="h-4 w-4" />
                                                            )}
                                                            {item.label}
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        </NavbarMenuItem>
                                    );
                                })}
                            {/* Quick link back to main app */}
                            <NavbarMenuItem>
                                <div className="mt-3 border-t border-divider pt-3">
                                    <Link
                                        href="/players"
                                        onClick={() => setIsMenuOpen(false)}
                                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground/50 hover:bg-default-100"
                                    >
                                        ← Back to App
                                    </Link>
                                </div>
                            </NavbarMenuItem>
                        </>
                    ) : (
                        /* Regular app view — grouped sections */
                        <>
                            {[
                                {
                                    section: "Play",
                                    items: [
                                        { label: "Games", href: "/games", icon: Gamepad2 },
                                        { label: "Winners", href: "/winners", icon: Trophy },
                                    ],
                                    defaultCollapsed: false,
                                },
                                {
                                    section: "Connect",
                                    items: [
                                        { label: "Community", href: "/community", icon: MessageCircle },
                                        ...(showReferrals || isAdmin ? [{ label: "Refer", href: "/refer", icon: Gift }] : []),
                                        ...((youtubeUrl || whatsappUrl) ? [{ label: "Socials", href: "/socials", icon: Share2 }] : []),
                                        ...(GAME.mode === "mlbb" ? [{ label: "Help", href: "/help", icon: HelpCircle }] : []),
                                    ],
                                    defaultCollapsed: true,
                                },
                                {
                                    section: "Account",
                                    items: [
                                        { label: "Wallet", href: "/wallet", icon: Wallet },
                                        { label: "Notifications", href: "/notifications", icon: Bell },
                                        { label: "Rules", href: "/rules", icon: BookOpen },
                                    ],
                                    defaultCollapsed: true,
                                },
                            ].map((group) => {
                                const isCollapsed = mobileCollapsed[group.section] ?? group.defaultCollapsed;
                                const hasActive = group.items.some((item) => pathname.startsWith(item.href));
                                return (
                                    <NavbarMenuItem key={group.section}>
                                        <button
                                            onClick={() => toggleMobileSection(group.section)}
                                            className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 mt-2 mb-1 transition-colors hover:bg-default-100 ${hasActive ? "text-foreground/60" : "text-foreground/40"}`}
                                        >
                                            <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                                {group.section}
                                                {group.section === "Account" && notifActionCount > 0 && (
                                                    <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
                                                )}
                                            </span>
                                            <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`} />
                                        </button>
                                        <div className={`overflow-hidden transition-all duration-200 ${isCollapsed ? "max-h-0 opacity-0" : "max-h-96 opacity-100"}`}>
                                            {group.items.map((item) => {
                                                const isActive = pathname.startsWith(item.href);
                                                return (
                                                    <Link
                                                        key={item.href}
                                                        href={item.href}
                                                        onClick={() => { if (!isActive) setNavigatingTo(item.href); else setIsMenuOpen(false); }}
                                                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? "game-menu-active" : "text-foreground/70 hover:bg-default-100"}`}
                                                    >
                                                        {navigatingTo === item.href && !isActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <item.icon className="h-4 w-4" />}
                                                        {item.label}
                                                        {item.label === "Wallet" && balance != null && (
                                                            <span className={`ml-auto text-xs font-bold ${balance > 0 ? "text-success" : balance < 0 ? "text-danger" : "text-foreground/50"}`}>
                                                                {balance.toLocaleString()} <CurrencyIcon size={10} />
                                                            </span>
                                                        )}
                                                        {item.label === "Notifications" && notifActionCount > 0 && (
                                                            <span className="ml-auto rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                                                                {notifActionCount}
                                                            </span>
                                                        )}
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </NavbarMenuItem>
                                );
                            })}


                            {/* Admin Dashboard link with duplicate alert badge */}
                            {isAdmin && (
                                <NavbarMenuItem>
                                    <div className="mt-1 border-t border-divider pt-2">
                                        <Link
                                            href="/dashboard"
                                            onClick={() => {
                                                if (!pathname.startsWith("/dashboard")) setNavigatingTo("/dashboard");
                                                else setIsMenuOpen(false);
                                            }}
                                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-base transition-colors ${pathname.startsWith("/dashboard")
                                                ? "game-menu-active"
                                                : "text-foreground/70 hover:bg-default-100"
                                                }`}
                                        >
                                            {navigatingTo === "/dashboard" && !pathname.startsWith("/dashboard") ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            ) : (
                                                <BarChart3 className="h-5 w-5" />
                                            )}
                                            Dashboard
                                            {duplicateCount > 0 && (
                                                <span className="ml-auto rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                                                    {duplicateCount}
                                                </span>
                                            )}
                                        </Link>
                                    </div>
                                </NavbarMenuItem>
                            )}
                        </>
                    )}

                    {/* Settings — hide on dashboard since admin sidebar has its own */}
                    {isSignedIn && !isDashboard ? (
                        <>
                            <NavbarMenuItem>
                                <div className="mt-1 border-t border-divider pt-2">
                                    <Link
                                        href="/settings"
                                        onClick={() => {
                                            if (!pathname.startsWith("/settings")) setNavigatingTo("/settings");
                                            else setIsMenuOpen(false);
                                        }}
                                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-base transition-colors ${pathname.startsWith("/settings")
                                            ? "game-menu-active"
                                            : "text-foreground/70 hover:bg-default-100"
                                            }`}
                                    >
                                        {navigatingTo === "/settings" && !pathname.startsWith("/settings") ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <Settings className="h-5 w-5" />
                                        )}
                                        Settings
                                    </Link>
                                </div>
                            </NavbarMenuItem>
                        </>
                    ) : !isSignedIn ? (
                        <NavbarMenuItem>
                            <div className="mt-3 border-t border-divider pt-3">
                                <Link
                                    href="/sign-in"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-primary transition-colors hover:bg-primary/10"
                                >
                                    <LogOut className="h-5 w-5 rotate-180" />
                                    Sign in
                                </Link>
                            </div>
                        </NavbarMenuItem>
                    ) : null}
                </NavbarMenu>
            </Navbar>
        </>
    );
}
