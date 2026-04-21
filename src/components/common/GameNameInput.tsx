"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Clipboard, X, AlertCircle } from "lucide-react";

const MAX_IGN_LENGTH = 20;

interface GameNameInputProps {
    value: string;
    onChange: (value: string) => void;
    error?: string;
    onErrorChange?: (error: string) => void;
    disabled?: boolean;
}

/**
 * Paste-to-set game name input — designed for mobile BGMI users.
 * Tap to read clipboard, long-press for native paste fallback.
 * Sanitizes BGMI invisible characters (macron vowels) automatically.
 */
export function GameNameInput({
    value,
    onChange,
    error,
    onErrorChange,
    disabled = false,
}: GameNameInputProps) {
    const [clipboardDenied, setClipboardDenied] = useState(false);

    // Process pasted text — sanitize BGMI invisible characters
    const processPastedText = (text: string) => {
        const sanitized = text
            .replace(/[ĀāĒēĪīŌōŪū]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        if (sanitized.length > MAX_IGN_LENGTH) {
            toast.error("Name too long! Please copy your actual IGN from BGMI.");
            return;
        }

        onChange(sanitized);

        if (sanitized.length < 2) {
            onErrorChange?.("Game Name must be at least 2 characters");
        } else {
            onErrorChange?.("");
            toast.success("Game Name pasted!");
        }
    };

    // Tap to paste — reads clipboard API
    const handlePaste = async () => {
        onErrorChange?.("");
        try {
            const text = await navigator.clipboard.readText();
            if (text.trim()) {
                processPastedText(text);
            } else {
                toast.error("Clipboard is empty");
            }
        } catch {
            setClipboardDenied(true);
            toast.error("Tap failed. Long press the input to paste.");
        }
    };

    const handleClear = () => {
        onErrorChange?.("");
        onChange("");
    };

    return (
        <div>
            <div className="flex gap-2 items-center">
                {/* Paste field */}
                <div
                    onClick={!disabled && !value ? handlePaste : undefined}
                    className={`relative flex-1 min-h-[48px] rounded-xl border-2 transition-all ${value
                        ? "bg-default-100 border-success/40"
                        : "bg-default-50 border-default-300 dark:border-default-200 hover:border-primary/60 cursor-pointer active:scale-[0.99]"
                        } ${error ? "border-danger/60 bg-danger-50/10" : ""} ${disabled ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                >
                    {/* Visible text */}
                    <div
                        className={`px-4 py-3 select-none ${!value
                            ? "text-foreground/40"
                            : "text-foreground font-medium"
                            }`}
                    >
                        <span className="truncate block">
                            {value || (
                                <span className="flex items-center gap-2">
                                    <Clipboard className="h-4 w-4" />
                                    {clipboardDenied
                                        ? "Long press to paste"
                                        : "Tap to paste"}
                                </span>
                            )}
                        </span>
                    </div>

                    {/* Hidden contentEditable for long-press paste fallback */}
                    <div
                        contentEditable
                        suppressContentEditableWarning
                        inputMode="none"
                        onPaste={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const pastedText = e.clipboardData
                                .getData("text")
                                .trim();
                            if (pastedText) {
                                processPastedText(pastedText);
                            }
                            (e.target as HTMLElement).blur();
                        }}
                        onClick={(e) => {
                            if (!disabled && !value) {
                                e.stopPropagation();
                                handlePaste();
                            }
                        }}
                        onKeyDown={(e) => e.preventDefault()}
                        onInput={(e) => {
                            (e.target as HTMLElement).textContent = "";
                        }}
                        className="absolute inset-0 z-10 px-4 py-3 opacity-0"
                        style={{
                            caretColor: "transparent",
                            WebkitUserSelect: "text",
                            userSelect: "text",
                        }}
                    />
                </div>

                {/* Clear button */}
                {value && !disabled && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="p-3 rounded-xl bg-danger hover:bg-danger/80 text-white transition-colors shrink-0"
                        title="Clear"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Error */}
            {error && (
                <p className="mt-2 text-xs text-danger flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {error}
                </p>
            )}

        </div>
    );
}

/** Validate display name */
export function validateDisplayName(value: string): string {
    const { GAME } = require("@/lib/game-config");
    const label = GAME.ignLabel;
    if (value.length < 2) return `${label} must be at least 2 characters`;
    if (value.length > MAX_IGN_LENGTH)
        return `${label} must be at most ${MAX_IGN_LENGTH} characters`;
    return "";
}

export { MAX_IGN_LENGTH };
