"use client";

import { useState, useEffect } from "react";
import { Button } from "@heroui/react";
import { motion, AnimatePresence } from "motion/react";
import { X, MapPin, Clock, Smartphone, Check } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

/* ─── Platform SVG Icons ────────────────────────────────── */

const AppleIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" fill="currentColor" className={className}>
        <path d="M 44.527344 34.75 C 43.449219 37.144531 42.929688 38.214844 41.542969 40.328125 C 39.601563 43.28125 36.863281 46.96875 33.480469 46.992188 C 30.46875 47.019531 29.691406 45.027344 25.601563 45.0625 C 21.515625 45.082031 20.664063 47.03125 17.648438 47 C 14.261719 46.96875 11.671875 43.648438 9.730469 40.699219 C 4.300781 32.429688 3.726563 22.734375 7.082031 17.578125 C 9.457031 13.921875 13.210938 11.773438 16.738281 11.773438 C 20.332031 11.773438 22.589844 13.746094 25.558594 13.746094 C 28.441406 13.746094 30.195313 11.769531 34.351563 11.769531 C 37.492188 11.769531 40.8125 13.480469 43.1875 16.433594 C 35.421875 20.691406 36.683594 31.78125 44.527344 34.75 Z M 31.195313 8.46875 C 32.707031 6.527344 33.855469 3.789063 33.4375 1 C 30.972656 1.167969 28.089844 2.742188 26.40625 4.78125 C 24.878906 6.640625 23.613281 9.398438 24.105469 12.066406 C 26.796875 12.152344 29.582031 10.546875 31.195313 8.46875 Z" />
    </svg>
);

const AndroidIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" fill="currentColor" className={className}>
        <path d="M 9.6777344 1.515625 A 0.50005 0.50005 0 0 0 9.28125 2.3046875 L 10.759766 4.4414062 C 9.3401698 5.5292967 8.3458783 7.145415 8.0800781 9 L 21.919922 9 C 21.654122 7.145415 20.65983 5.5292967 19.240234 4.4414062 L 20.71875 2.3046875 A 0.50005 0.50005 0 0 0 20.306641 1.515625 A 0.50005 0.50005 0 0 0 19.896484 1.7363281 L 18.40625 3.8925781 C 17.398252 3.3277312 16.238794 3 15 3 C 13.761206 3 12.601748 3.3277312 11.59375 3.8925781 L 10.103516 1.7363281 A 0.50005 0.50005 0 0 0 9.6777344 1.515625 z M 12 5 C 12.552 5 13 5.448 13 6 C 13 6.552 12.552 7 12 7 C 11.448 7 11 6.552 11 6 C 11 5.448 11.448 5 12 5 z M 18 5 C 18.552 5 19 5.448 19 6 C 19 6.552 18.552 7 18 7 C 17.448 7 17 6.552 17 6 C 17 5.448 17.448 5 18 5 z M 5 11 C 4.448 11 4 11.448 4 12 L 4 20 C 4 20.552 4.448 21 5 21 C 5.552 21 6 20.552 6 20 L 6 12 C 6 11.448 5.552 11 5 11 z M 8 11 L 8 21 C 8 22.105 8.895 23 10 23 L 10 26.5 C 10 27.328 10.672 28 11.5 28 C 12.328 28 13 27.328 13 26.5 L 13 23 L 17 23 L 17 26.5 C 17 27.328 17.672 28 18.5 28 C 19.328 28 20 27.328 20 26.5 L 20 23 C 21.105 23 22 22.105 22 21 L 22 11 L 8 11 z M 25 11 C 24.448 11 24 11.448 24 12 L 24 20 C 24 20.552 24.448 21 25 21 C 25.552 21 26 20.552 26 20 L 26 12 C 26 11.448 25.552 11 25 11 z" />
    </svg>
);

/* ─── Constants ────────────────────────────────────────────── */

const MAPS = [
    { name: "Erangel", promoted: true },
    { name: "Miramar", promoted: true },
    { name: "Rondo", promoted: true },
    { name: "Sanhok", promoted: false },
    { name: "Vikendi", promoted: false },
    { name: "Livik", promoted: false },
    { name: "Karakin", promoted: false },
    { name: "Nusa", promoted: false },
];

const TIMING_PRESETS = ["8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM", "10:00 PM"];

