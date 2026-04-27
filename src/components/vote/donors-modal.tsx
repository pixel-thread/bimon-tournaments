"use client";

import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
import { Heart, User, Ticket } from "lucide-react";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";

interface Donation {
    amount: number;
    playerName: string | null;
    isAnonymous: boolean;
}

interface SponsorCoupon {
    sponsorName: string;
    discountPct: number;
    maxDiscount: number;
    description: string;
    status: string;
}

interface DonorsModalProps {
    isOpen: boolean;
    onClose: () => void;
    donations: Donation[];
    total: number;
    tournamentName: string;
    sponsorCoupon?: SponsorCoupon | null;
}

export function DonorsModal({ isOpen, onClose, donations, total, tournamentName, sponsorCoupon }: DonorsModalProps) {
    // Sort by biggest donation first
    const sorted = [...donations].sort((a, b) => b.amount - a.amount);

    return (
        <Modal isOpen={isOpen} onClose={onClose} placement="center" size="sm" scrollBehavior="inside">
            <ModalContent>
                <ModalHeader className="flex items-center gap-2 text-base pb-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                        <Heart className="w-3.5 h-3.5 text-white fill-white" />
                    </div>
                    Prize Pool Donors
                </ModalHeader>

                <ModalBody className="px-5 py-3 space-y-3">
                    {/* Tournament name */}
                    <p className="text-xs text-foreground/50">{tournamentName}</p>

                    {/* Total */}
                    <div className="flex items-center justify-between bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/30 px-4 py-3 rounded-xl border border-pink-200/50 dark:border-pink-800/30">
                        <span className="text-sm font-medium text-foreground/60">Total Donated</span>
                        <span className="text-lg font-bold inline-flex items-center gap-1 text-pink-600 dark:text-pink-400">
                            {total} <CurrencyIcon size={16} />
                        </span>
                    </div>

                    {/* Donors list */}
                    <div className="space-y-1.5">
                        {sorted.map((d, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-3 p-3 rounded-xl bg-default-50 hover:bg-default-100 transition-colors"
                            >
                                {/* Rank */}
                                <span className="text-xs font-mono text-foreground/30 w-4 text-right">
                                    {i + 1}
                                </span>

                                {/* Icon */}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    i === 0
                                        ? "bg-gradient-to-br from-amber-400 to-amber-600"
                                        : i === 1
                                            ? "bg-gradient-to-br from-gray-300 to-gray-500"
                                            : i === 2
                                                ? "bg-gradient-to-br from-orange-400 to-orange-600"
                                                : "bg-default-200"
                                }`}>
                                    {d.isAnonymous ? (
                                        <User className="w-4 h-4 text-white" />
                                    ) : (
                                        <Heart className={`w-4 h-4 ${i < 3 ? "text-white fill-white" : "text-foreground/50"}`} />
                                    )}
                                </div>

                                {/* Name */}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${d.isAnonymous ? "italic text-foreground/50" : ""}`}>
                                        {d.isAnonymous ? "Anonymous" : (d.playerName || "Community")}
                                    </p>
                                </div>

                                {/* Amount */}
                                <span className="text-sm font-bold inline-flex items-center gap-1 text-pink-600 dark:text-pink-400 flex-shrink-0">
                                    {d.amount} <CurrencyIcon size={12} />
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Sponsor Coupon — special row */}
                    {sponsorCoupon && (
                        <div className="mt-2 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/50 dark:border-amber-800/30">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                                    <Ticket className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 truncate">
                                        {sponsorCoupon.sponsorName || "Sponsor"}
                                    </p>
                                    <p className="text-xs text-foreground/50">
                                        {sponsorCoupon.description}
                                    </p>
                                </div>
                                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-lg flex-shrink-0">
                                    🎟️ Coupon
                                </span>
                            </div>
                            <p className="text-[10px] text-foreground/40 mt-2 ml-11">
                                Awarded to 1st place captain
                            </p>
                        </div>
                    )}

                    {donations.length === 0 && !sponsorCoupon && (
                        <div className="text-center py-8 text-foreground/40 text-sm">
                            No donations yet. Be the first! 💖
                        </div>
                    )}
                </ModalBody>

                <ModalFooter className="px-5 pb-5">
                    <Button variant="flat" className="w-full" onPress={onClose}>
                        Close
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
