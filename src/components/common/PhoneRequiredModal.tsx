"use client";

import { useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input } from "@heroui/react";
import { Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { GAME } from "@/lib/game-config";

interface PhoneRequiredModalProps {
    isOpen: boolean;
}

export function PhoneRequiredModal({ isOpen }: PhoneRequiredModalProps) {
    const [phone, setPhone] = useState("");
    const [saving, setSaving] = useState(false);
    const [focused, setFocused] = useState(false);
    const queryClient = useQueryClient();

    const digits = phone.replace(/\D/g, "");
    const isValid = digits.length === 10;

    async function handleSave() {
        if (!isValid) { toast.error("Enter a valid 10-digit number"); return; }
        setSaving(true);
        try {
            const res = await fetch("/api/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phoneNumber: digits }),
            });
            const json = await res.json();
            if (!res.ok) { toast.error(json.message || "Failed to save"); return; }
            toast.success("Phone number saved!");
            // Refetch auth user so guard dismisses the modal
            await queryClient.invalidateQueries({ queryKey: ["auth-user"] });
            await queryClient.refetchQueries({ queryKey: ["auth-user"], type: "active" });
        } catch {
            toast.error("Network error. Try again.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            hideCloseButton
            isDismissable={false}
            placement="center"
            size="sm"
        >
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-primary/10">
                            <Phone className="h-4 w-4 text-primary" />
                        </div>
                        <span>Add Your Phone Number</span>
                    </div>
                    <p className="text-xs font-normal text-foreground/50 mt-0.5">
                        We use this to keep you updated on match schedules and results.
                    </p>
                </ModalHeader>

                <ModalBody className="py-3">
                    <Input
                        label="Phone Number"
                        placeholder=""
                        value={phone}
                        onValueChange={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        startContent={
                            <span className="text-sm font-semibold text-foreground/60 select-none pr-1 border-r border-divider mr-1">
                                🇮🇳 +91
                            </span>
                        }
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        isInvalid={phone.length > 0 && !isValid}
                        errorMessage="Enter all 10 digits"
                        color={phone.length > 0 && !isValid ? "danger" : "default"}
                        description={!phone ? "WhatsApp preferred" : undefined}
                        classNames={{ inputWrapper: "pl-1" }}
                    />
                    <div className="flex items-start gap-2 text-xs text-foreground/40 px-1">
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-success/60" />
                        <span>Your number is kept private and never shared publicly.</span>
                    </div>
                </ModalBody>

                <ModalFooter className="pt-1">
                    <Button
                        color="primary"
                        fullWidth
                        isLoading={saving}
                        isDisabled={!isValid}
                        onPress={handleSave}
                        startContent={!saving ? <Phone className="h-4 w-4" /> : undefined}
                    >
                        Save & Continue
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
