"use client";

import { useState, useCallback } from "react";
import { Modal, ModalContent, ModalBody, Button } from "@heroui/react";

const DISCORD_BLURPLE = "#5865F2";

/**
 * Hook that provides a comparison modal before linking Discord.
 * Usage:
 *   const { openDiscordModal, DiscordCompareModal } = useDiscordCompareModal();
 *   // Instead of: window.location.href = `/api/discord/authorize?...`
 *   // Use: openDiscordModal("/api/discord/authorize?returnTo=profile")
 *   // Render: <DiscordCompareModal />
 */
export function useDiscordCompareModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [redirectUrl, setRedirectUrl] = useState("");

    const openDiscordModal = useCallback((url: string) => {
        setRedirectUrl(url);
        setIsOpen(true);
    }, []);

    const handleLink = useCallback(() => {
        if (redirectUrl) {
            window.location.href = redirectUrl;
        }
    }, [redirectUrl]);

    const DiscordCompareModal = useCallback(() => (
        <Modal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            placement="center"
            size="lg"
            classNames={{
                backdrop: "bg-black/70 backdrop-blur-sm",
                base: "border border-[#5865F2]/30 mx-3",
            }}
        >
            <ModalContent>
                <ModalBody className="py-6 px-5 space-y-4">
                    {/* Title */}
                    <div className="text-center space-y-1">
                        <h3 className="text-base font-bold">Why Discord?</h3>
                        <p className="text-[11px] text-foreground/40">
                            See why we use Discord for tournaments
                        </p>
                    </div>

                    {/* Comparison Cards */}
                    <div className="grid grid-cols-2 gap-2.5">
                        {/* WhatsApp - Basic */}
                        <div className="rounded-xl border border-divider bg-default-50 p-3 space-y-2.5">
                            <div className="text-center">
                                <div className="text-lg">📱</div>
                                <p className="text-xs font-bold">WhatsApp</p>
                                <p className="text-[9px] text-foreground/30 uppercase tracking-wider">Basic</p>
                            </div>
                            <div className="space-y-1.5">
                                <CompareRow ok>Everyone has it</CompareRow>
                                <CompareRow ok>Easy to use</CompareRow>
                                <CompareRow>Phone number exposed</CompareRow>
                                <CompareRow>Room ID not secure</CompareRow>
                                <CompareRow>Random photos fill up phone gallery</CompareRow>
                                <CompareRow>Too many groups to manage</CompareRow>
                            </div>
                        </div>

                        {/* Discord - Gaming */}
                        <div className="rounded-xl border-2 border-[#5865F2]/40 bg-[#5865F2]/5 p-3 space-y-2.5 relative">
                            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: DISCORD_BLURPLE }}>
                                Recommended
                            </div>
                            <div className="text-center">
                                <div className="text-lg">🎮</div>
                                <p className="text-xs font-bold">Discord</p>
                                <p className="text-[9px] uppercase tracking-wider" style={{ color: DISCORD_BLURPLE }}>Built for Gaming</p>
                            </div>
                            <div className="space-y-1.5">
                                <CompareRow needs>New app download</CompareRow>
                                <CompareRow needs>Few minutes to set up</CompareRow>
                                <CompareRow ok>Phone number stays private</CompareRow>
                                <CompareRow ok>Room ID secure</CompareRow>
                                <CompareRow ok>Phone gallery stays clean</CompareRow>
                                <CompareRow ok>Voice, /nextmatch, badges</CompareRow>
                            </div>
                            <p className="text-[9px] text-center font-medium" style={{ color: DISCORD_BLURPLE }}>
                                + more features
                            </p>
                        </div>
                    </div>

                    {/* CTA Button */}
                    <Button
                        className="w-full font-semibold text-white"
                        style={{ backgroundColor: DISCORD_BLURPLE }}
                        size="lg"
                        onPress={handleLink}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="mr-1.5">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                        </svg>
                        Link with Discord
                    </Button>
                </ModalBody>
            </ModalContent>
        </Modal>
    ), [isOpen, handleLink]);

    return { openDiscordModal, DiscordCompareModal };
}

/** Single comparison row */
function CompareRow({ ok, needs, children }: { ok?: boolean; needs?: boolean; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-1.5 text-[10px] leading-tight">
            <span className="shrink-0 mt-px">
                {ok ? (
                    <span className="text-emerald-500">✓</span>
                ) : needs ? (
                    <span className="text-amber-400">–</span>
                ) : (
                    <span className="text-red-400">✗</span>
                )}
            </span>
            <span className={ok ? "text-foreground/70" : "text-foreground/40"}>
                {children}
            </span>
        </div>
    );
}