const PLATFORMS = [
    { key: "ios", label: "iOS", Icon: AppleIcon },
    { key: "android", label: "Android", Icon: AndroidIcon },
    { key: "pc", label: "PC / Emulator", Icon: null },
] as const;

const SUB_DEVICES: Record<string, { key: string; label: string }[]> = {
    ios: [
        { key: "iPhone", label: "iPhone" },
        { key: "iPad", label: "iPad" },
    ],
    android: [
        { key: "Android Phone", label: "Phone" },
        { key: "Android Tablet", label: "Tablet" },
    ],
};

const LS_COMPLETED = "survey_completed";
const LS_SKIPPED = "survey_skipped_at";
const SKIP_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

/* ─── Component ────────────────────────────────────────────── */

interface SurveyModalProps {
    onDismiss: () => void;
}

export function SurveyModal({ onDismiss }: SurveyModalProps) {
    const [stage, setStage] = useState<"prompt" | "form">("prompt");
    const [selectedMaps, setSelectedMaps] = useState<string[]>([]);
    const [selectedTiming, setSelectedTiming] = useState("");
    const [customTiming, setCustomTiming] = useState(false);
    const [customTimeInput, setCustomTimeInput] = useState("");
    const [platform, setPlatform] = useState("");
    const [device, setDevice] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Toggle map selection (max 3 — 4th click replaces the 3rd)
    const toggleMap = (name: string) => {
        setSelectedMaps((prev) => {
            if (prev.includes(name)) return prev.filter((m) => m !== name);
            if (prev.length >= 3) return [...prev.slice(0, 2), name]; // replace 3rd pick
            return [...prev, name];
        });
    };

    const handleSkip = () => {
        localStorage.setItem(LS_SKIPPED, Date.now().toString());
        onDismiss();
    };

    const effectiveTiming = customTiming ? customTimeInput.trim() : selectedTiming;

    const canSubmit =
        selectedMaps.length === 3 &&
        effectiveTiming.length > 0 &&
        device.length > 0;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        try {
            await axios.post("/api/survey", {
                maps: selectedMaps,
                timing: effectiveTiming,
                device,
            });
            localStorage.setItem(LS_COMPLETED, "true");
            toast.success("Thanks for your feedback! 🎉");
            onDismiss();
        } catch {
            toast.error("Failed to submit — try again");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={handleSkip}
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative bg-background border border-divider rounded-2xl shadow-2xl mx-4 max-w-sm w-full overflow-hidden max-h-[85vh] flex flex-col"
                >
                    <AnimatePresence mode="wait">
                        {stage === "prompt" ? (
                            <motion.div
                                key="prompt"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="p-6 text-center"
                            >
                                <div className="text-4xl mb-3">🎯</div>
                                <h2 className="text-lg font-bold mb-1">Help Us Improve</h2>
                                <p className="text-sm text-foreground/50 mb-5">
                                    Quick 30-second survey — pick your favourite maps, timing & device so we can organise better tournaments for you!
                                </p>
                                <div className="space-y-2">
                                    <Button
                                        color="primary"
                                        className="w-full font-bold"
                                        size="lg"
                                        onPress={() => setStage("form")}
                                    >
                                        Take Survey
                                    </Button>
                                    <button
                                        type="button"
                                        onClick={handleSkip}
                                        className="text-xs text-foreground/30 hover:text-foreground/50 transition-colors cursor-pointer"
                                    >
                                        Skip for now
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="form"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col max-h-[85vh]"
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                                    <h2 className="text-base font-bold">🎯 Quick Survey</h2>
                                    <button
                                        onClick={handleSkip}
                                        className="text-foreground/30 hover:text-foreground/60 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Scrollable form body */}
                                <div className="overflow-y-auto px-5 pb-5 space-y-5 flex-1">
                                    {/* ── Q1: Maps ── */}
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <MapPin className="w-3.5 h-3.5 text-primary" />
                                            <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                                                Favourite Maps <span className="text-foreground/30">(pick 3)</span>
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {MAPS.map(({ name, promoted }) => {
                                                const selected = selectedMaps.includes(name);
                                                return (
                                                    <button
                                                        key={name}
                                                        type="button"
                                                        onClick={() => toggleMap(name)}
                                                        className={`
                                                            relative flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer
                                                            ${selected
                                                                ? "border-primary bg-primary/10 shadow-sm shadow-primary/10"
                                                                : "border-divider bg-default-50 hover:bg-default-100"
                                                            }
                                                            ${promoted ? "ring-1 ring-primary/20" : ""}
                                                        `}
                                                    >
                                                        <span className={`text-sm font-medium ${selected ? "text-primary" : ""}`}>
                                                            {name}
                                                        </span>
                                                        {selected && (
                                                            <Check className="w-3.5 h-3.5 text-primary ml-auto" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* ── Q2: Timing ── */}
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <Clock className="w-3.5 h-3.5 text-primary" />
                                            <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                                                Preferred Timing
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {TIMING_PRESETS.map((time) => (
                                                <button
                                                    key={time}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedTiming(time);
                                                        setCustomTiming(false);
                                                    }}
                                                    className={`
                                                        px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer
                                                        ${!customTiming && selectedTiming === time
                                                            ? "bg-primary text-white shadow-sm"
                                                            : "bg-default-100 text-foreground/60 hover:bg-default-200"
                                                        }
                                                    `}
                                                >
                                                    {time}
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setCustomTiming(true);
                                                    setSelectedTiming("");
                                                }}
                                                className={`
                                                    px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer
                                                    ${customTiming
                                                        ? "bg-primary text-white shadow-sm"
                                                        : "bg-default-100 text-foreground/60 hover:bg-default-200"
                                                    }
                                                `}
                                            >
                                                Custom
                                            </button>
                                        </div>
                                        {customTiming && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                className="mt-2"
                                            >
                                                <input
                                                    type="text"
                                                    value={customTimeInput}
                                                    onChange={(e) => setCustomTimeInput(e.target.value)}
                                                    placeholder="e.g. 7:45 PM"
                                                    className="w-full px-3 py-2 rounded-lg bg-default-100 border border-divider text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                                />
                                            </motion.div>
                                        )}
                                    </div>

                                    {/* ── Q3: Device ── */}
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <Smartphone className="w-3.5 h-3.5 text-primary" />
                                            <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                                                Your Device
                                            </p>
                                        </div>

                                        {/* Step 1: Platform */}
                                        <div className="flex gap-2 mb-2">
                                            {PLATFORMS.map(({ key, label, Icon }) => (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => {
                                                        setPlatform(key);
                                                        // PC has no sub-device
                                                        setDevice(key === "pc" ? "PC / Emulator" : "");
                                                    }}
                                                    className={`
                                                        flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer
                                                        ${platform === key
                                                            ? "bg-primary/10 border border-primary text-primary"
                                                            : "bg-default-100 border border-transparent text-foreground/60 hover:bg-default-200"
                                                        }
                                                    `}
                                                >
                                                    {Icon && <Icon className="w-4 h-4" />}
                                                    <span>{label}</span>
                                                </button>
                                            ))}
                                        </div>

                                        {/* Step 2: Sub-device */}
                                        <AnimatePresence>
                                            {platform && SUB_DEVICES[platform] && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="flex gap-2"
                                                >
                                                    {SUB_DEVICES[platform].map(({ key, label }) => (
                                                        <button
                                                            key={key}
                                                            type="button"
                                                            onClick={() => setDevice(key)}
                                                            className={`
                                                                flex-1 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer
                                                                ${device === key
                                                                    ? "bg-primary text-white shadow-sm"
                                                                    : "bg-default-100 text-foreground/60 hover:bg-default-200"
                                                                }
                                                            `}
                                                        >
                                                            {label}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>

                                {/* Submit footer */}
                                <div className="px-5 pb-5 pt-2 border-t border-divider">
                                    <Button
                                        color="primary"
                                        className="w-full font-bold"
                                        size="lg"
                                        isDisabled={!canSubmit}
                                        isLoading={submitting}
                                        onPress={handleSubmit}
                                    >
                                        Submit
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

/**
 * Hook to determine if the survey popup should show.
 * Returns true if:
 * - Player hasn't completed it
 * - And hasn't skipped it within the last week
 */
export function useShouldShowSurvey(): boolean {
    const [show, setShow] = useState(false);

    useEffect(() => {
        const completed = localStorage.getItem(LS_COMPLETED);
        if (completed) return;

        const skippedAt = localStorage.getItem(LS_SKIPPED);
        if (skippedAt) {
            const elapsed = Date.now() - parseInt(skippedAt, 10);
            if (elapsed < SKIP_COOLDOWN_MS) return;
        }

        setShow(true);
    }, []);

    return show;
}
