"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Card,
    CardBody,
    Chip,
    Skeleton,
    Button,
} from "@heroui/react";
import {
    Crown,
    AlertCircle,
    Flame,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";
import { t } from "@/lib/translations";

interface RoyalPassInfo {
    hasRoyalPass: boolean;
    currentStreak: number;
    nextRewardAt: number;
    totalRewards: number;
    pendingRewards: {
        id: string;
        type: string;
        amount: number;
        isPending: boolean;
        createdAt: string;
    }[];
}



/**
 * /app/royal-pass — Royal Pass rewards page.
 */
export default function RoyalPassPage() {
    const queryClient = useQueryClient();
    const [isPurchasing, setIsPurchasing] = useState(false);

    const { data, isLoading, error } = useQuery<RoyalPassInfo>({
        queryKey: ["royal-pass"],
        queryFn: async () => {
            const res = await fetch("/api/royal-pass");
            if (!res.ok) throw new Error("Failed");
            const json = await res.json();
            return json.data;
        },
        staleTime: 60 * 1000,
    });

    // Fetch RP prices from settings (dynamic)
    const { data: settingsData } = useQuery<{ elitePassPrice: number; elitePassOrigPrice: number; streakRewardAmount: number }>({
        queryKey: ["settings-rp-price"],
        queryFn: async () => {
            const res = await fetch("/api/settings/public");
            if (!res.ok) throw new Error("Failed");
            const json = await res.json();
            return json.data;
        },
        staleTime: 5 * 60 * 1000,
    });
    const RP_PRICE_DISCOUNTED = settingsData?.elitePassPrice ?? 5;
    const RP_PRICE_FULL = settingsData?.elitePassOrigPrice ?? 20;
    const rpDiscountPercent = RP_PRICE_FULL > RP_PRICE_DISCOUNTED ? Math.round((1 - RP_PRICE_DISCOUNTED / RP_PRICE_FULL) * 100) : 0;
    const streakReward = settingsData?.streakRewardAmount ?? 30;

    const lostDiscount = (data?.currentStreak ?? 0) >= (data?.nextRewardAt ?? 8);
    const rpPrice = lostDiscount ? RP_PRICE_FULL : RP_PRICE_DISCOUNTED;

    const handleBuyRP = async () => {
        setIsPurchasing(true);
        try {
            const res = await fetch("/api/royal-pass/buy", { method: "POST" });
            const json = await res.json();
            if (res.ok) {
                toast.success(`🎉 ${GAME.passName} purchased!`);
                queryClient.invalidateQueries({ queryKey: ["royal-pass"] });
                queryClient.invalidateQueries({ queryKey: ["profile"] });
            } else {
                toast.error(json.message || "Purchase failed");
            }
        } catch {
            toast.error("Purchase failed. Please try again.");
        } finally {
            setIsPurchasing(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-4 pb-24 sm:pb-6">
            {/* Promo Banner — only show if user doesn't have Royal Pass AND hasn't lost discount */}
            {data && !data.hasRoyalPass && !lostDiscount && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg bg-gradient-to-r from-red-500 to-orange-500 py-2 px-4 text-center text-sm font-medium text-white"
                >
                    <span className="line-through opacity-75">{RP_PRICE_FULL} <CurrencyIcon size={12} /></span>{" → "}{RP_PRICE_DISCOUNTED} <CurrencyIcon size={12} />{rpDiscountPercent > 0 && <span className="ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-bold">{rpDiscountPercent}% OFF</span>}
                </motion.div>
            )}

            {/* Header */}
            <div className="text-center">
                <div className="mx-auto mb-2 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-500">
                    <Crown className="h-8 w-8 text-white" />
                </div>
                <h1 className="bg-gradient-to-r from-yellow-500 to-amber-500 bg-clip-text text-2xl font-bold text-transparent">
                    {GAME.passName}
                </h1>
                <p className="text-sm text-foreground/50">Play tournaments, earn <CurrencyIcon size={13} />!</p>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-lg bg-danger-50 p-4 text-sm text-danger dark:bg-danger-50/10">
                    <AlertCircle className="h-4 w-4" />
                    Failed to load {GAME.passName} data.
                </div>
            )}

            {isLoading && (
                <div className="space-y-4">
                    <Skeleton className="h-48 w-full rounded-2xl" />
                    <Skeleton className="h-32 w-full rounded-2xl" />
                </div>
            )}

            {data && (
                <>
                    {/* Streak Progress Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <Card className="relative overflow-hidden border border-orange-200 dark:border-orange-800/30">
                            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-red-500/5 to-amber-500/5" />
                            <CardBody className="relative space-y-3 p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Flame className="h-5 w-5 text-orange-500" />
                                        <span className="text-sm font-semibold">Tournament Streak</span>
                                    </div>
                                    <Chip
                                        size="sm"
                                        variant="bordered"
                                        classNames={{
                                            base: "border-orange-300 dark:border-orange-700",
                                            content: "text-orange-600 dark:text-orange-400",
                                        }}
                                    >
                                        {data.currentStreak}/{data.nextRewardAt} 🔥
                                    </Chip>
                                </div>

                                {/* Segmented progress bar with streak reward goal */}
                                {(() => {
                                    const streakComplete = data.currentStreak >= data.nextRewardAt;
                                    const wasting = streakComplete && !data.hasRoyalPass;
                                    return (
                                        <>
                                            {wasting && (
                                                <style>{`
                                                    @keyframes pillGrow {
                                                        0%, 100% { flex-grow: 1; }
                                                        30% { flex-grow: 2.5; }
                                                        50% { flex-grow: 1; }
                                                    }
                                                    @keyframes textPop {
                                                        0%, 30% { transform: scale(1); }
                                                        38% { transform: scale(1.2); }
                                                        46% { transform: scale(1); }
                                                        100% { transform: scale(1); }
                                                    }
                                                `}</style>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <div className="flex flex-1 gap-1">
                                                    {Array.from({ length: data.nextRewardAt }).map((_, i) => {
                                                        const isFilled = i < data.currentStreak;
                                                        const isLastPill = i === data.nextRewardAt - 1;
                                                        return (
                                                            <div
                                                                key={i}
                                                                className={`h-3 rounded-full ${isFilled
                                                                    ? "bg-gradient-to-r from-orange-400 to-red-500"
                                                                    : "bg-default-200 dark:bg-default-100"
                                                                    }`}
                                                                style={isLastPill && wasting
                                                                    ? { flex: "1", animation: "pillGrow 3.5s ease-in-out infinite" }
                                                                    : { flex: "1" }
                                                                }
                                                            />
                                                        );
                                                    })}
                                                </div>
                                                <span
                                                    className={`font-bold shrink-0 ${wasting
                                                        ? "text-base text-amber-400"
                                                        : "text-sm text-amber-500"
                                                        }`}
                                                    style={wasting ? {
                                                        animation: "textPop 3.5s ease-in-out infinite",
                                                    } : undefined}
                                                >
                                                    {wasting ? `Free ${streakReward} ${GAME.currencyPlural}` : `${streakReward} ${GAME.currencyPlural}`}
                                                </span>
                                            </div>
                                        </>
                                    );
                                })()}

                                <p className="text-center text-xs text-foreground/50">
                                    {data.hasRoyalPass
                                        ? t("rpStreakDesc", { count: data.nextRewardAt, reward: streakReward, currency: GAME.currencyPlural })
                                        : t("rpGetToEarn", { passName: GAME.passName, reward: streakReward, currency: GAME.currencyPlural, count: data.nextRewardAt })}
                                </p>
                            </CardBody>
                        </Card>
                    </motion.div>

                    {/* Claim Streak Reward — show when there's an unclaimed STREAK reward */}
                    {(() => {
                        const unclaimedStreak = data.pendingRewards.find(r => r.type === "STREAK" && r.isPending);
                        if (!unclaimedStreak) return null;
                        return (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.05, type: "spring", stiffness: 300, damping: 20 }}
                            >
                                <Card className="relative overflow-hidden border-2 border-amber-400 dark:border-amber-500 shadow-lg shadow-amber-500/20">
                                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-yellow-500/10 to-orange-500/10" />
                                    <CardBody className="relative p-5 text-center space-y-3">
                                        <motion.div
                                            animate={{ scale: [1, 1.15, 1] }}
                                            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                            className="text-4xl"
                                        >
                                            🎉
                                        </motion.div>
                                        <div>
                                            <p className="font-bold text-lg text-amber-500">Streak Reward Ready!</p>
                                            <p className="text-sm text-foreground/60 mt-1">
                                                You earned <span className="font-bold text-amber-400">{unclaimedStreak.amount} <CurrencyIcon size={13} /></span> for your {data.nextRewardAt} tournament streak!
                                            </p>
                                        </div>
                                        <Button
                                            className="w-full font-bold text-black bg-gradient-to-r from-amber-400 to-yellow-500 shadow-lg shadow-amber-500/30"
                                            size="lg"
                                            isLoading={isPurchasing}
                                            startContent={!isPurchasing && <span className="text-lg">🎁</span>}
                                            onPress={async () => {
                                                setIsPurchasing(true);
                                                try {
                                                    const res = await fetch(`/api/rewards/${unclaimedStreak.id}/claim`, { method: "POST" });
                                                    const json = await res.json();
                                                    if (res.ok) {
                                                        toast.success(`🔥 ${unclaimedStreak.amount} ${GAME.currencyPlural} claimed!`);
                                                        queryClient.invalidateQueries({ queryKey: ["royal-pass"] });
                                                        queryClient.invalidateQueries({ queryKey: ["profile"] });
                                                        queryClient.invalidateQueries({ queryKey: ["notification-count"] });
                                                    } else {
                                                        toast.error(json.message || "Failed to claim");
                                                    }
                                                } catch {
                                                    toast.error("Failed to claim reward");
                                                } finally {
                                                    setIsPurchasing(false);
                                                }
                                            }}
                                        >
                                            Claim {unclaimedStreak.amount} <CurrencyIcon size={14} />
                                        </Button>
                                    </CardBody>
                                </Card>
                            </motion.div>
                        );
                    })()}

                    {/* Already has RP */}
                    {data.hasRoyalPass ? (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 }}
                        >
                            <Card className="border border-green-200 bg-gradient-to-r from-green-500/10 to-emerald-500/10 dark:border-green-800/30">
                                <CardBody className="p-4 text-center">
                                    <Crown className="mx-auto mb-2 h-8 w-8 text-amber-500" />
                                    <p className="font-semibold text-green-600 dark:text-green-400">
                                        You have {GAME.passName}! {GAME.passEmoji}
                                    </p>
                                </CardBody>
                            </Card>
                        </motion.div>
                    ) : (
                        /* Buy RP — unified button */
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 }}
                        >
                            <Button
                                onPress={handleBuyRP}
                                isLoading={isPurchasing}
                                className={`w-full font-bold text-white ${lostDiscount
                                    ? "bg-gradient-to-r from-purple-500 to-pink-500"
                                    : "bg-gradient-to-r from-yellow-500 to-amber-500"
                                    }`}
                                size="lg"
                                startContent={!isPurchasing && <Crown className="h-4 w-4" />}
                            >
                                {isPurchasing ? "Purchasing..." : `Get ${GAME.passName} — ${rpPrice}`} <CurrencyIcon size={13} />
                            </Button>
                        </motion.div>
                    )}



                    {/* How it works */}
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="space-y-2 text-sm text-foreground/50"
                    >
                        <p className="font-medium text-foreground">{t("rpHowItWorks")}</p>
                        <ul className="list-inside list-disc space-y-1">
                            <li>{t("rpStep1")}</li>
                            <li>{t("rpStep2")}</li>
                            <li>{t("rpStep3")}</li>
                            <li>{t("rpStep4", { count: data?.nextRewardAt ?? 8, reward: `${streakReward}` })} <CurrencyIcon size={12} /></li>
                            <li className="text-amber-600 dark:text-amber-400">
                                {t("rpStep5")}
                            </li>
                        </ul>
                    </motion.div>
                </>
            )}
        </div>
    );
}
