"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef } from "react";

/**
 * SlotText — renders text where each character independently rolls
 * like a slot machine / split-flap departure board when the value changes.
 *
 * Every character rolls vertically (old slides up, new slides in from below)
 * with staggered delays creating a cascading slot-machine effect.
 */
export function SlotText({
    value,
    charDelay = 0.02,
    className,
}: {
    value: string;
    charDelay?: number;
    className?: string;
}) {
    const chars = value.split("");
    // Track a generation counter that increments on every value change.
    // This forces ALL characters to re-key and re-roll (true slot machine feel).
    const prevValueRef = useRef(value);
    const genRef = useRef(0);
    if (prevValueRef.current !== value) {
        genRef.current += 1;
        prevValueRef.current = value;
    }
    const gen = genRef.current;

    return (
        <span className={`inline-flex ${className ?? ""}`}>
            {chars.map((char, i) => (
                <span
                    key={i}
                    className="inline-block overflow-hidden relative"
                    style={{ verticalAlign: "top" }}
                >
                    <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                            // Re-key on generation + char so ALL chars roll on every change
                            key={`${gen}-${char}`}
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "-110%" }}
                            transition={{
                                type: "spring",
                                stiffness: 600,
                                damping: 35,
                                mass: 0.5,
                                delay: i * charDelay,
                            }}
                            className="inline-block"
                            style={{ whiteSpace: "pre" }}
                        >
                            {char === " " ? "\u00A0" : char}
                        </motion.span>
                    </AnimatePresence>
                </span>
            ))}
        </span>
    );
}
