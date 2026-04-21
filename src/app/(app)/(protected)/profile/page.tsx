"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Card,
    CardBody,
    Avatar,
    Chip,
    Skeleton,
    Button,
    Input,
} from "@heroui/react";
import {
    Target,
    Swords,
    Gamepad2,
    Flame,
    Trophy,
    Crown,
    Shield,
    User,
    AlertCircle,
    Camera,
    Loader2,
    ImagePlus,
    LogOut,
    TrendingUp,
    TrendingDown,
    Minus,
    ChevronDown,
    Medal,
    Star,
    Pencil,
    Mail,
    Plus,
    ArrowRightLeft,
    X,
    VolumeX,
    Volume2,
    Users,
    MapPin,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CategoryBadge } from "@/components/ui/category-badge";
import { signOut, useSession } from "next-auth/react";
import { GameNameInput, validateDisplayName } from "@/components/common/GameNameInput";
import { useIGNTutorial } from "@/components/common/IGNTutorialModal";
import { toast } from "sonner";
import { CharacterPreviewModal } from "@/components/profile/character-preview-modal";
import { GAME } from "@/lib/game-config";
import { LocationModal } from "@/components/common/location-modal";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";

interface ProfileData {
    id: string;
    username: string;
    email: string;
    secondaryEmail: string | null;
    imageUrl: string | null;
    role: string;
    player: {
        id: string;
        displayName: string | null;
        uid: string | null;
        phoneNumber: string | null;
        bio: string | null;
        category: string;
        hasRoyalPass: boolean;
        isBanned: boolean;
        state: string | null;
        district: string | null;
        town: string | null;
        characterImage: {
            url: string;
            thumbnailUrl: string | null;
            isAnimated: boolean;
            isVideo: boolean;
        } | null;
        stats: {
            kills: number;
            matches: number;
            kd: number;
            kdTrend: "up" | "down" | "same";
            kdChange: number;
            lastMatchKills: number;
            seasonsPlayed: number;
            totalTournaments: number;
            bestMatchKills: number;
            wins: number;
            top10: number;
            winRate: number;
            top10Rate: number;
            avgKillsPerMatch: number;
            ucPlacements: {
                first: number;
                second: number;
                third: number;
                fourth: number;
                fifth: number;
            };
        } | null;
        wallet: { balance: number };
        streak: { current: number; longest: number } | null;
    } | null;
}


/**
 * /profile — User's profile page.
 * Shows character hero, detailed stats with K/D trend, UC placements,
 * performance metrics, profile settings, and streak info.
 */
