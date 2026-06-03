"use client";

import { useState, useCallback } from "react";
import { Modal, ModalContent, ModalBody, Button } from "@heroui/react";
import { Check, X, Minus } from "lucide-react";

const DISCORD_BLURPLE = "#5865F2";
const CHATGPT_Q = encodeURIComponent("Which is better for a gaming tournament community — Discord or WhatsApp? Answer in one line.");

/* ─── Icons ──────────────────────────────────────────────────── */

function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    );
}

function DiscordIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
        </svg>
    );
}

function ChatGPTIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
        </svg>
    );
}

/* ─── Hook ───────────────────────────────────────────────────── */

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
        <CompareModalUI isOpen={isOpen} onClose={() => setIsOpen(false)} onLink={handleLink} />
    ), [isOpen, handleLink]);

    return { openDiscordModal, DiscordCompareModal };
}

/* ─── Shared Modal UI ────────────────────────────────────────── */

export function CompareModalUI({
    isOpen,
    onClose,
    onLink,
    hideClose,
    onSkip,
}: {
    isOpen: boolean;
    onClose?: () => void;
    onLink: () => void;
    hideClose?: boolean;
    onSkip?: () => void;
}) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            hideCloseButton={hideClose}
            isDismissable={!hideClose}
            isKeyboardDismissDisabled={hideClose}
            placement="center"
            size="md"
            classNames={{
                backdrop: "bg-black/60 backdrop-blur-sm",
                base: "border border-divider bg-background mx-3 shadow-2xl",
            }}
        >
            <ModalContent>
                <ModalBody className="py-6 px-4 space-y-5">
                    {/* Title */}
                    <div className="text-center space-y-1">
                        <h3 className="text-lg font-bold">Why Discord?</h3>
                        <p className="text-[11px] text-foreground/40">
                            See why we use Discord for tournaments
                        </p>
                    </div>

                    {/* Comparison Cards */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* WhatsApp - Basic */}
                        <div className="rounded-2xl border border-divider bg-default-50 dark:bg-default-50/50 p-3.5 space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-[#25D366]/15 flex items-center justify-center">
                                    <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold">WhatsApp</p>
                                    <p className="text-[8px] text-foreground/30 uppercase tracking-widest font-medium">Basic</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <CompareItem type="ok">Everyone has it</CompareItem>
                                <CompareItem type="ok">Easy to use</CompareItem>
                                <CompareItem type="bad">Phone number exposed</CompareItem>
                                <CompareItem type="bad">Room ID not secure</CompareItem>
                                <CompareItem type="bad">Random photos fill gallery</CompareItem>
                                <CompareItem type="bad">Too many groups</CompareItem>
                            </div>
                        </div>

                        {/* Discord - Gaming */}
                        <div className="rounded-2xl border border-[#5865F2]/30 bg-[#5865F2]/[0.04] dark:bg-[#5865F2]/[0.08] p-3.5 space-y-3 relative overflow-visible">
                            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                                <span
                                    className="px-2.5 py-0.5 rounded-full text-[7px] font-extrabold uppercase tracking-widest text-white shadow-lg shadow-[#5865F2]/30"
                                    style={{ backgroundColor: DISCORD_BLURPLE }}
                                >
                                    Recommended
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-[#5865F2]/15 flex items-center justify-center">
                                    <DiscordIcon className="w-4 h-4 text-[#5865F2]" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold">Discord</p>
                                    <p className="text-[8px] uppercase tracking-widest font-semibold" style={{ color: DISCORD_BLURPLE }}>
                                        For Gaming
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <CompareItem type="neutral">New app download</CompareItem>
                                <CompareItem type="neutral">Few mins to set up</CompareItem>
                                <CompareItem type="ok">Phone number private</CompareItem>
                                <CompareItem type="ok">Room ID secure</CompareItem>
                                <CompareItem type="ok">Phone gallery clean</CompareItem>
                                <CompareItem type="ok">Voice, /nextmatch</CompareItem>
                            </div>
                            <p className="text-[9px] text-center font-semibold" style={{ color: DISCORD_BLURPLE }}>
                                + more features
                            </p>
                        </div>
                    </div>

                    {/* CTA Button */}
                    <Button
                        className="w-full font-bold text-white text-sm h-12 shadow-lg shadow-[#5865F2]/25"
                        style={{ backgroundColor: DISCORD_BLURPLE }}
                        radius="lg"
                        onPress={onLink}
                    >
                        <DiscordIcon className="w-5 h-5 mr-1.5" />
                        Link with Discord
                    </Button>

                    {/* Ask ChatGPT */}
                    <div className="flex items-center justify-center gap-1.5">
                        <span className="text-[10px] text-foreground/25">Don&apos;t believe us?</span>
                        <a
                            href={`https://chatgpt.com/?q=${CHATGPT_Q}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-foreground/40 hover:text-foreground/60 transition-colors"
                        >
                            <ChatGPTIcon className="w-3 h-3" />
                            Ask ChatGPT →
                        </a>
                    </div>

                    {/* Skip */}
                    {onSkip && (
                        <button
                            type="button"
                            onClick={onSkip}
                            className="text-[11px] text-foreground/20 hover:text-foreground/40 transition-colors cursor-pointer w-full text-center"
                        >
                            Skip for now →
                        </button>
                    )}
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}

/* ─── Compare Item ──────────────────────────────────────────── */

function CompareItem({ type, children }: { type: "ok" | "bad" | "neutral"; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-1.5">
            <span className="shrink-0 mt-[1px]">
                {type === "ok" ? (
                    <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500/20">
                        <Check className="w-2 h-2 text-emerald-500" strokeWidth={3} />
                    </span>
                ) : type === "bad" ? (
                    <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-red-500/15">
                        <X className="w-2 h-2 text-red-500" strokeWidth={3} />
                    </span>
                ) : (
                    <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-500/15">
                        <Minus className="w-2 h-2 text-amber-500" strokeWidth={3} />
                    </span>
                )}
            </span>
            <span className={`text-[10px] leading-tight ${
                type === "ok" ? "text-foreground/70" : type === "bad" ? "text-foreground/40" : "text-foreground/50"
            }`}>
                {children}
            </span>
        </div>
    );
}
