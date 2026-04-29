"use client";

import { useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Switch } from "@heroui/react";
import { Heart, Eye, EyeOff, Ticket, User } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";

interface DonateModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournamentId: string;
    tournamentName: string;
    playerName?: string;
    pollId?: string;
    allowSquads?: boolean;
    isCouponVerifier?: boolean;
    hasCoupon?: boolean;
}

export function DonateModal({
    isOpen,
    onClose,
    tournamentId,
    tournamentName,
    playerName = "You",
    pollId,
    allowSquads = false,
    isCouponVerifier = false,
    hasCoupon = false,
}: DonateModalProps) {
    const [amount, setAmount] = useState("");
    const [isAnonymous, setIsAnonymous] = useState(false);
    // Tab: "uc" for UC donation, "coupon" for coupon (only for verifiers on ranked polls)
    const canAddCoupon = isCouponVerifier && allowSquads && !hasCoupon;
    const [tab, setTab] = useState<"uc" | "coupon">("uc");
    // Coupon form state
    const [sponsorName, setSponsorName] = useState("");
    const [discountPct, setDiscountPct] = useState("10");
    const [maxDiscount, setMaxDiscount] = useState("200");
    const [expiryDays, setExpiryDays] = useState("180");

    const queryClient = useQueryClient();

    // Fetch wallet balance (same source as wallet page)
    const { data: walletData } = useQuery({
        queryKey: ["wallet"],
        queryFn: async () => {
            const res = await fetch("/api/profile");
            if (!res.ok) return { available: 0 };
            const json = await res.json();
            return { available: json.data?.player?.wallet?.balance ?? 0 };
        },
        enabled: isOpen,
        staleTime: 30_000,
    });

    const ucMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/tournaments/${tournamentId}/donations/self`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: parseInt(amount), isAnonymous }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error || "Failed to donate");
            }
            return res.json();
        },
        onSuccess: (data) => {
            toast.success(data.message || "Donation successful! 🎉");
            queryClient.invalidateQueries({ queryKey: ["polls"] });
            queryClient.invalidateQueries({ queryKey: ["wallet"] });
            queryClient.invalidateQueries({ queryKey: ["profile"] });
            queryClient.invalidateQueries({ queryKey: ["auth-user"] });
            handleClose();
        },
        onError: (err) => {
            const message = err instanceof Error ? err.message : "Failed to donate";
            const isBalance = message.toLowerCase().includes("insufficient");
            toast.error(message, {
                duration: 5000,
                ...(isBalance && {
                    action: {
                        label: `Add ${GAME.currency}`,
                        onClick: () => window.location.assign("/wallet"),
                    },
                }),
            });
        },
    });

    const couponMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/coupons", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pollId,
                    discountPct: parseInt(discountPct) || 10,
                    maxDiscount: parseInt(maxDiscount) || 200,
                    sponsorName: sponsorName.trim(),
                    expiryDays: parseInt(expiryDays) || 180,
                }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.message || "Failed to add coupon");
            }
            return res.json();
        },
        onSuccess: (data) => {
            toast.success(data.message || "Coupon added! 🎟️");
            queryClient.invalidateQueries({ queryKey: ["polls"] });
            handleClose();
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to add coupon");
        },
    });

    const handleClose = () => {
        setAmount("");
        setIsAnonymous(false);
        setTab("uc");
        setSponsorName("");
        setDiscountPct("10");
        setMaxDiscount("200");
        setExpiryDays("180");
        onClose();
    };

    const parsedAmount = parseInt(amount) || 0;
    const isUcValid = parsedAmount > 0 && parsedAmount <= (walletData?.available ?? 0);
    const isCouponValid = sponsorName.trim().length > 0 && parseInt(discountPct) > 0 && parseInt(maxDiscount) > 0;
    const quickAmounts = [5, 10, 20, 50];
    const isPending = ucMutation.isPending || couponMutation.isPending;

    const expiryOptions = [
        { label: "1 month", value: "30" },
        { label: "3 months", value: "90" },
        { label: "6 months", value: "180" },
        { label: "1 year", value: "365" },
    ];

    return (
        <Modal isOpen={isOpen} onClose={handleClose} placement="center" size="sm">
            <ModalContent>
                <ModalHeader className="flex items-center gap-2 text-base pb-2">
                    <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${tab === "coupon" ? "from-amber-500 to-orange-600" : "from-pink-500 to-rose-500"} flex items-center justify-center`}>
                        {tab === "coupon" ? (
                            <Ticket className="w-3.5 h-3.5 text-white" />
                        ) : (
                            <Heart className="w-3.5 h-3.5 text-white fill-white" />
                        )}
                    </div>
                    {tab === "coupon" ? "Add Coupon Reward" : "Donate to Prize Pool"}
                </ModalHeader>

                <ModalBody className="px-5 py-3 space-y-4">
                    {/* Tournament name */}
                    <p className="text-sm text-foreground/60">
                        {tournamentName}
                    </p>

                    {/* Tab switcher — only show if verifier can add coupon */}
                    {canAddCoupon && (
                        <div className="flex items-center gap-1 p-1 rounded-xl bg-default-100">
                            <button
                                type="button"
                                onClick={() => setTab("uc")}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                                    tab === "uc" ? "bg-background shadow-sm text-foreground" : "text-foreground/50 hover:text-foreground/70"
                                }`}
                            >
                                <CurrencyIcon size={14} />
                                <span>Donate UC</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setTab("coupon")}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                                    tab === "coupon" ? "bg-background shadow-sm text-foreground" : "text-foreground/50 hover:text-foreground/70"
                                }`}
                            >
                                <Ticket className="w-3.5 h-3.5" />
                                <span>Add Coupon</span>
                            </button>
                        </div>
                    )}

                    {tab === "uc" ? (
                        <>
                            {/* Amount input */}
                            <div>
                                <label className="text-xs font-medium text-foreground/50 uppercase tracking-wide mb-1.5 block">
                                    Amount
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min={1}
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                                        placeholder="0"
                                        disabled={isPending}
                                        className="w-full text-2xl font-bold text-center py-3 px-4 rounded-xl border-2 border-default-200 focus:border-primary focus:outline-none bg-default-50 transition-colors tabular-nums"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/40">
                                        <CurrencyIcon size={18} />
                                    </span>
                                </div>
                            </div>

                            {/* Quick amount buttons */}
                            <div className="flex gap-2">
                                {quickAmounts.map((qa) => (
                                    <button
                                        key={qa}
                                        type="button"
                                        onClick={() => setAmount(String(qa))}
                                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all border cursor-pointer ${
                                            parsedAmount === qa
                                                ? "bg-primary text-white border-primary shadow-sm"
                                                : "bg-default-100 text-foreground/70 border-default-200 hover:bg-default-200"
                                        }`}
                                    >
                                        {qa}
                                    </button>
                                ))}
                            </div>

                            {/* Balance */}
                            <div className="flex items-center justify-between text-sm bg-default-50 px-3 py-2.5 rounded-lg">
                                <span className="text-foreground/50">Your balance</span>
                                <span className="font-semibold inline-flex items-center gap-1">
                                    {walletData?.available ?? "..."} <CurrencyIcon size={13} />
                                </span>
                            </div>

                            {/* Anonymous toggle */}
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2 text-sm">
                                    {isAnonymous ? (
                                        <EyeOff className="w-4 h-4 text-foreground/40" />
                                    ) : (
                                        <Eye className="w-4 h-4 text-foreground/40" />
                                    )}
                                    <span className="text-foreground/70">Donate anonymously</span>
                                </div>
                                <Switch
                                    size="sm"
                                    isSelected={isAnonymous}
                                    onValueChange={setIsAnonymous}
                                />
                            </div>

                            {/* Live preview — mirrors the donors list styling */}
                            {parsedAmount > 0 && (
                                <div className="bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20 px-3 py-2.5 rounded-xl border border-pink-200/40 dark:border-pink-800/30">
                                    <p className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1.5 font-medium">Preview on donors list</p>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0">
                                            {isAnonymous ? (
                                                <User className="w-4 h-4 text-white" />
                                            ) : (
                                                <Heart className="w-4 h-4 text-white fill-white" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium truncate ${isAnonymous ? "italic text-foreground/50" : ""}`}>
                                                {isAnonymous ? "Anonymous" : playerName}
                                            </p>
                                        </div>
                                        <span className="text-sm font-bold inline-flex items-center gap-1 text-pink-600 dark:text-pink-400 flex-shrink-0">
                                            {parsedAmount} <CurrencyIcon size={12} />
                                        </span>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {/* Coupon form */}
                            <div>
                                <label className="text-xs font-medium text-foreground/50 uppercase tracking-wide mb-1.5 block">
                                    Sponsor / Restaurant Name
                                </label>
                                <input
                                    type="text"
                                    value={sponsorName}
                                    onChange={(e) => setSponsorName(e.target.value)}
                                    placeholder="e.g. My Restaurant"
                                    disabled={isPending}
                                    className="w-full text-sm py-2.5 px-3 rounded-xl border-2 border-default-200 focus:border-primary focus:outline-none bg-default-50 transition-colors"
                                    maxLength={50}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-foreground/50 uppercase tracking-wide mb-1.5 block">
                                        Discount %
                                    </label>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min={1}
                                        max={100}
                                        value={discountPct}
                                        onChange={(e) => setDiscountPct(e.target.value.replace(/[^0-9]/g, ""))}
                                        disabled={isPending}
                                        className="w-full text-sm py-2.5 px-3 rounded-xl border-2 border-default-200 focus:border-primary focus:outline-none bg-default-50 transition-colors tabular-nums text-center"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-foreground/50 uppercase tracking-wide mb-1.5 block">
                                        Max ₹
                                    </label>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min={1}
                                        value={maxDiscount}
                                        onChange={(e) => setMaxDiscount(e.target.value.replace(/[^0-9]/g, ""))}
                                        disabled={isPending}
                                        className="w-full text-sm py-2.5 px-3 rounded-xl border-2 border-default-200 focus:border-primary focus:outline-none bg-default-50 transition-colors tabular-nums text-center"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-foreground/50 uppercase tracking-wide mb-1.5 block">
                                    Expires in
                                </label>
                                <div className="flex gap-2">
                                    {expiryOptions.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setExpiryDays(opt.value)}
                                            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                                                expiryDays === opt.value
                                                    ? "bg-primary text-white border-primary shadow-sm"
                                                    : "bg-default-100 text-foreground/70 border-default-200 hover:bg-default-200"
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Preview */}
                            <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 px-4 py-3 rounded-xl border border-amber-200/50 dark:border-amber-800/30">
                                <div className="flex items-center gap-2 mb-1">
                                    <Ticket className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">Preview</span>
                                </div>
                                <p className="text-sm text-foreground/70">
                                    {parseInt(discountPct) || 0}% off up to ₹{parseInt(maxDiscount) || 0}
                                    {sponsorName.trim() ? ` at ${sponsorName.trim()}` : ""}
                                </p>
                                <p className="text-xs text-foreground/40 mt-1">
                                    Awarded to 1st place captain
                                </p>
                            </div>
                        </>
                    )}
                </ModalBody>

                <ModalFooter className="px-5 pb-5">
                    <Button
                        variant="flat"
                        onPress={handleClose}
                        className="flex-1"
                        isDisabled={isPending}
                    >
                        Cancel
                    </Button>
                    {tab === "uc" ? (
                        <Button
                            color="primary"
                            className="flex-1 font-semibold"
                            isDisabled={!isUcValid || isPending}
                            isLoading={ucMutation.isPending}
                            onPress={() => ucMutation.mutate()}
                            startContent={!ucMutation.isPending && <Heart className="w-4 h-4" />}
                        >
                            Donate {parsedAmount > 0 ? parsedAmount : ""}
                        </Button>
                    ) : (
                        <Button
                            color="warning"
                            className="flex-1 font-semibold"
                            isDisabled={!isCouponValid || isPending}
                            isLoading={couponMutation.isPending}
                            onPress={() => couponMutation.mutate()}
                            startContent={!couponMutation.isPending && <Ticket className="w-4 h-4" />}
                        >
                            Add Coupon
                        </Button>
                    )}
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
