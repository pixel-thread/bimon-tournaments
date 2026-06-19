"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, Divider, Chip, Avatar, Button, Input } from "@heroui/react";
import {
    Settings,
    Globe,
    Bell,
    Palette,
    Info,
    LogOut,
    ChevronRight,
    Users,
    X,
    MapPin,
    Mail,
    Plus,
    ArrowRightLeft,
    Link2,
    Unlink,
    Phone,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { GAME } from "@/lib/game-config";
import { usePushStatus } from "@/components/common/push-prompt";
import { useColorTheme, type ColorTheme } from "@/components/common/color-theme-provider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LocationModal } from "@/components/common/location-modal";
import { useDiscordCompareModal } from "@/components/common/discord-compare-modal";

import { useLocale, type AppLocale } from "@/components/common/locale-provider";

const COLOR_THEMES: { value: ColorTheme; label: string; gradient: string }[] = [
    { value: "default", label: "Default", gradient: "linear-gradient(135deg, #888, #444)" },
    { value: "gold", label: "Gold", gradient: "linear-gradient(135deg, #F2AA00, #8B6914)" },
    { value: "fire", label: "Fire", gradient: "linear-gradient(135deg, #FF6B00, #DC2626)" },
    { value: "blue", label: "Blue", gradient: "linear-gradient(135deg, #2563EB, #1D4ED8)" },
    { value: "cyan", label: "Cyan", gradient: "linear-gradient(135deg, #06B6D4, #0891B2)" },
];

const LANGUAGES: { value: AppLocale; label: string }[] = [
    { value: "en", label: "English" },
    { value: "kha", label: "Khasi" },
];

interface ProfileData {
    email: string;
    secondaryEmail: string | null;
    player: {
        id: string;
        uid: string | null;
        phoneNumber: string | null;
        state: string | null;
        district: string | null;
        town: string | null;
        discord: { id: string; username: string | null } | null;
    } | null;
}

/**
 * /settings — App settings & account page.
 * Contains appearance, notifications, account info (UID, phone, location,
 * Discord, emails), squad subscriptions, and sign-out.
 */
export default function SettingsPage() {

    const { theme, setTheme } = useTheme();
    const { colorTheme, setColorTheme } = useColorTheme();
    const { locale, setLocale } = useLocale();
    const { update: updateSession } = useSession();
    const [mounted, setMounted] = useState(false);
    const [langOpen, setLangOpen] = useState(false);
    useEffect(() => setMounted(true), []);
    const { status: pushStatus, subscribing, handleEnable } = usePushStatus();
    const queryClient = useQueryClient();
    const { openDiscordModal, DiscordCompareModal } = useDiscordCompareModal();

    // ─── Profile data (for account section) ─────────────────────
    const { data: profile } = useQuery<ProfileData>({
        queryKey: ["profile"],
        queryFn: async () => {
            const res = await fetch("/api/profile");
            if (!res.ok) throw new Error("Failed");
            const json = await res.json();
            return json.data;
        },
        staleTime: 60_000,
    });
    const player = profile?.player;

    // ─── UID editing ────────────────────────────────────────────
    const [editingUID, setEditingUID] = useState(false);
    const [newUID, setNewUID] = useState("");
    const [savingUID, setSavingUID] = useState(false);

    const handleSaveUID = async () => {
        setSavingUID(true);
        try {
            const res = await fetch("/api/profile/update-ign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uid: newUID.trim() }),
            });
            if (res.ok) {
                toast.success("UID updated!");
                setEditingUID(false);
                queryClient.invalidateQueries({ queryKey: ["profile"] });
            } else {
                const json = await res.json();
                toast.error(json.message || "Failed to update");
            }
        } catch { toast.error("Network error"); }
        finally { setSavingUID(false); }
    };

    // ─── Phone editing ──────────────────────────────────────────
    const [editingPhone, setEditingPhone] = useState(false);
    const [newPhone, setNewPhone] = useState("");
    const [savingPhone, setSavingPhone] = useState(false);

    const handleSavePhone = async () => {
        setSavingPhone(true);
        try {
            const res = await fetch("/api/profile/update-ign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phoneNumber: newPhone.trim() }),
            });
            if (res.ok) {
                toast.success("Phone updated!");
                setEditingPhone(false);
                queryClient.invalidateQueries({ queryKey: ["profile"] });
            } else {
                const json = await res.json();
                toast.error(json.message || "Failed to update");
            }
        } catch { toast.error("Network error"); }
        finally { setSavingPhone(false); }
    };

    // ─── Location ───────────────────────────────────────────────
    const [showLocationModal, setShowLocationModal] = useState(false);

    // ─── Discord ────────────────────────────────────────────────
    const [discordUnlinking, setDiscordUnlinking] = useState(false);
    const [showDiscordUnlinkConfirm, setShowDiscordUnlinkConfirm] = useState(false);

    // Handle Discord OAuth callback via URL params
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const discordResult = params.get("discord");
        if (!discordResult) return;
        const url = new URL(window.location.href);
        url.searchParams.delete("discord");
        window.history.replaceState({}, "", url.toString());
        switch (discordResult) {
            case "linked": toast.success("Discord linked successfully!"); sessionStorage.setItem("discord_linked", "true"); queryClient.invalidateQueries({ queryKey: ["profile"] }); break;
            case "denied": toast.error("Discord authorization was denied"); break;
            case "already_linked": toast.error("This Discord account is already linked to another player"); break;
            case "not_in_server": toast.error("You must join our Discord server first!"); break;
            case "error": toast.error("Failed to link Discord — please try again"); break;
        }
    }, []);

    // ─── Emails ─────────────────────────────────────────────────
    const [showEmailInput, setShowEmailInput] = useState(false);
    const [newSecondaryEmail, setNewSecondaryEmail] = useState("");
    const [emailSaving, setEmailSaving] = useState(false);
    const [emailError, setEmailError] = useState("");
    const [showSignOutModal, setShowSignOutModal] = useState(false);

    // ─── Squad auto-accept subscriptions ────────────────────────
    interface SubItem { captainId: string; displayName: string; imageUrl: string | null }
    const { data: subs } = useQuery<SubItem[]>({
        queryKey: ["my-subscriptions"],
        queryFn: async () => {
            const res = await fetch("/api/squads/my-subscriptions");
            if (!res.ok) return [];
            const json = await res.json();
            return json.data ?? [];
        },
        staleTime: 60_000,
    });
    const [unsubbing, setUnsubbing] = useState<Set<string>>(new Set());
    const handleUnsub = async (captainId: string) => {
        setUnsubbing((prev) => new Set(prev).add(captainId));
        try {
            await fetch("/api/squads/auto-accept-player", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ captainId, enabled: false }),
            });
            queryClient.setQueryData<SubItem[]>(["my-subscriptions"], (old) =>
                old ? old.filter((s) => s.captainId !== captainId) : []
            );
            toast.success("Unsubscribed");
        } catch {
            toast.error("Failed to unsubscribe");
        } finally {
            setUnsubbing((prev) => {
                const next = new Set(prev);
                next.delete(captainId);
                return next;
            });
        }
    };

    const currentLang = LANGUAGES.find((l) => l.value === locale) || LANGUAGES[0];

    return (
        <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 pb-24 sm:pb-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Settings className="h-6 w-6 text-foreground/70" />
                <h1 className="text-xl font-bold">Settings</h1>
            </div>

            {/* ═══════════════ ACCOUNT ═══════════════ */}
            {player && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                >
                    <Card className="border border-divider">
                        <CardBody className="p-4 space-y-0">
                            <div className="flex items-center gap-2 mb-3">
                                <Settings className="h-4 w-4 text-foreground/50" />
                                <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">Account</span>
                            </div>

                            {/* UID */}
                            {GAME.hasUID && (
                                <div className="py-2.5 border-b border-divider">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-[10px] text-foreground/40 uppercase">{GAME.idLabel}</p>
                                            {editingUID ? (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Input
                                                        value={newUID}
                                                        onChange={(e) => setNewUID(e.target.value)}
                                                        placeholder={GAME.idPlaceholder}
                                                        size="sm"
                                                        variant="bordered"
                                                        isDisabled={savingUID}
                                                        className="flex-1"
                                                        onPaste={(e) => {
                                                            e.preventDefault();
                                                            const pasted = e.clipboardData.getData("text").trim();
                                                            if (pasted) setNewUID(pasted);
                                                        }}
                                                    />
                                                    <Button size="sm" color="primary" isLoading={savingUID} onPress={handleSaveUID} isDisabled={!newUID.trim()}>Save</Button>
                                                    <Button size="sm" variant="flat" onPress={() => setEditingUID(false)} isDisabled={savingUID}>✕</Button>
                                                </div>
                                            ) : (
                                                <p className="text-sm font-mono">{player.uid || <span className="text-foreground/30 italic">Not set</span>}</p>
                                            )}
                                        </div>
                                        {!editingUID && (
                                            <Button size="sm" variant="light" className="text-xs shrink-0" onPress={() => { setNewUID(player.uid || ""); setEditingUID(true); }}>
                                                {player.uid ? "Change" : "Set"}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Phone */}
                            <div className="py-2.5 border-b border-divider">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] text-foreground/40 uppercase">Phone Number</p>
                                        {editingPhone ? (
                                            <div className="flex items-center gap-2 mt-1">
                                                <Input
                                                    value={newPhone}
                                                    onChange={(e) => setNewPhone(e.target.value)}
                                                    placeholder="e.g. +91 9876543210"
                                                    size="sm"
                                                    variant="bordered"
                                                    type="tel"
                                                    isDisabled={savingPhone}
                                                    className="flex-1"
                                                />
                                                <Button size="sm" color="primary" isLoading={savingPhone} onPress={handleSavePhone} isDisabled={!newPhone.trim()}>Save</Button>
                                                <Button size="sm" variant="flat" onPress={() => setEditingPhone(false)} isDisabled={savingPhone}>✕</Button>
                                            </div>
                                        ) : (
                                            <p className="text-sm font-mono">{player.phoneNumber || <span className="text-foreground/30 italic">Not set</span>}</p>
                                        )}
                                    </div>
                                    {!editingPhone && (
                                        <Button size="sm" variant="light" className="text-xs shrink-0" onPress={() => { setNewPhone(player.phoneNumber || ""); setEditingPhone(true); }}>
                                            {player.phoneNumber ? "Change" : "Set"}
                                        </Button>
                                    )}
                                </div>
                                <p className="text-[10px] text-foreground/30 mt-0.5">Used to send room info, prize delivery & contact</p>
                            </div>

                            {/* Location */}
                            <div className="py-2.5 border-b border-divider">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <MapPin className="h-3.5 w-3.5 text-foreground/40 shrink-0" />
                                        {player.state ? (
                                            <span className="text-sm text-foreground/60 truncate">
                                                {player.town}, {player.district}, {player.state}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-foreground/30 italic">Location not set</span>
                                        )}
                                    </div>
                                    <Button size="sm" variant="light" className="text-xs shrink-0" onPress={() => setShowLocationModal(true)}>
                                        {player.state ? "Change" : "Set"}
                                    </Button>
                                </div>
                            </div>

                            {/* Discord */}
                            <div className="py-2.5 border-b border-divider">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <svg className="h-4 w-4 text-[#5865F2] shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
                                        {player.discord ? (
                                            <div className="min-w-0">
                                                <span className="text-sm font-medium truncate block">{player.discord.username}</span>
                                                <span className="text-[10px] text-foreground/30">Discord linked (optional)</span>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-foreground/30 italic">Discord not linked (optional)</span>
                                        )}
                                    </div>
                                    {player.discord ? (
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                                                ✓ Connected
                                            </span>
                                            <Button
                                                size="sm" variant="light" isIconOnly
                                                className="text-foreground/30 hover:text-danger h-6 w-6 min-w-6"
                                                title="Unlink Discord"
                                                onPress={() => setShowDiscordUnlinkConfirm(true)}
                                            >
                                                <Unlink className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button
                                            size="sm" variant="flat"
                                            className="text-xs shrink-0 bg-[#5865F2]/15 text-[#5865F2] hover:bg-[#5865F2]/25"
                                            startContent={<Link2 className="h-3 w-3" />}
                                            onPress={() => openDiscordModal(`/api/discord/authorize?returnTo=settings`)}
                                        >
                                            Link Discord
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Emails */}
                            <div className="pt-2.5 space-y-2">
                                {/* Primary */}
                                <div className="min-w-0">
                                    <p className="text-[10px] text-foreground/40 uppercase">Main Gmail</p>
                                    <p className="text-sm truncate">{profile?.email}</p>
                                    <p className="text-[10px] text-foreground/30 mt-0.5">Used to link & transfer wallet across games</p>
                                </div>

                                {/* Secondary */}
                                {profile?.secondaryEmail ? (
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] text-foreground/40 uppercase">Secondary Email</p>
                                            <p className="text-sm truncate">{profile.secondaryEmail}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Button
                                                size="sm" variant="flat" color="primary" isIconOnly
                                                title="Swap — make secondary the primary"
                                                isDisabled={emailSaving}
                                                onPress={async () => {
                                                    setEmailSaving(true);
                                                    try {
                                                        const res = await fetch("/api/profile/secondary-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "SWAP" }) });
                                                        const json = await res.json();
                                                        if (res.ok) {
                                                            if (json.data?.email) await updateSession({ email: json.data.email });
                                                            toast.success(json.message);
                                                            queryClient.invalidateQueries({ queryKey: ["profile"] });
                                                        } else { toast.error(json.message || "Failed"); }
                                                    } catch { toast.error("Network error"); }
                                                    finally { setEmailSaving(false); }
                                                }}
                                            >
                                                <ArrowRightLeft className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                size="sm" variant="flat" color="danger" isIconOnly
                                                title="Remove secondary email"
                                                isDisabled={emailSaving}
                                                onPress={async () => {
                                                    setEmailSaving(true);
                                                    try {
                                                        const res = await fetch("/api/profile/secondary-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "REMOVE" }) });
                                                        const json = await res.json();
                                                        if (res.ok) {
                                                            if (json.data?.requireSignOut) { setShowSignOutModal(true); return; }
                                                            toast.success("Secondary email removed");
                                                            queryClient.invalidateQueries({ queryKey: ["profile"] });
                                                        } else { toast.error(json.message || "Failed"); }
                                                    } catch { toast.error("Network error"); }
                                                    finally { setEmailSaving(false); }
                                                }}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : showEmailInput ? (
                                    <div className="space-y-2">
                                        <p className="text-[10px] text-foreground/40 uppercase">Add Secondary Email</p>
                                        <Input
                                            value={newSecondaryEmail}
                                            onChange={(e) => { setNewSecondaryEmail(e.target.value); setEmailError(""); }}
                                            placeholder="second.email@gmail.com"
                                            size="sm" variant="flat" type="email"
                                            isDisabled={emailSaving}
                                            isInvalid={!!emailError}
                                            errorMessage={emailError}
                                            classNames={{ inputWrapper: "bg-default-100 border border-divider" }}
                                            startContent={<Mail className="h-3.5 w-3.5 text-foreground/30" />}
                                        />
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="flat" onPress={() => { setShowEmailInput(false); setNewSecondaryEmail(""); setEmailError(""); }} isDisabled={emailSaving}>Cancel</Button>
                                            <Button
                                                size="sm" color="primary" className="flex-1"
                                                isLoading={emailSaving}
                                                isDisabled={!newSecondaryEmail.includes("@")}
                                                onPress={async () => {
                                                    setEmailSaving(true); setEmailError("");
                                                    try {
                                                        const res = await fetch("/api/profile/secondary-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ADD", email: newSecondaryEmail.trim() }) });
                                                        const json = await res.json();
                                                        if (res.ok) { toast.success(json.message); setShowEmailInput(false); setNewSecondaryEmail(""); queryClient.invalidateQueries({ queryKey: ["profile"] }); }
                                                        else { setEmailError(json.message || "Failed to add email"); }
                                                    } catch { setEmailError("Network error"); }
                                                    finally { setEmailSaving(false); }
                                                }}
                                            >Add Email</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowEmailInput(true)}
                                        className="flex items-center gap-1.5 text-xs text-foreground/40 hover:text-primary transition-colors"
                                    >
                                        <Plus className="h-3 w-3" />
                                        Add Secondary Email
                                    </button>
                                )}
                            </div>
                        </CardBody>
                    </Card>
                </motion.div>
            )}

            <LocationModal
                isOpen={showLocationModal}
                onComplete={() => { setShowLocationModal(false); queryClient.invalidateQueries({ queryKey: ["profile"] }); }}
                blocking={false}
            />
            <DiscordCompareModal />

            {/* ═══════════════ LANGUAGE ═══════════════ */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
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

            {/* ═══════════════ NOTIFICATIONS ═══════════════ */}
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

            {/* ═══════════════ SQUAD SUBSCRIPTIONS ═══════════════ */}
            {GAME.features.hasSquads && subs && subs.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.17 }}
                >
                    <Card className="border border-divider">
                        <CardBody className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Users className="h-4 w-4 text-primary" />
                                <span className="text-sm font-semibold">Squad Subscriptions</span>
                            </div>
                            <p className="text-xs text-foreground/40 mb-3">
                                Captains who can instantly add you to their teams
                            </p>
                            <div className="space-y-2">
                                {subs.map((sub) => (
                                    <div key={sub.captainId} className="flex items-center gap-2.5 p-2 rounded-lg bg-default-50">
                                        <Avatar
                                            src={sub.imageUrl || undefined}
                                            name={sub.displayName}
                                            size="sm"
                                            className="w-7 h-7 shrink-0"
                                        />
                                        <span className="text-sm font-medium truncate flex-1">{sub.displayName}</span>
                                        <Button
                                            size="sm" variant="light" color="danger" isIconOnly
                                            className="h-7 w-7 min-w-7"
                                            isLoading={unsubbing.has(sub.captainId)}
                                            onPress={() => handleUnsub(sub.captainId)}
                                            title="Unsubscribe"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </CardBody>
                    </Card>
                </motion.div>
            )}

            {/* ═══════════════ THEME ═══════════════ */}
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

            {/* ═══════════════ ABOUT ═══════════════ */}
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

            {/* ═══════════════ SIGN OUT ═══════════════ */}
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

            {/* ═══════════════ MODALS ═══════════════ */}
            {/* Discord Unlink Confirmation */}
            <AnimatePresence>
                {showDiscordUnlinkConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => !discordUnlinking && setShowDiscordUnlinkConfirm(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-sm rounded-2xl border border-divider bg-content1 p-6 shadow-2xl"
                        >
                            <div className="text-center space-y-4">
                                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-danger/10 mx-auto">
                                    <Unlink className="h-6 w-6 text-danger" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold">Unlink Discord?</h3>
                                    <p className="text-sm text-foreground/50 mt-1">
                                        Discord is currently optional. You can unlink it safely.
                                    </p>
                                </div>
                                <div className="space-y-2 text-left text-sm">
                                    <div className="flex items-center gap-2.5 rounded-lg bg-foreground/5 px-3 py-2.5">
                                        <span className="text-base">💬</span>
                                        <span className="text-foreground/70">Room IDs are now sent via WhatsApp</span>
                                    </div>
                                    <div className="flex items-center gap-2.5 rounded-lg bg-foreground/5 px-3 py-2.5">
                                        <span className="text-base">🔄</span>
                                        <span className="text-foreground/70">You can re-link anytime from settings</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <Button variant="flat" className="min-w-[80px] shrink-0" onPress={() => setShowDiscordUnlinkConfirm(false)} isDisabled={discordUnlinking}>
                                        Cancel
                                    </Button>
                                    <Button
                                        color="danger" variant="flat" className="flex-1"
                                        startContent={!discordUnlinking && <Unlink className="h-3.5 w-3.5" />}
                                        isLoading={discordUnlinking}
                                        onPress={async () => {
                                            setDiscordUnlinking(true);
                                            try {
                                                const res = await fetch("/api/discord/unlink", { method: "POST" });
                                                if (res.ok) {
                                                    toast.success("Discord unlinked");
                                                    sessionStorage.removeItem("discord_linked");
                                                    setShowDiscordUnlinkConfirm(false);
                                                    queryClient.invalidateQueries({ queryKey: ["profile"] });
                                                } else {
                                                    const json = await res.json();
                                                    toast.error(json.error || "Failed to unlink");
                                                }
                                            } catch { toast.error("Network error"); }
                                            finally { setDiscordUnlinking(false); }
                                        }}
                                    >
                                        Unlink Discord
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Sign-out modal after removing session email */}
            <AnimatePresence>
                {showSignOutModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-sm rounded-2xl border border-divider bg-content1 p-6 shadow-2xl"
                        >
                            <div className="text-center space-y-4">
                                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-success/10 mx-auto">
                                    <Mail className="h-6 w-6 text-success" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold">Email Removed</h3>
                                    <p className="text-sm text-foreground/50 mt-1">
                                        Sign back in with your new primary email to continue.
                                    </p>
                                </div>
                                <Button
                                    color="primary" fullWidth
                                    startContent={<LogOut className="h-4 w-4" />}
                                    onPress={() => signOut({ callbackUrl: "/" })}
                                    className="font-bold"
                                >
                                    Sign Out & Re-login
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
