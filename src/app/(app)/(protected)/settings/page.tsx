"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, Divider, Chip } from "@heroui/react";
import {
    Settings,
    Globe,
    Bell,
    Palette,
    Info,
    LogOut,
    ChevronRight,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { motion } from "motion/react";
import Link from "next/link";
import { GAME } from "@/lib/game-config";
import { usePushStatus } from "@/components/common/push-prompt";
import { useColorTheme, type ColorTheme } from "@/components/common/color-theme-provider";

const COLOR_THEMES: { value: ColorTheme; label: string; gradient: string }[] = [
    { value: "default", label: "Default", gradient: "linear-gradient(135deg, #888, #444)" },
    { value: "gold", label: "Gold", gradient: "linear-gradient(135deg, #F2AA00, #8B6914)" },
    { value: "fire", label: "Fire", gradient: "linear-gradient(135deg, #FF6B00, #DC2626)" },
    { value: "blue", label: "Blue", gradient: "linear-gradient(135deg, #2563EB, #1D4ED8)" },
    { value: "cyan", label: "Cyan", gradient: "linear-gradient(135deg, #06B6D4, #0891B2)" },
];

import { useLocale, type AppLocale } from "@/components/common/locale-provider";

const LANGUAGES: { value: AppLocale; label: string }[] = [
    { value: "en", label: "English" },
    { value: "kha", label: "Khasi" },
];

/**
 * /settings — App settings page.
 * Responsive for both mobile and desktop.
 */
export default function SettingsPage() {

    const { theme, setTheme } = useTheme();
    const { colorTheme, setColorTheme } = useColorTheme();
    const { locale, setLocale } = useLocale();
    const [mounted, setMounted] = useState(false);
    const [langOpen, setLangOpen] = useState(false);
    useEffect(() => setMounted(true), []);
    const { status: pushStatus, subscribing, handleEnable } = usePushStatus();

    const currentLang = LANGUAGES.find((l) => l.value === locale) || LANGUAGES[0];

    return (
        <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 pb-24 sm:pb-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Settings className="h-6 w-6 text-foreground/70" />
                <h1 className="text-xl font-bold">Settings</h1>
            </div>

            {/* Language */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
            >
                <Card className="border border-divider">
                    <CardBody className="p-0">
                        <button
                            className="flex w-full items-center justify-between p-4"
                            onClick={() => setLangOpen(!langOpen)}
                        >
                            <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4 text-blue-500" />
                                <span className="text-sm font-semibold">Language</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Chip size="sm" variant="flat" color="primary">
                                    {currentLang.label}
                                </Chip>
                                <motion.div
                                    animate={{ rotate: langOpen ? 90 : 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <ChevronRight className="h-4 w-4 text-foreground/30" />
                                </motion.div>
                            </div>
                        </button>
                        {langOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden border-t border-divider"
                            >
                                {LANGUAGES.map((lang) => (
                                    <button
                                        key={lang.value}
                                        onClick={() => {
                                            setLocale(lang.value);
                                            setLangOpen(false);
                                        }}
                                        className={`flex w-full items-center justify-between px-4 py-3 transition-colors ${
                                            locale === lang.value
                                                ? "bg-primary/5"
                                                : "hover:bg-default-50"
                                        }`}
                                    >
                                        <span className={`text-sm ${locale === lang.value ? "font-semibold text-primary" : "text-foreground/70"}`}>
                                            {lang.label}
                                        </span>
                                        {locale === lang.value && (
                                            <span className="text-xs text-primary">✓</span>
                                        )}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </CardBody>
                </Card>
            </motion.div>

            {/* Notifications */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
            >
                <Card className="border border-divider">
                    <CardBody className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Bell className={`h-4 w-4 ${pushStatus === "enabled" ? "text-success" : pushStatus === "denied" ? "text-foreground/30" : "text-orange-500"}`} />
                                <span className="text-sm font-semibold">Push Notifications</span>
                            </div>
                            {pushStatus === "loading" || pushStatus === "unsupported" ? (
                                <Chip size="sm" variant="flat" color="default">—</Chip>
                            ) : pushStatus === "enabled" ? (
                                <Chip size="sm" variant="flat" color="success">Enabled</Chip>
                            ) : pushStatus === "denied" ? (
                                <Chip size="sm" variant="flat" color="danger">Blocked</Chip>
                            ) : (
                                <button
                                    onClick={handleEnable}
                                    disabled={subscribing}
                                    className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {subscribing && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                                    Enable
                                </button>
                            )}
                        </div>
                        <p className="mt-1.5 text-xs text-foreground/40">
                            {pushStatus === "enabled"
                                ? "You'll receive alerts for UC requests, squad invites, and rewards"
                                : pushStatus === "denied"
                                ? "Notifications are blocked — enable in your browser settings"
                                : `Get notified about ${GAME.currency} requests, squad invites & rewards`}
                        </p>
                    </CardBody>
                </Card>
            </motion.div>

            {/* Theme */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <Card className="border border-divider">
                    <CardBody className="p-4 space-y-4">
                        {/* Light / Dark / System */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Palette className="h-4 w-4 text-purple-500" />
                                <span className="text-sm font-semibold">Appearance</span>
                            </div>
                            <div className="flex gap-2">
                                {(["light", "dark", "system"] as const).map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setTheme(t)}
                                        className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-colors ${mounted && theme === t
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-divider bg-default-50 text-foreground/60 hover:bg-default-100"
                                            }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <Divider />

                        {/* Color Theme */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-semibold">Color Theme</span>
                                <span className="text-[10px] text-foreground/30">Tap to switch</span>
                            </div>
                            <div className="grid grid-cols-5 gap-2">
                                {COLOR_THEMES.map((ct) => (
                                    <button
                                        key={ct.value}
                                        onClick={() => setColorTheme(ct.value)}
                                        className={`relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all ${
                                            colorTheme === ct.value
                                                ? "border-foreground/60 shadow-md scale-[1.02]"
                                                : "border-divider hover:border-foreground/20"
                                        }`}
                                    >
                                        <div
                                            className="h-8 w-8 rounded-full shadow-inner"
                                            style={{ background: ct.gradient }}
                                        />
                                        <span className="text-[10px] font-medium text-foreground/60">{ct.label}</span>
                                        {colorTheme === ct.value && (
                                            <div className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-foreground flex items-center justify-center">
                                                <svg className="h-2.5 w-2.5 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </motion.div>

            {/* About */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
            >
                <Card className="border border-divider">
                    <CardBody className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Info className="h-4 w-4 text-foreground/50" />
                            <span className="text-sm font-semibold">About</span>
                        </div>
                        <div className="space-y-1.5 text-xs text-foreground/50">
                            <div className="flex justify-between">
                                <span>App</span>
                                <span className="font-medium text-foreground/70">{GAME.name}</span>
                            </div>
                            <Divider />
                            <div className="flex justify-between">
                                <span>Platform</span>
                                <span className="font-semibold text-primary">Bimon Tournament</span>
                            </div>
                            <Divider />
                            <div className="flex justify-between">
                                <span>Version</span>
                                <span className="font-medium text-foreground/70">v2 · {process.env.NEXT_PUBLIC_BUILD_DATE}</span>
                            </div>
                            <Divider />
                            <div className="flex justify-between">
                                <span>Developer</span>
                                <span className="font-medium text-foreground/70">Bimon</span>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </motion.div>

            {/* Sign Out */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
                >
                    <LogOut className="h-4 w-4" />
                    Sign out
                </button>
            </motion.div>
        </div>
    );
}