export default function ProfilePage() {
    const queryClient = useQueryClient();
    const router = useRouter();
    const { update: updateSession } = useSession();
    const handleSignOut = () => signOut({ callbackUrl: "/" });
    const profileInputRef = useRef<HTMLInputElement>(null);
    const characterInputRef = useRef<HTMLInputElement>(null);
    const [uploadingProfile, setUploadingProfile] = useState(false);
    const [uploadingCharacter, setUploadingCharacter] = useState(false);
    const [previewProfileUrl, setPreviewProfileUrl] = useState<string | null>(null);
    const [previewCharacter, setPreviewCharacter] = useState<{ url: string; isVideo: boolean } | null>(null);
    const [pendingCharacterFile, setPendingCharacterFile] = useState<File | null>(null);
    const [showCharacterPreview, setShowCharacterPreview] = useState(false);
    const [showUCBreakdown, setShowUCBreakdown] = useState(false);
    const [navigatingToWallet, setNavigatingToWallet] = useState(false);
    const [heroMuted, setHeroMuted] = useState(true);
    const heroVideoRef = useRef<HTMLVideoElement>(null);

    // Profile edit state
    const [editing, setEditing] = useState(false);
    const [newIGN, setNewIGN] = useState("");
    const [newUID, setNewUID] = useState("");
    const [newPhone, setNewPhone] = useState("");
    const [newBio, setNewBio] = useState("");
    const [ignError, setIgnError] = useState("");
    const [saving, setSaving] = useState(false);
    const ignTutorial = useIGNTutorial();
    const [showRPModal, setShowRPModal] = useState(false);
    const [isBuyingRP, setIsBuyingRP] = useState(false);
    const profileSectionRef = useRef<HTMLDivElement>(null);

    // Secondary email state
    const [showEmailInput, setShowEmailInput] = useState(false);
    const [newSecondaryEmail, setNewSecondaryEmail] = useState("");
    const [emailSaving, setEmailSaving] = useState(false);
    const [emailError, setEmailError] = useState("");
    const [showSignOutModal, setShowSignOutModal] = useState(false);
    const [showLocationModal, setShowLocationModal] = useState(false);

    const PROFILE_CACHE_KEY = "profile_cache";

    const getCachedProfile = (): ProfileData | undefined => {
        try {
            const raw = localStorage.getItem(PROFILE_CACHE_KEY);
            if (raw) return JSON.parse(raw);
        } catch {}
        return undefined;
    };

    const { data: profile, isLoading, isFetching, error } = useQuery<ProfileData>({
        queryKey: ["profile"],
        queryFn: async () => {
            const res = await fetch("/api/profile");
            if (!res.ok) throw new Error("Failed to fetch profile");
            const json = await res.json();
            const data = json.data;
            // Persist to localStorage for instant load next time
            try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data)); } catch {}
            return data;
        },
        staleTime: 5 * 60 * 1000,
        initialData: getCachedProfile,
    });

    const [onCooldown, setOnCooldown] = useState(false);

    // Fetch RP prices from settings (dynamic)
    const { data: rpSettings } = useQuery<{ elitePassPrice: number; elitePassOrigPrice: number }>({
        queryKey: ["settings-rp-price"],
        queryFn: async () => {
            const res = await fetch("/api/settings/public");
            if (!res.ok) throw new Error("Failed");
            const json = await res.json();
            return json.data;
        },
        staleTime: 5 * 60 * 1000,
    });
    const rpPrice = rpSettings?.elitePassPrice ?? 5;
    const rpOrigPrice = rpSettings?.elitePassOrigPrice ?? 20;
    const rpDiscountPercent = rpOrigPrice > rpPrice ? Math.round((1 - rpPrice / rpOrigPrice) * 100) : 0;


    const handleSaveProfile = async (forceChange = false) => {
        if (newIGN.trim()) {
            const err = validateDisplayName(newIGN);
            if (err) { setIgnError(err); return; }
        }
        setSaving(true);
        try {
            const res = await fetch("/api/profile/update-ign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...(newIGN.trim() ? { displayName: newIGN.trim() } : {}),
                    ...(newUID.trim() ? { uid: newUID.trim() } : {}),
                    ...(!GAME.features.hasBR ? { phoneNumber: newPhone.trim() } : {}),
                    ...(newBio !== undefined ? { bio: newBio.trim() } : {}),
                    ...(forceChange ? { forceChange: true } : {}),
                }),
            });
            if (res.ok) {
                toast.success(forceChange ? `Name updated (1 ${GAME.currency} charged)` : "Profile updated!");
                setEditing(false);
                setOnCooldown(false);
                queryClient.invalidateQueries({ queryKey: ["profile"] });
                queryClient.invalidateQueries({ queryKey: ["auth-user"] });
                queryClient.invalidateQueries({ queryKey: ["wallet"] });
            } else if (res.status === 429) {
                // Cooldown — show "Pay 1 UC & Save" button
                setOnCooldown(true);
                const json = await res.json();
                setIgnError(json.message || "Name on cooldown");
            } else {
                const json = await res.json();
                setIgnError(json.message || "Failed to update");
            }
        } catch {
            toast.error("Network error");
        } finally {
            setSaving(false);
        }
    };

    // Auto-refetch when profile loads without a player (stale cache race condition)
    const queryClient2 = queryClient;
    useEffect(() => {
        if (!isLoading && !isFetching && profile && !profile.player) {
            const timer = setTimeout(() => {
                queryClient2.invalidateQueries({ queryKey: ["profile"] });
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isLoading, isFetching, profile]);

    // Show skeleton when we have no profile data at all OR when profile exists but player hasn't loaded yet.
    // Never show skeleton when we have player data (from localStorage or React Query cache).
    const showSkeleton = !profile?.player && (isLoading || isFetching);
    if (showSkeleton) {
        return (
            <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
                <div className="space-y-4">
                    {/* Hero card skeleton */}
                    <div className="overflow-hidden rounded-xl border border-divider">
                        <div className="relative aspect-[3/4] w-full">
                            <Skeleton className="h-full w-full" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                            {/* Avatar + name overlay */}
                            <div className="absolute bottom-3 left-4 right-4 flex items-end gap-3">
                                <Skeleton className="h-16 w-16 rounded-full shrink-0" />
                                <div className="flex-1 space-y-1.5 pb-0.5">
                                    <Skeleton className="h-6 w-36 rounded-lg" />
                                    <Skeleton className="h-4 w-24 rounded-lg" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats card skeleton */}
                    <div className="rounded-xl border border-divider p-4 space-y-4">
                        {/* K/D */}
                        <div className="flex flex-col items-center gap-1">
                            <Skeleton className="h-3 w-16 rounded" />
                            <Skeleton className="h-10 w-20 rounded-lg" />
                        </div>
                        {/* Battle Stats 4-grid */}
                        <div>
                            <Skeleton className="h-3 w-20 rounded mb-2" />
                            <div className="grid grid-cols-4 gap-3">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="flex flex-col items-center gap-1">
                                        <Skeleton className="h-7 w-10 rounded" />
                                        <Skeleton className="h-2.5 w-12 rounded" />
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Performance 3-grid */}
                        <div className="border-t border-divider pt-3">
                            <Skeleton className="h-3 w-24 rounded mb-2" />
                            <div className="grid grid-cols-3 gap-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex flex-col items-center gap-1">
                                        <Skeleton className="h-6 w-12 rounded" />
                                        <Skeleton className="h-2.5 w-14 rounded" />
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Career 3-grid */}
                        <div className="border-t border-divider pt-3">
                            <Skeleton className="h-3 w-16 rounded mb-2" />
                            <div className="grid grid-cols-3 gap-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex flex-col items-center gap-1">
                                        <Skeleton className="h-6 w-10 rounded" />
                                        <Skeleton className="h-2.5 w-16 rounded" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Profile settings skeleton */}
                    <div className="rounded-xl border border-divider p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Skeleton className="h-4 w-4 rounded" />
                            <Skeleton className="h-3 w-14 rounded" />
                        </div>
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Skeleton className="h-3 w-16 rounded" />
                                <Skeleton className="h-3 w-28 rounded" />
                            </div>
                        ))}
                    </div>

                    {/* Sign out skeleton */}
                    <Skeleton className="h-10 w-full rounded-xl" />
                </div>
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
                <div className="flex items-center gap-2 rounded-lg bg-danger-50 p-4 text-sm text-danger dark:bg-danger-50/10">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Failed to load profile.
                </div>
            </div>
        );
    }

    const player = profile.player;
    const stats = player?.stats;
    const name = player?.displayName || profile.username;

    return (
        <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
            {/* Subtle refresh indicator — shows when background refetching stale data */}
            <AnimatePresence>
                {isFetching && profile?.player && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-default-100/90 backdrop-blur-md border border-divider shadow-sm"
                    >
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        <span className="text-[11px] font-medium text-foreground/50">Refreshing…</span>
                    </motion.div>
                )}
            </AnimatePresence>
            <div className="space-y-4">
                {/* Hero card */}
                <Card className="overflow-hidden border border-divider">
                    <div className="relative aspect-[3/4] w-full group">
                        {(previewCharacter?.url || player?.characterImage?.url) ? (
                            (previewCharacter?.isVideo || (!previewCharacter && player?.characterImage?.isVideo)) ? (
                                <>
                                    <video
                                        ref={heroVideoRef}
                                        src={previewCharacter?.url || player?.characterImage?.url}
                                        autoPlay muted playsInline loop
                                        className="h-full w-full object-contain bg-default-100"
                                        onLoadedData={() => {
                                            if (heroVideoRef.current) heroVideoRef.current.muted = heroMuted;
                                        }}
                                    />
                                    {/* Sound toggle */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const next = !heroMuted;
                                            setHeroMuted(next);
                                            if (heroVideoRef.current) heroVideoRef.current.muted = next;
                                        }}
                                        className="absolute left-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 transition-colors"
                                    >
                                        {heroMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                    </button>
                                </>
                            ) : (
                                <img
                                    src={previewCharacter?.url || player?.characterImage?.url}
                                    alt=""
                                    className="h-full w-full object-cover"
                                />
                            )
                        ) : (
                            <div className="flex h-full w-full items-center justify-center" style={{ background: 'linear-gradient(to bottom right, color-mix(in srgb, var(--game-primary) 20%, transparent), color-mix(in srgb, var(--game-primary) 5%, transparent))' }}>
                                <User className="h-16 w-16" style={{ color: 'color-mix(in srgb, var(--game-primary) 30%, transparent)' }} />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                        {/* Buy RP overlay — shown when player has image but no active Royal Pass */}
                        {!player?.hasRoyalPass && player?.characterImage?.url && !previewCharacter && GAME.features.hasRoyalPass && (
                            <button
                                onClick={() => setShowRPModal(true)}
                                className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] cursor-pointer"
                            >
                                <Crown className="h-8 w-8 text-yellow-400 mb-2" />
                                <p className="text-sm font-semibold text-white">Buy {GAME.passName}</p>
                                <p className="text-xs text-white/60">to change or display to others</p>
                            </button>
                        )}

                        {/* Character upload — only for games with Royal Pass */}
                        {GAME.features.hasRoyalPass && (
                            <>
                                <input
                                    ref={characterInputRef}
                                    type="file" accept="image/*,video/*" className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0]; if (!file) return;
                                        const isVid = file.type.startsWith("video/");
                                        // 10MB cap — players upload rarely (once/month), Cloudinary free tier can handle this
                                        if (isVid && file.size > 10 * 1024 * 1024) {
                                            toast.error("Video must be under 10MB. Try a shorter or lower-res clip!");
                                            e.target.value = "";
                                            return;
                                        }
                                        if (isVid) {
                                            const url = URL.createObjectURL(file);
                                            setPreviewCharacter({ url, isVideo: true });
                                            setPendingCharacterFile(file);
                                            setShowCharacterPreview(true);
                                        } else {
                                            const url = URL.createObjectURL(file);
                                            setPreviewCharacter({ url, isVideo: false });
                                            setPendingCharacterFile(file);
                                            setShowCharacterPreview(true);
                                        }
                                        e.target.value = "";
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        if (!player?.hasRoyalPass) {
                                            setShowRPModal(true);
                                            return;
                                        }
                                        characterInputRef.current?.click();
                                    }}
                                    disabled={uploadingCharacter}
                                    className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/70 disabled:opacity-50"
                                >
                                    {uploadingCharacter ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                                    {uploadingCharacter ? "Uploading..." : "Change"}
                                </button>
                            </>
                        )}

                        {/* Profile info overlay */}
                        <div className="absolute bottom-3 left-4 right-4 flex items-end gap-3 z-20">
                            <div className="relative">
                                <Avatar
                                    src={previewProfileUrl || profile.imageUrl || undefined}
                                    name={name} className="h-16 w-16 ring-2 ring-background"
                                />
                                <input
                                    ref={profileInputRef} type="file" accept="image/*" className="hidden"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0]; if (!file) return;
                                        setUploadingProfile(true);
                                        try {
                                            const fd = new FormData(); fd.append("image", file);
                                            const res = await fetch("/api/profile/upload-profile-image", { method: "POST", body: fd });
                                            if (res.ok) {
                                                setPreviewProfileUrl(URL.createObjectURL(file));
                                                queryClient.invalidateQueries({ queryKey: ["profile"] });
                                            }
                                        } finally { setUploadingProfile(false); e.target.value = ""; }
                                    }}
                                />
                                <button
                                    onClick={() => profileInputRef.current?.click()}
                                    disabled={uploadingProfile}
                                    className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full text-white shadow-sm hover:scale-110 disabled:opacity-50"
                                    style={{ backgroundColor: 'var(--game-primary)' }}
                                >
                                    {uploadingProfile ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                                </button>
                            </div>
                            <div className="pb-0.5 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-xl font-bold text-white drop-shadow break-all leading-normal">{name}</h1>
                                    {player?.hasRoyalPass && <Crown className="h-5 w-5 text-yellow-400 shrink-0" />}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditing(true);
                                            setNewIGN(player?.displayName || profile.username);
                                            setNewUID(player?.uid || "");
                                            setNewPhone(player?.phoneNumber || "");
                                            setNewBio(player?.bio || "");
                                            setIgnError("");
                                            setTimeout(() => profileSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
                                        }}
                                        className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 active:scale-90 transition-all shrink-0"
                                        title={`Edit ${GAME.ignLabel}`}
                                    >
                                        <Pencil className="h-2.5 w-2.5 text-white" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-sm text-white/50 truncate">@{profile.username}</span>
                                    {player && <CategoryBadge category={player.category} size="sm" />}
                                </div>
                            </div>
                        </div>

                        {/* Banned badge */}
                        {player?.isBanned && (
                            <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-danger/90 text-white text-xs font-medium">
                                <AlertCircle className="h-3 w-3" /> Banned
                            </div>
                        )}
                    </div>
                </Card>


                {/* Wallet badge — links to wallet page */}
                {player && (
                    <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => {
                            if (navigatingToWallet) return;
                            setNavigatingToWallet(true);
                            router.push("/wallet");
                        }}
                        className="flex items-center justify-between rounded-xl border border-divider bg-default-50 px-4 py-3 hover:bg-default-100 active:scale-[0.98] transition-all cursor-pointer"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10">
                                <CurrencyIcon size={18} />
                            </div>
                            <div>
                                <p className="text-xs text-foreground/40 font-medium">My Wallet</p>
                                {GAME.hasDualCurrency ? (
                                    <div className="flex items-center gap-3">
                                        <p className="text-base font-bold leading-tight">
                                            {(player.wallet?.balance ?? 0).toLocaleString()} <span className="text-[10px] font-semibold text-foreground/50">{GAME.entryCurrency}</span>
                                        </p>
                                        <span className="text-foreground/20">|</span>
                                        <p className="text-base font-bold leading-tight">
                                            {((player.wallet as Record<string, number>)?.diamondBalance ?? 0).toLocaleString()} <span className="text-[10px] font-semibold text-foreground/50">{GAME.rewardCurrencyEmoji}</span>
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-lg font-bold leading-tight">
                                        {(player.wallet?.balance ?? 0).toLocaleString()} <span className="text-xs font-semibold text-foreground/50">{GAME.currency}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                        <motion.div
                            animate={navigatingToWallet ? { rotate: 360 } : { rotate: 0 }}
                            transition={navigatingToWallet ? { duration: 0.6, repeat: Infinity, ease: "linear" } : { duration: 0 }}
                        >
                            {navigatingToWallet ? (
                                <Loader2 className="h-4 w-4 text-primary/60" />
                            ) : (
                                <span className="text-foreground/30 text-sm">→</span>
                            )}
                        </motion.div>
                    </motion.div>
                )}

                {/* ── Stats Section ── */}
                {stats && (
                    <Card className="border border-divider overflow-hidden">
                        <CardBody className="p-4 space-y-4">
                            {/* Featured Stat — K/D for BR, Win Rate for bracket games */}
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-2 mb-1">
                                    <p className="text-xs text-foreground/50 font-medium uppercase tracking-wide">
                                        {GAME.features.hasBR ? "K/D Ratio" : "Win Rate"}
                                    </p>
                                </div>
                                <div className="flex items-baseline justify-center gap-2">
                                    <span className="text-4xl font-bold game-gradient-text">
                                        {GAME.features.hasBR
                                            ? stats.kd.toFixed(2)
                                            : stats.matches > 0 ? `${stats.winRate}%` : "—"}
                                    </span>
                                    {GAME.features.hasBR && stats.matches > 0 && (
                                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-medium ${stats.kdTrend === "up" ? "bg-success/10 text-success" :
                                            stats.kdTrend === "down" ? "bg-danger/10 text-danger" :
                                                "bg-default-100 text-foreground/50"
                                            }`}>
                                            {stats.kdTrend === "up" && <TrendingUp className="w-3.5 h-3.5" />}
                                            {stats.kdTrend === "down" && <TrendingDown className="w-3.5 h-3.5" />}
                                            {stats.kdTrend === "same" && <Minus className="w-3.5 h-3.5" />}
                                            {stats.kdChange > 0 ? "+" : ""}{stats.kdChange.toFixed(2)}
                                        </div>
                                    )}
                                </div>
                                {GAME.features.hasBR && stats.lastMatchKills > 0 && (
                                    <p className="text-xs text-foreground/40 mt-1">
                                        Last match: <span className="font-semibold text-foreground/70">{stats.lastMatchKills} kills</span>
                                    </p>
                                )}
                            </div>

                            {/* Battle Stats / Match Stats */}
                            <div>
                                <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider mb-2">
                                    {GAME.features.hasBR ? "Battle Stats" : "Match Stats"}
                                </p>
                                <div className={`grid ${GAME.features.hasBR ? "grid-cols-4" : "grid-cols-3"} gap-3 text-center`}>
                                    <div>
                                        <div className="text-2xl font-bold">{stats.matches}</div>
                                        <p className="text-[10px] text-foreground/40 uppercase">Matches</p>
                                    </div>
                                    <div
                                        className="cursor-pointer hover:bg-default-100 rounded-lg py-1 transition-colors"
                                        onClick={() => setShowUCBreakdown(!showUCBreakdown)}
                                    >
                                        <div className="text-2xl font-bold text-success">{stats.wins}</div>
                                        <p className="text-[10px] text-foreground/40 uppercase flex items-center justify-center gap-0.5">
                                            Wins <ChevronDown className={`w-3 h-3 transition-transform ${showUCBreakdown ? "rotate-180" : ""}`} />
                                        </p>
                                    </div>
                                    {GAME.features.hasBR ? (
                                        <>
                                            <div>
                                                <div className="text-2xl font-bold text-primary">{stats.top10}</div>
                                                <p className="text-[10px] text-foreground/40 uppercase">Top 5</p>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-danger">{stats.kills}</div>
                                                <p className="text-[10px] text-foreground/40 uppercase">Kills</p>
                                            </div>
                                        </>
                                    ) : (
                                        <div>
                                            <div className="text-2xl font-bold text-danger">{Math.max(0, stats.matches - stats.wins)}</div>
                                            <p className="text-[10px] text-foreground/40 uppercase">Losses</p>
                                        </div>
                                    )}
                                </div>

                                {/* UC Wins Breakdown */}
                                <AnimatePresence>
                                    {showUCBreakdown && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="mt-3 pt-3 border-t border-divider">
                                                {(stats.ucPlacements.first + stats.ucPlacements.second + stats.ucPlacements.third + stats.ucPlacements.fourth + stats.ucPlacements.fifth) === 0 ? (
                                                    <p className="text-center text-sm text-foreground/40 py-2">No {GAME.currency} wins yet</p>
                                                ) : (
                                                    <div className="flex gap-4 justify-center flex-wrap">
                                                        {stats.ucPlacements.first > 0 && (
                                                            <div className="text-center">
                                                                <div className="text-lg font-bold text-yellow-500">🥇{stats.ucPlacements.first}</div>
                                                                <p className="text-[9px] text-foreground/40 uppercase">1st</p>
                                                            </div>
                                                        )}
                                                        {stats.ucPlacements.second > 0 && (
                                                            <div className="text-center">
                                                                <div className="text-lg font-bold text-foreground/50">🥈{stats.ucPlacements.second}</div>
                                                                <p className="text-[9px] text-foreground/40 uppercase">2nd</p>
                                                            </div>
                                                        )}
                                                        {stats.ucPlacements.third > 0 && (
                                                            <div className="text-center">
                                                                <div className="text-lg font-bold text-orange-400">🥉{stats.ucPlacements.third}</div>
                                                                <p className="text-[9px] text-foreground/40 uppercase">3rd</p>
                                                            </div>
                                                        )}
                                                        {stats.ucPlacements.fourth > 0 && (
                                                            <div className="text-center">
                                                                <div className="text-lg font-bold text-foreground/40">{stats.ucPlacements.fourth}</div>
                                                                <p className="text-[9px] text-foreground/40 uppercase">4th</p>
                                                            </div>
                                                        )}
                                                        {stats.ucPlacements.fifth > 0 && (
                                                            <div className="text-center">
                                                                <div className="text-lg font-bold text-foreground/40">{stats.ucPlacements.fifth}</div>
                                                                <p className="text-[9px] text-foreground/40 uppercase">5th</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Performance */}
                            <div className="border-t border-divider pt-3">
                                <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider mb-2">Performance</p>
                                <div className={`grid ${GAME.features.hasBR ? "grid-cols-3" : "grid-cols-2"} gap-3 text-center`}>
                                    <div>
                                        <div className="text-xl font-bold">{stats.winRate}<span className="text-sm text-foreground/40">%</span></div>
                                        <p className="text-[10px] text-foreground/40 uppercase">Win Rate</p>
                                    </div>
                                    {GAME.features.hasBR ? (
                                        <>
                                            <div>
                                                <div className="text-xl font-bold">{stats.top10Rate}<span className="text-sm text-foreground/40">%</span></div>
                                                <p className="text-[10px] text-foreground/40 uppercase">Top 5 Rate</p>
                                            </div>
                                            <div>
                                                <div className="text-xl font-bold text-warning">{stats.bestMatchKills}</div>
                                                <p className="text-[10px] text-foreground/40 uppercase">Best Kill</p>
                                            </div>
                                        </>
                                    ) : (
                                        <div>
                                            <div className="text-xl font-bold text-warning">{stats.bestMatchKills}</div>
                                            <p className="text-[10px] text-foreground/40 uppercase">Best Score</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Career */}
                            <div className="border-t border-divider pt-3">
                                <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider mb-2">Career</p>
                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div>
                                        <div className="text-xl font-bold text-secondary">{stats.totalTournaments}</div>
                                        <p className="text-[10px] text-foreground/40 uppercase">Tournaments</p>
                                    </div>
                                    <div>
                                        <div className="text-xl font-bold text-primary">{stats.seasonsPlayed}</div>
                                        <p className="text-[10px] text-foreground/40 uppercase">Seasons</p>
                                    </div>
                                    <div>
                                        <div className="text-xl font-bold">{stats.avgKillsPerMatch}</div>
                                        <p className="text-[10px] text-foreground/40 uppercase">{GAME.features.hasBR ? "Avg Kills" : "Avg Goals"}</p>
                                    </div>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                )}

                {/* Teammate History Link */}
                {player && (
                    <button
                        type="button"
                        onClick={() => router.push("/teammates")}
                        className="w-full flex items-center justify-between p-4 rounded-xl border border-divider bg-default-50 hover:bg-default-100 transition-colors cursor-pointer"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Users className="w-4 h-4 text-primary" />
                            </div>
                            <div className="text-left">
                                <p className="text-sm font-semibold">Teammate History</p>
                                <p className="text-[11px] text-foreground/40">See who you&apos;ve played with</p>
                            </div>
                        </div>
                        <span className="text-foreground/30 text-sm">→</span>
                    </button>
                )}

                {/* Profile Settings Section — Unified Card */}
                {player && (
                    <Card ref={profileSectionRef} className="border border-divider">
                        <CardBody className="p-4 space-y-0">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-foreground/50" />
                                    <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                                        {editing ? "Edit Profile" : "Profile"}
                                    </p>
                                </div>
                                {!editing && (
                                    <Button
                                        size="sm" variant="light"
                                        startContent={<Pencil className="h-3 w-3" />}
                                        onPress={() => {
                                            setEditing(true);
                                            setNewIGN(player.displayName || profile.username);
                                            setNewUID(player.uid || "");
                                            setNewPhone(player.phoneNumber || "");
                                            setNewBio(player.bio || "");
                                            setIgnError("");
                                        }}
                                    >
                                        Edit
                                    </Button>
                                )}
                            </div>

                            {editing ? (
                                /* ── EDIT MODE ── */
                                <div className="space-y-4">
                                    {/* Username (read-only) */}
                                    <div>
                                        <p className="text-xs text-foreground/40 mb-1">Username</p>
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-default-100">
                                            <span className="text-sm text-foreground/50">@{profile.username}</span>
                                            <Chip size="sm" variant="flat" color="default" className="text-[10px]">Cannot change</Chip>
                                        </div>
                                    </div>

                                    {/* Game Name / Team Name */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <label className="text-sm font-medium text-foreground/70">{GAME.ignLabel}</label>
                                            {GAME.pasteOnlyIGN && ignTutorial.HelpButton}
                                        </div>
                                        {GAME.pasteOnlyIGN ? (
                                            <>
                                                <GameNameInput
                                                    value={newIGN}
                                                    onChange={setNewIGN}
                                                    error={ignError}
                                                    onErrorChange={setIgnError}
                                                    disabled={saving}
                                                />
                                                <p className="mt-2 text-xs text-foreground/40">
                                                    <button
                                                        type="button"
                                                        onClick={ignTutorial.openModal}
                                                        className="text-primary hover:underline font-medium"
                                                    >
                                                        Kumno ban copy?
                                                    </button>
                                                    {" / "}
                                                    <button
                                                        type="button"
                                                        onClick={ignTutorial.openModal}
                                                        className="text-primary hover:underline font-medium"
                                                    >
                                                        Need help?
                                                    </button>
                                                </p>
                                            </>
                                        ) : (
                                            <Input
                                                value={newIGN}
                                                onChange={(e) => {
                                                    setNewIGN(e.target.value);
                                                    setIgnError("");
                                                }}
                                                placeholder={`Enter your ${GAME.ignLabel.toLowerCase()}`}
                                                size="lg"
                                                variant="bordered"
                                                maxLength={20}
                                                isDisabled={saving}
                                                isInvalid={!!ignError}
                                                errorMessage={ignError}
                                                startContent={
                                                    <span className="text-foreground/30 text-sm">🎮</span>
                                                }
                                            />
                                        )}
                                    </div>

                                    {/* UID — paste only (Free Fire only) */}
                                    {GAME.hasUID && (
                                        <div>
                                            <label className="text-sm font-medium text-foreground/70 mb-2 block">
                                                {GAME.idLabel}
                                            </label>
                                            <Input
                                                value={newUID}
                                                onChange={(e) => setNewUID(e.target.value)}
                                                placeholder={GAME.idPlaceholder}
                                                size="lg"
                                                variant="bordered"
                                                onPaste={(e) => {
                                                    e.preventDefault();
                                                    const pasted = e.clipboardData.getData("text").trim();
                                                    if (pasted) setNewUID(pasted);
                                                }}
                                                description={`Copy from ${GAME.gameName} profile → paste here`}
                                                isDisabled={saving}
                                                startContent={
                                                    <span className="text-foreground/30 text-sm">🆔</span>
                                                }
                                            />
                                        </div>
                                    )}

                                    {/* Phone number — PES only */}
                                    {!GAME.features.hasBR && (
                                        <div>
                                            <label className="text-sm font-medium text-foreground/70 mb-2 block">
                                                Phone Number
                                            </label>
                                            <Input
                                                value={newPhone}
                                                onChange={(e) => setNewPhone(e.target.value)}
                                                placeholder="e.g. +91 9876543210"
                                                size="lg"
                                                variant="bordered"
                                                type="tel"
                                                isDisabled={saving}
                                                description="Used for prize delivery & contact"
                                                startContent={
                                                    <span className="text-foreground/30 text-sm">📱</span>
                                                }
                                            />
                                        </div>
                                    )}

                                    {/* Bio */}
                                    <div>
                                        <p className="text-xs text-foreground/40 mb-1">Bio</p>
                                        <textarea
                                            value={newBio}
                                            onChange={(e) => setNewBio(e.target.value)}
                                            placeholder="Write something about yourself..."
                                            maxLength={100}
                                            rows={2}
                                            disabled={saving}
                                            className="w-full px-3 py-2 rounded-lg bg-default-100 border border-divider text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                                        />
                                        <p className="text-[10px] text-foreground/30 mt-0.5 text-right">{newBio.length}/100</p>
                                    </div>

                                    {/* Save / Cancel */}
                                    <div className="flex gap-2 pt-1">
                                        <Button
                                            size="lg" variant="flat"
                                            onPress={() => setEditing(false)}
                                            isDisabled={saving}
                                            className="shrink-0"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            size="lg" color={onCooldown ? "warning" : "primary"}
                                            fullWidth
                                            onPress={() => handleSaveProfile(onCooldown)}
                                            isLoading={saving}
                                            isDisabled={!onCooldown && (!!ignError || !newIGN.trim() || (newIGN === (player.displayName || profile.username) && newBio === (player.bio || "")))}
                                            className="font-bold text-base"
                                        >
                                            {onCooldown ? `Pay 1 ${GAME.currency} & Save` : "Save"}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                /* ── READ MODE ── */
                                <div className="space-y-3">
                                    {/* Info rows */}
                                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 items-baseline">
                                        <span className="text-xs text-foreground/40">Username</span>
                                        <span className="text-sm">@{profile.username}</span>

                                        <span className="text-xs text-foreground/40">{GAME.ignLabel}</span>
                                        <span className="text-sm font-bold">{player.displayName || profile.username}</span>

                                        {GAME.hasUID && player.uid && (
                                            <>
                                                <span className="text-xs text-foreground/40">{GAME.idLabel}</span>
                                                <span className="text-sm font-mono">{player.uid}</span>
                                            </>
                                        )}

                                        {!GAME.features.hasBR && player.phoneNumber && (
                                            <>
                                                <span className="text-xs text-foreground/40">Phone</span>
                                                <span className="text-sm font-mono">{player.phoneNumber}</span>
                                            </>
                                        )}

                                        {player.bio && (
                                            <>
                                                <span className="text-xs text-foreground/40">Bio</span>
                                                <span className="text-sm italic text-foreground/60">{player.bio}</span>
                                            </>
                                        )}
                                    </div>

                                    {/* ── Location ── */}
                                    <div className="border-t border-divider pt-3">
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
                                            <Button
                                                size="sm"
                                                variant="light"
                                                className="text-xs shrink-0"
                                                onPress={() => setShowLocationModal(true)}
                                            >
                                                {player.state ? "Change" : "Set"}
                                            </Button>
                                        </div>
                                    </div>

                                    <LocationModal
                                        isOpen={showLocationModal}
                                        onComplete={() => setShowLocationModal(false)}
                                        blocking={false}
                                    />

                                    {/* ── Emails ── */}
                                    <div className="border-t border-divider pt-3 space-y-2">
                                        {/* Primary Email */}
                                        <div className="min-w-0">
                                            <p className="text-[10px] text-foreground/40 uppercase">Main Gmail</p>
                                            <p className="text-sm truncate">{profile.email}</p>
                                            <p className="text-[10px] text-foreground/30 mt-0.5">Used to link & transfer wallet across games</p>
                                        </div>

                                        {/* Secondary Email */}
                                        {profile.secondaryEmail ? (
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[10px] text-foreground/40 uppercase">Secondary Email</p>
                                                    <p className="text-sm truncate">{profile.secondaryEmail}</p>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <Button
                                                        size="sm" variant="flat" color="primary"
                                                        isIconOnly
                                                        title="Swap — make secondary the primary"
                                                        isDisabled={emailSaving}
                                                        onPress={async () => {
                                                            setEmailSaving(true);
                                                            try {
                                                                const res = await fetch("/api/profile/secondary-email", {
                                                                    method: "POST",
                                                                    headers: { "Content-Type": "application/json" },
                                                                    body: JSON.stringify({ action: "SWAP" }),
                                                                });
                                                                const json = await res.json();
                                                                if (res.ok) {
                                                                    if (json.data?.email) {
                                                                        await updateSession({ email: json.data.email });
                                                                    }
                                                                    toast.success(json.message);
                                                                    queryClient.invalidateQueries({ queryKey: ["profile"] });
                                                                } else {
                                                                    toast.error(json.message || "Failed");
                                                                }
                                                            } catch { toast.error("Network error"); }
                                                            finally { setEmailSaving(false); }
                                                        }}
                                                    >
                                                        <ArrowRightLeft className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        size="sm" variant="flat" color="danger"
                                                        isIconOnly
                                                        title="Remove secondary email"
                                                        isDisabled={emailSaving}
                                                        onPress={async () => {
                                                            setEmailSaving(true);
                                                            try {
                                                                const res = await fetch("/api/profile/secondary-email", {
                                                                    method: "POST",
                                                                    headers: { "Content-Type": "application/json" },
                                                                    body: JSON.stringify({ action: "REMOVE" }),
                                                                });
                                                                const json = await res.json();
                                                                if (res.ok) {
                                                                    if (json.data?.requireSignOut) {
                                                                        setShowSignOutModal(true);
                                                                        return;
                                                                    }
                                                                    toast.success("Secondary email removed");
                                                                    queryClient.invalidateQueries({ queryKey: ["profile"] });
                                                                } else {
                                                                    toast.error(json.message || "Failed");
                                                                }
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
                                                    size="sm"
                                                    variant="flat"
                                                    type="email"
                                                    isDisabled={emailSaving}
                                                    isInvalid={!!emailError}
                                                    errorMessage={emailError}
                                                    classNames={{
                                                        inputWrapper: "bg-default-100 border border-divider",
                                                    }}
                                                    startContent={<Mail className="h-3.5 w-3.5 text-foreground/30" />}
                                                />
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm" variant="flat"
                                                        onPress={() => { setShowEmailInput(false); setNewSecondaryEmail(""); setEmailError(""); }}
                                                        isDisabled={emailSaving}
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        size="sm" color="primary"
                                                        className="flex-1"
                                                        isLoading={emailSaving}
                                                        isDisabled={!newSecondaryEmail.includes("@")}
                                                        onPress={async () => {
                                                            setEmailSaving(true);
                                                            setEmailError("");
                                                            try {
                                                                const res = await fetch("/api/profile/secondary-email", {
                                                                    method: "POST",
                                                                    headers: { "Content-Type": "application/json" },
                                                                    body: JSON.stringify({ action: "ADD", email: newSecondaryEmail.trim() }),
                                                                });
                                                                const json = await res.json();
                                                                if (res.ok) {
                                                                    toast.success(json.message);
                                                                    setShowEmailInput(false);
                                                                    setNewSecondaryEmail("");
                                                                    queryClient.invalidateQueries({ queryKey: ["profile"] });
                                                                } else {
                                                                    setEmailError(json.message || "Failed to add email");
                                                                }
                                                            } catch { setEmailError("Network error"); }
                                                            finally { setEmailSaving(false); }
                                                        }}
                                                    >
                                                        Add Email
                                                    </Button>
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
                                </div>
                            )}
                        </CardBody>
                    </Card>
                )}

                {GAME.pasteOnlyIGN && ignTutorial.Modal}

                {/* Royal Pass Purchase Modal */}
                <AnimatePresence>
                    {showRPModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                onClick={() => setShowRPModal(false)}
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="relative w-full max-w-sm rounded-2xl border border-yellow-500/20 bg-gradient-to-b from-yellow-950/80 to-background/95 p-6 shadow-2xl shadow-yellow-500/10 backdrop-blur-xl"
                            >
                                <div className="text-center space-y-5">
                                    <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-lg shadow-yellow-500/20 mx-auto">
                                        <Crown className="h-7 w-7 text-black" />
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-bold text-yellow-400">{GAME.passName}</h3>
                                        <div className="flex items-center justify-center gap-2 mt-2">
                                            <span className="text-foreground/40 line-through text-base">{rpOrigPrice} <CurrencyIcon size={12} /></span>
                                            <span className="text-2xl font-black text-yellow-400">{rpPrice} <CurrencyIcon size={16} /></span>
                                            {rpDiscountPercent > 0 && (
                                                <span className="px-2 py-0.5 rounded-full bg-red-500/90 text-white text-[10px] font-bold">
                                                    {rpDiscountPercent}% OFF
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-left text-sm">
                                        <div className="flex items-center gap-2.5 rounded-lg bg-yellow-500/8 px-3 py-2.5">
                                            <ImagePlus className="h-4 w-4 text-yellow-400 shrink-0" />
                                            <span className="text-foreground/70">Custom character image</span>
                                        </div>
                                        <div className="flex items-center gap-2.5 rounded-lg bg-yellow-500/8 px-3 py-2.5">
                                            <Flame className="h-4 w-4 text-yellow-400 shrink-0" />
                                            <span className="text-foreground/70">Streak bonus rewards</span>
                                        </div>
                                        <div className="flex items-center gap-2.5 rounded-lg bg-yellow-500/8 px-3 py-2.5">
                                            <Crown className="h-4 w-4 text-yellow-400 shrink-0" />
                                            <span className="text-foreground/70">Crown badge on profile</span>
                                        </div>
                                    </div>

                                    {player?.wallet && player.wallet.balance < rpPrice && (
                                        <p className="text-xs text-red-400">
                                            You need {rpPrice - player.wallet.balance} more <CurrencyIcon size={12} /> (Balance: {player.wallet.balance} <CurrencyIcon size={12} />)
                                        </p>
                                    )}

                                    <div className="flex gap-2 pt-1">
                                        <Button
                                            variant="flat"
                                            className="flex-1"
                                            onPress={() => setShowRPModal(false)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold"
                                            isDisabled={!player?.wallet || player.wallet.balance < rpPrice || isBuyingRP}
                                            isLoading={isBuyingRP}
                                            onPress={async () => {
                                                if (isBuyingRP) return;
                                                setIsBuyingRP(true);
                                                try {
                                                    const res = await fetch("/api/royal-pass/buy", { method: "POST" });
                                                    const json = await res.json();
                                                    if (res.ok) {
                                                        toast.success(`${GAME.passName} activated! ${GAME.passEmoji}`);
                                                        setShowRPModal(false);
                                                        await queryClient.invalidateQueries({ queryKey: ["profile"] });
                                                        setTimeout(() => characterInputRef.current?.click(), 500);
                                                    } else {
                                                        toast.error(json.message || "Purchase failed");
                                                    }
                                                } catch {
                                                    toast.error("Network error");
                                                } finally {
                                                    setIsBuyingRP(false);
                                                }
                                            }}
                                        >
                                            {GAME.passEmoji} Buy for {rpPrice} <CurrencyIcon size={14} />
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Character Image Preview Modal */}
                {previewCharacter && player && stats && (
                    <CharacterPreviewModal
                        isOpen={showCharacterPreview}
                        onClose={() => {
                            setShowCharacterPreview(false);
                            setPendingCharacterFile(null);
                            setPreviewCharacter(null);
                        }}
                        onConfirm={async (file: File, cropParams?: { x: number; y: number; w: number; h: number }) => {
                            setUploadingCharacter(true);
                            try {
                                const isVideo = file.type.startsWith("video/");

                                if (isVideo) {
                                    // Upload video directly to Cloudinary from client
                                    // (bypasses Vercel's 4.5MB body size limit)
                                    const cfgRes = await fetch("/api/cloudinary-config");
                                    if (!cfgRes.ok) {
                                        toast.error("Upload not configured");
                                        return;
                                    }
                                    const { cloudName, uploadPreset } = await cfgRes.json();

                                    const cloudFd = new FormData();
                                    cloudFd.append("file", file);
                                    cloudFd.append("upload_preset", uploadPreset);
                                    cloudFd.append("folder", "character_images");
                                    cloudFd.append("resource_type", "video");

                                    const cloudRes = await fetch(
                                        `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
                                        { method: "POST", body: cloudFd }
                                    );
                                    const cloudData = await cloudRes.json();

                                    if (!cloudRes.ok || cloudData.error) {
                                        toast.error(cloudData.error?.message || "Video upload failed");
                                        return;
                                    }

                                    // Save the Cloudinary result to our DB via a lightweight API call
                                    // Apply crop params as Cloudinary URL transformation if user adjusted zoom/position
                                    let finalUrl = cloudData.secure_url;
                                    if (cropParams) {
                                        // Crop to user selection so the stored video matches their preview
                                        finalUrl = cloudData.secure_url.replace(
                                            "/upload/",
                                            `/upload/c_crop,x_${cropParams.x},y_${cropParams.y},w_${cropParams.w},h_${cropParams.h}/`
                                        );
                                    }

                                    const saveRes = await fetch("/api/profile/upload-character-image", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                            cloudinaryUrl: finalUrl,
                                            publicId: cloudData.public_id,
                                            isVideo: true,
                                        }),
                                    });

                                    if (saveRes.ok) {
                                        toast.success("Character video updated!");
                                        queryClient.invalidateQueries({ queryKey: ["profile"] });
                                        queryClient.invalidateQueries({ queryKey: ["players"] });
                                    } else if (saveRes.status === 403) {
                                        toast.error(`${GAME.passName} required`);
                                    } else {
                                        toast.error("Failed to save video");
                                    }
                                } else {
                                    // Image: upload through the server (already small after client-side crop)
                                    const fd = new FormData();
                                    fd.append("image", file);
                                    const res = await fetch("/api/profile/upload-character-image", { method: "POST", body: fd });
                                    if (res.ok) {
                                        toast.success("Character image updated!");
                                        queryClient.invalidateQueries({ queryKey: ["profile"] });
                                        queryClient.invalidateQueries({ queryKey: ["players"] });
                                    } else if (res.status === 403) {
                                        toast.error(`${GAME.passName} required`);
                                    } else {
                                        toast.error("Upload failed");
                                    }
                                }
                            } catch {
                                toast.error("Network error");
                            } finally {
                                setUploadingCharacter(false);
                                setShowCharacterPreview(false);
                                setPendingCharacterFile(null);
                                setPreviewCharacter(null);
                            }
                        }}
                        uploading={uploadingCharacter}
                        previewUrl={previewCharacter.url}
                        isVideo={previewCharacter.isVideo}
                        playerName={name}
                        username={profile.username}
                        imageUrl={profile.imageUrl}
                        category={player.category}
                        hasRoyalPass={player.hasRoyalPass}
                        bio={player.bio}
                        stats={{
                            kd: stats.kd,
                            kills: stats.kills,
                            matches: stats.matches,
                            balance: player.wallet.balance,
                        }}
                    />
                )}



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
                                        onPress={() => handleSignOut()}
                                        className="font-bold"
                                    >
                                        Sign Out & Re-login
                                    </Button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Sign Out */}
                <div className="mt-6 pb-20 lg:pb-4">
                    <Button
                        color="danger" variant="flat" fullWidth
                        startContent={<LogOut className="h-4 w-4" />}
                        onPress={() => handleSignOut()}
                    >
                        Sign Out
                    </Button>
                </div>
            </div>
        </div>
    );
}
