"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal, ModalContent, ModalBody, Input, Button } from "@heroui/react";
import { Phone, Shield } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useAuthUser } from "@/hooks/use-auth-user";

/**
 * PhoneGuard — Mandatory phone number collection.
 *
 * If a signed-in player has no phone number, this shows an
 * un-closable, non-skippable modal that blocks the entire app
 * until they provide a valid 10-digit number (defaults to +91 India).
 */
export function PhoneGuard() {
    const { isSignedIn } = useAuthUser();
    const queryClient = useQueryClient();
    const [phone, setPhone] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [ready, setReady] = useState(false);

    // Delay showing the modal so page content renders first
    useEffect(() => {
        const timer = setTimeout(() => setReady(true), 2000);
        return () => clearTimeout(timer);
    }, []);

    const { data: profile } = useQuery<{
        player: {
            phoneNumber: string | null;
        } | null;
    }>({
        queryKey: ["profile"],
        queryFn: async () => {
            const res = await fetch("/api/profile");
            if (!res.ok) return null;
            const json = await res.json();
            return json.data;
        },
        staleTime: 5 * 60 * 1000,
        enabled: !!isSignedIn,
    });

    const needsPhone =
        ready &&
        isSignedIn &&
        !completed &&
        profile?.player &&
        !profile.player.phoneNumber &&
        // Skip if user just completed onboarding (phone was collected there)
        !(typeof window !== "undefined" && Number(localStorage.getItem("onboarded-at") || 0) > Date.now() - 30_000);

    const handleSave = async () => {
        const digits = phone.replace(/\D/g, "");
        if (digits.length < 10) {
            setError("Enter all 10 digits");
            return;
        }
        if (digits.length > 10) {
            setError("Enter exactly 10 digits");
            return;
        }

        setSaving(true);
        setError("");
        try {
            const res = await fetch("/api/profile/update-ign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phoneNumber: digits }),
            });
            if (!res.ok) {
                const json = await res.json();
                setError(json.message || "Failed to save");
                return;
            }
            toast.success("Phone number saved! 📱");
            setCompleted(true);
            queryClient.invalidateQueries({ queryKey: ["profile"] });
            queryClient.invalidateQueries({ queryKey: ["auth-user"] });
        } catch {
            setError("Network error. Try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen={!!needsPhone}
            isDismissable={false}
            hideCloseButton
            placement="center"
            size="sm"
            backdrop="blur"
        >
            <ModalContent>
                <ModalBody className="px-6 py-8">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-5 text-center"
                    >
                        {/* Icon */}
                        <div className="flex justify-center">
                            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                                <Phone className="w-6 h-6 text-primary" />
                            </div>
                        </div>

                        {/* Title */}
                        <div>
                            <h2 className="text-lg font-bold">Phone Number Required</h2>
                            <p className="text-sm text-foreground/50 mt-1">
                                We need your phone number for match coordination
                            </p>
                        </div>

                        {/* Input */}
                        <Input
                            value={phone}
                            onValueChange={(v) => {
                                setPhone(v.replace(/\D/g, "").slice(0, 10));
                                setError("");
                            }}
                            placeholder="9876543210"
                            size="lg"
                            type="tel"
                            inputMode="numeric"
                            maxLength={10}
                            autoFocus
                            isInvalid={!!error}
                            errorMessage={error}
                            description={!error ? "WhatsApp preferred — only visible to you and admins" : undefined}
                            startContent={
                                <span className="text-sm font-semibold text-foreground/60 select-none pr-2 border-r border-divider mr-1 flex items-center gap-1">
                                    <Phone className="h-3 w-3" /> +91
                                </span>
                            }
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && phone.replace(/\D/g, "").length === 10) {
                                    handleSave();
                                }
                            }}
                        />

                        {/* Save */}
                        <Button
                            color="primary"
                            size="lg"
                            className="w-full font-semibold"
                            isDisabled={phone.replace(/\D/g, "").length < 10}
                            isLoading={saving}
                            startContent={!saving ? <Shield className="w-4 h-4" /> : undefined}
                            onPress={handleSave}
                        >
                            {saving ? "Saving..." : "Continue"}
                        </Button>
                    </motion.div>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}
