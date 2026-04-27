"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardBody, Skeleton, Button, Chip } from "@heroui/react";
import { Ticket, CheckCircle, Clock, AlertCircle, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ManagedCoupon {
    id: string;
    code: string;
    discountPct: number;
    maxDiscount: number;
    sponsorName: string;
    description: string;
    status: string;
    expiresAt: string;
    createdAt: string;
    claimedAt: string | null;
    claimedBy: {
        displayName: string;
        customProfileImageUrl: string | null;
    } | null;
    poll: {
        question: string;
        tournament: {
            name: string;
        } | null;
    } | null;
}

const STATUS_CONFIG: Record<string, { color: "warning" | "success" | "default" | "danger"; icon: typeof Clock; label: string }> = {
    AVAILABLE: { color: "warning", icon: Clock, label: "Available" },
    CLAIMED: { color: "success", icon: CheckCircle, label: "Claimed" },
    USED: { color: "default", icon: CheckCircle, label: "Used" },
    EXPIRED: { color: "danger", icon: AlertCircle, label: "Expired" },
};

export default function CouponManagePage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const { data: coupons, isLoading, error } = useQuery<ManagedCoupon[]>({
        queryKey: ["manage-coupons"],
        queryFn: async () => {
            const res = await fetch("/api/coupons/manage");
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            return json.data ?? [];
        },
        staleTime: 30_000,
    });

    const markUsed = useMutation({
        mutationFn: async (couponId: string) => {
            const res = await fetch("/api/coupons/use", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ couponId }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.message || "Failed to mark as used");
            }
            return res.json();
        },
        onSuccess: (data) => {
            toast.success(data.message || "Coupon marked as used!");
            queryClient.invalidateQueries({ queryKey: ["manage-coupons"] });
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed");
        },
    });

    return (
        <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
            {/* Header */}
            <div className="mb-6 space-y-1">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="flex items-center gap-1.5 text-sm text-foreground/50 hover:text-foreground/70 mb-3 transition-colors cursor-pointer"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                        <Ticket className="h-4 w-4 text-white" />
                    </div>
                    <h1 className="text-lg font-bold">Manage Coupons</h1>
                </div>
                <p className="text-sm text-foreground/50">
                    Track and manage your sponsor coupon rewards
                </p>
            </div>

            <div className="space-y-3">
                {/* Loading */}
                {isLoading && (
                    <div className="space-y-3">
                        {[1, 2].map((i) => (
                            <Skeleton key={i} className="h-36 w-full rounded-2xl" />
                        ))}
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 rounded-lg bg-danger-50 p-4 text-sm text-danger dark:bg-danger-50/10">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        Failed to load coupons. Please try again later.
                    </div>
                )}

                {/* Empty */}
                {!isLoading && coupons && coupons.length === 0 && (
                    <div className="flex flex-col items-center gap-3 rounded-xl bg-default-100 py-12 text-center">
                        <Ticket className="h-10 w-10 text-foreground/20" />
                        <div>
                            <p className="font-medium text-foreground/60">No coupons yet</p>
                            <p className="text-sm text-foreground/40">
                                Donate a coupon from any ranked tournament poll
                            </p>
                        </div>
                    </div>
                )}

                {/* Coupon cards */}
                {coupons?.map((coupon, i) => {
                    const statusConf = STATUS_CONFIG[coupon.status] || STATUS_CONFIG.AVAILABLE;
                    const StatusIcon = statusConf.icon;
                    const daysLeft = Math.max(0, Math.ceil((new Date(coupon.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

                    return (
                        <motion.div
                            key={coupon.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                        >
                            <Card className="border border-divider overflow-hidden">
                                <CardBody className="p-4 space-y-3">
                                    {/* Top row: Discount + Status */}
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                                                {coupon.discountPct}% OFF
                                            </p>
                                            <p className="text-xs text-foreground/50">
                                                up to ₹{coupon.maxDiscount} at {coupon.sponsorName}
                                            </p>
                                        </div>
                                        <Chip
                                            size="sm"
                                            color={statusConf.color}
                                            variant="flat"
                                            startContent={<StatusIcon className="w-3 h-3" />}
                                        >
                                            {statusConf.label}
                                        </Chip>
                                    </div>

                                    {/* Tournament */}
                                    {coupon.poll && (
                                        <p className="text-xs text-foreground/40">
                                            Tournament: {coupon.poll.tournament?.name || coupon.poll.question}
                                        </p>
                                    )}

                                    {/* Code + Expiry */}
                                    <div className="flex items-center justify-between bg-default-50 px-3 py-2 rounded-lg">
                                        <div>
                                            <p className="text-[10px] text-foreground/40 uppercase">Code</p>
                                            <p className="text-sm font-mono font-bold tracking-wider">{coupon.code}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-foreground/40 uppercase">Expires in</p>
                                            <p className={`text-sm font-bold ${daysLeft <= 7 ? "text-danger" : "text-foreground/60"}`}>
                                                {daysLeft}d
                                            </p>
                                        </div>
                                    </div>

                                    {/* Claimed by */}
                                    {coupon.claimedBy && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-foreground/40">Claimed by:</span>
                                            <span className="font-semibold">{coupon.claimedBy.displayName}</span>
                                        </div>
                                    )}

                                    {/* Mark as used button — only if claimed */}
                                    {coupon.status === "CLAIMED" && (
                                        <Button
                                            color="success"
                                            variant="flat"
                                            className="w-full font-semibold"
                                            startContent={<CheckCircle className="w-4 h-4" />}
                                            isLoading={markUsed.isPending && markUsed.variables === coupon.id}
                                            isDisabled={markUsed.isPending}
                                            onPress={() => markUsed.mutate(coupon.id)}
                                        >
                                            Mark as Used
                                        </Button>
                                    )}
                                </CardBody>
                            </Card>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
