"use client";

import { motion, type Variant } from "motion/react";
import type { ReactNode } from "react";

type AnimationVariant = "fadeUp" | "fadeIn" | "fadeLeft" | "fadeRight" | "scaleUp" | "staggerUp";

const variants: Record<AnimationVariant, { hidden: Variant; visible: Variant }> = {
    fadeUp: {
        hidden: { opacity: 0, y: 40 },
        visible: { opacity: 1, y: 0 },
    },
    fadeIn: {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
    },
    fadeLeft: {
        hidden: { opacity: 0, x: -40 },
        visible: { opacity: 1, x: 0 },
    },
    fadeRight: {
        hidden: { opacity: 0, x: 40 },
        visible: { opacity: 1, x: 0 },
    },
    scaleUp: {
        hidden: { opacity: 0, scale: 0.9 },
        visible: { opacity: 1, scale: 1 },
    },
    staggerUp: {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0 },
    },
};

/**
 * Animate children when they scroll into view.
 * Wraps content in a motion.div with whileInView trigger.
 */
export function AnimateOnScroll({
    children,
    variant = "fadeUp",
    delay = 0,
    duration = 0.6,
    className,
}: {
    children: ReactNode;
    variant?: AnimationVariant;
    delay?: number;
    duration?: number;
    className?: string;
}) {
    const v = variants[variant];
    return (
        <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={{
                hidden: v.hidden,
                visible: { ...v.visible, transition: { duration, delay, ease: [0.25, 0.1, 0.25, 1] } },
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

/**
 * Stagger children animations — wrap around a grid/list of items.
 * Each direct child animates in sequence.
 */
export function StaggerContainer({
    children,
    className,
    staggerDelay = 0.1,
}: {
    children: ReactNode;
    className?: string;
    staggerDelay?: number;
}) {
    return (
        <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={{
                hidden: {},
                visible: { transition: { staggerChildren: staggerDelay } },
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

/**
 * Individual stagger item — use inside StaggerContainer.
 */
export function StaggerItem({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <motion.div
            variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] } },
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}
