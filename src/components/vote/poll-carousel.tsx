"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const AUTO_ADVANCE_MS = 6000;
const OFFSET = 10;
const SCALE_FACTOR = 0.05;

interface PollCarouselProps {
    children: React.ReactNode[];
    pollIds?: string[];
    /** Header gradient classes per poll, e.g. "from-gray-500 via-gray-400 to-gray-500" */
    headerGradients?: string[];
}

/**
 * Aceternity-style stacked card carousel for polls.
 * Cards stack behind with depth, smooth spring transitions between them.
 * Nav buttons match the active poll's header gradient.
 */
export function PollCarousel({ children, pollIds, headerGradients }: PollCarouselProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [progress, setProgress] = useState(0);
    const rafRef = useRef<number | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const count = children.length;

    // Active poll's gradient for buttons
    const activeGradient = headerGradients?.[activeIndex] ?? "from-gray-500 via-gray-400 to-gray-500";

    // ── Auto-advance ──────────────────────────────────────────
    const stopAutoAdvance = useCallback(() => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        startTimeRef.current = null;
    }, []);

    const startAutoAdvance = useCallback(() => {
        setIsPaused(false);
        setProgress(0);
        startTimeRef.current = null;
        stopAutoAdvance();

        const tick = (timestamp: number) => {
            if (!startTimeRef.current) startTimeRef.current = timestamp;
            const elapsed = timestamp - startTimeRef.current;
            const pct = Math.min(elapsed / AUTO_ADVANCE_MS, 1);
            setProgress(pct);

            if (pct >= 1) {
                setActiveIndex((prev) => (prev + 1) % count);
                startTimeRef.current = null;
                setProgress(0);
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
    }, [count, stopAutoAdvance]);

    useEffect(() => {
        if (count <= 1) return;
        startAutoAdvance();
        return () => stopAutoAdvance();
    }, [count, startAutoAdvance, stopAutoAdvance]);

    const handleCardInteraction = useCallback(() => {
        if (!isPaused) {
            setIsPaused(true);
            stopAutoAdvance();
        }
    }, [isPaused, stopAutoAdvance]);

    const goTo = useCallback((index: number) => {
        setActiveIndex(index);
        stopAutoAdvance();
        startAutoAdvance();
    }, [stopAutoAdvance, startAutoAdvance]);

    const goNext = useCallback(() => {
        goTo((activeIndex + 1) % count);
    }, [activeIndex, count, goTo]);

    const goPrev = useCallback(() => {
        goTo((activeIndex - 1 + count) % count);
    }, [activeIndex, count, goTo]);

    if (count === 0) return null;
    if (count === 1) {
        return <div data-poll-id={pollIds?.[0]}>{children[0]}</div>;
    }

    return (
        <div className="relative">
            {/* ── Stacked Cards ── */}
            <div
                className="relative pt-5"
                onPointerDown={handleCardInteraction}
                onTouchStart={handleCardInteraction}
            >
                {/* Behind card edges — real poll content clipped to header */}
                {children.map((child, i) => {
                    const distance = ((i - activeIndex) % count + count) % count;
                    if (distance === 0 || distance > 2) return null;

                    return (
                        <motion.div
                            key={`bg-${i}`}
                            className="absolute left-0 right-0 top-0 rounded-xl overflow-hidden pointer-events-none shadow-sm"
                            animate={{
                                y: 20 - (distance * OFFSET),
                                scale: 1 - distance * SCALE_FACTOR,
                                opacity: 1 - distance * 0.3,
                            }}
                            transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 25,
                            }}
                            style={{
                                zIndex: count - distance,
                                height: 56,
                                transformOrigin: "top center",
                            }}
                        >
                            {child}
                        </motion.div>
                    );
                })}

                {/* Active card */}
                <AnimatePresence mode="popLayout">
                    <motion.div
                        key={activeIndex}
                        initial={{ y: -OFFSET * 2, scale: 1 - SCALE_FACTOR, opacity: 0 }}
                        animate={{ y: 0, scale: 1, opacity: 1 }}
                        exit={{ y: 40, scale: 0.92, opacity: 0 }}
                        transition={{
                            type: "spring",
                            stiffness: 260,
                            damping: 22,
                            mass: 0.8,
                        }}
                        className="relative"
                        style={{ zIndex: count }}
                        data-poll-id={pollIds?.[activeIndex]}
                    >
                        {children[activeIndex]}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* ── Navigation & Progress ── */}
            <div className="mt-3 flex items-center justify-center gap-3">
                <button
                    type="button"
                    onClick={goPrev}
                    className={`w-20 flex h-8 items-center justify-center rounded-lg bg-gradient-to-r ${activeGradient} text-white hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-sm`}
                    aria-label="Previous poll"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>

                {/* Single progress bar */}
                <div className="w-16 h-1 rounded-full overflow-hidden bg-default-200 shrink-0">
                    <div
                        className="h-full rounded-full"
                        style={{
                            background: "var(--game-primary, hsl(var(--primary)))",
                            width: isPaused ? "100%" : `${progress * 100}%`,
                            transition: isPaused ? "width 0.3s ease" : "none",
                        }}
                    />
                </div>

                <button
                    type="button"
                    onClick={goNext}
                    className={`w-20 flex h-8 items-center justify-center rounded-lg bg-gradient-to-r ${activeGradient} text-white hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-sm`}
                    aria-label="Next poll"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {/* Counter */}
            <div className="flex justify-center mt-1">
                <span className="text-[10px] text-foreground/30 font-medium">
                    {activeIndex + 1} / {count}
                </span>
            </div>
        </div>
    );
}
