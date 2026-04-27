"use client";

import { useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
import { Ticket } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface AddCouponModalProps {
    isOpen: boolean;
    onClose: () => void;
    pollId: string;
    tournamentName: string;
}

export function AddCouponModal({ isOpen, onClose, pollId, tournamentName }: AddCouponModalProps) {
    const [sponsorName, setSponsorName] = useState("");
    const [discountPct, setDiscountPct] = useState("10");
    const [maxDiscount, setMaxDiscount] = useState("200");
    const [expiryDays, setExpiryDays] = useState("180");
    const queryClient = useQueryClient();

    const mutation = useMutation({
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
        setSponsorName("");
        setDiscountPct("10");
        setMaxDiscount("200");
        setExpiryDays("180");
        onClose();
    };

    const isValid = sponsorName.trim().length > 0 && parseInt(discountPct) > 0 && parseInt(maxDiscount) > 0;

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
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                        <Ticket className="w-3.5 h-3.5 text-white" />
                    </div>
                    Add Coupon Reward
                </ModalHeader>

                <ModalBody className="px-5 py-3 space-y-4">
                    {/* Tournament name */}
                    <p className="text-sm text-foreground/60">
                        {tournamentName}
                    </p>

                    {/* Sponsor Name */}
                    <div>
                        <label className="text-xs font-medium text-foreground/50 uppercase tracking-wide mb-1.5 block">
                            Sponsor / Restaurant Name
                        </label>
                        <input
                            type="text"
                            value={sponsorName}
                            onChange={(e) => setSponsorName(e.target.value)}
                            placeholder="e.g. My Restaurant"
                            disabled={mutation.isPending}
                            className="w-full text-sm py-2.5 px-3 rounded-xl border-2 border-default-200 focus:border-primary focus:outline-none bg-default-50 transition-colors"
                            maxLength={50}
                        />
                    </div>

                    {/* Discount + Max Cap */}
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
                                disabled={mutation.isPending}
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
                                disabled={mutation.isPending}
                                className="w-full text-sm py-2.5 px-3 rounded-xl border-2 border-default-200 focus:border-primary focus:outline-none bg-default-50 transition-colors tabular-nums text-center"
                            />
                        </div>
                    </div>

                    {/* Expiry */}
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
                </ModalBody>

                <ModalFooter className="px-5 pb-5">
                    <Button
                        variant="flat"
                        onPress={handleClose}
                        className="flex-1"
                        isDisabled={mutation.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        color="warning"
                        className="flex-1 font-semibold"
                        isDisabled={!isValid || mutation.isPending}
                        isLoading={mutation.isPending}
                        onPress={() => mutation.mutate()}
                        startContent={!mutation.isPending && <Ticket className="w-4 h-4" />}
                    >
                        Add Coupon
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
