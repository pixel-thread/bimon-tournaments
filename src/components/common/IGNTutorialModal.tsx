"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HelpCircle, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@heroui/react";

const TUTORIAL_STEPS = [
    {
        image: "/images/ign-step-1.webp",
        title: "Step 1: Open Profile",
        description: "Click the avatar/profile icon on top left corner",
    },
    {
        image: "/images/ign-step-2.webp",
        title: "Step 2: Copy Game Name",
        description: "Click the 📋 icon to copy your game name",
    },
];

interface IGNTutorialProps {
    /** Whether to auto-open on mount (for onboarding) */
    autoOpen?: boolean;
    /** When true, modal cannot be dismissed until user reaches the last step and clicks "Got it" */
    mandatory?: boolean;
}

/**
 * IGN Tutorial — shows users how to copy their BGMI game name.
 * Returns { HelpButton, Modal, openModal } for flexible usage.
 */
export function useIGNTutorial({ autoOpen = false, mandatory }: IGNTutorialProps = {}) {
    const [showModal, setShowModal] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [origin, setOrigin] = useState({ x: 0, y: 0 });

    // Auto-open on mount
    useEffect(() => {
        if (autoOpen) {
            const timer = setTimeout(() => {
                setOrigin({
                    x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
                    y: typeof window !== "undefined" ? window.innerHeight / 2 : 0,
                });
                setShowModal(true);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [autoOpen]);

    useEffect(() => {
        if (showModal) setCurrentStep(0);
    }, [showModal]);

    const [isMandatory, setIsMandatory] = useState(mandatory ?? autoOpen);

    const openModal = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        }
        setIsMandatory(false); // manual open is never mandatory
        setIsClosing(false);
        setShowModal(true);
    };

    const closeModal = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        }
        setIsClosing(true);
        setTimeout(() => {
            setShowModal(false);
            setIsClosing(false);
        }, 400);
    };

    const step = TUTORIAL_STEPS[currentStep];
    const isLast = currentStep === TUTORIAL_STEPS.length - 1;

    const getTransformOrigin = () => {
        if (typeof window === "undefined") return "center center";
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        return `calc(50% + ${origin.x - cx}px) calc(50% + ${origin.y - cy}px)`;
    };

    const HelpButton = (
        <motion.button
            ref={buttonRef}
            type="button"
            onClick={openModal}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white shadow-lg hover:shadow-primary/50 transition-shadow"
            title="How to find your IGN"
            animate={{
                scale: [1, 1.1, 1],
                boxShadow: [
                    "0 0 0 0 hsl(var(--heroui-primary) / 0.4)",
                    "0 0 0 8px hsl(var(--heroui-primary) / 0)",
                    "0 0 0 0 hsl(var(--heroui-primary) / 0)",
                ],
            }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
        >
            <HelpCircle className="w-3.5 h-3.5" />
        </motion.button>
    );

    const Modal = (
        <AnimatePresence>
            {showModal && (
                <div className="fixed inset-0 z-50">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isClosing ? 0 : 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={(isMandatory && !isLast) ? undefined : (isLast ? closeModal : undefined)}
                    />

                    {/* Modal */}
                    <div className="absolute inset-0 flex items-end sm:items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{
                                opacity: isClosing ? 0 : 1,
                                scale: isClosing ? 0 : 1,
                                transition: isClosing
                                    ? { duration: 0.4, ease: [0.32, 0, 0.67, 0] }
                                    : { type: "spring", damping: 20, stiffness: 300, mass: 0.5 },
                            }}
                            exit={{ opacity: 0, scale: 0 }}
                            style={{ transformOrigin: getTransformOrigin() }}
                            className="bg-background border border-divider rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto overflow-hidden"
                        >
                            {/* Header */}
                            <div className="flex items-center gap-2 p-4 border-b border-divider">
                                <motion.div
                                    initial={{ rotate: -180, scale: 0 }}
                                    animate={{ rotate: 0, scale: 1 }}
                                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                    className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"
                                >
                                    <HelpCircle className="w-4 h-4 text-white" />
                                </motion.div>
                                <h2 className="text-lg font-semibold">
                                    How to copy game name
                                </h2>
                            </div>

                            {/* Content */}
                            <div className="p-4">
                                {/* Image */}
                                <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-default-100">
                                    <AnimatePresence mode="wait">
                                        <motion.img
                                            key={currentStep}
                                            src={step.image}
                                            alt={step.title}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.2 }}
                                            className="w-full h-full object-contain"
                                        />
                                    </AnimatePresence>
                                </div>

                                {/* Step info */}
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={currentStep}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="mt-4 text-center"
                                    >
                                        <h3 className="text-lg font-semibold">{step.title}</h3>
                                        <p className="text-sm text-foreground/50 mt-1">
                                            {step.description}
                                        </p>
                                    </motion.div>
                                </AnimatePresence>

                                {/* Step dots */}
                                <div className="flex justify-center gap-3 mt-4">
                                    {TUTORIAL_STEPS.map((_, i) => (
                                        <motion.div
                                            key={i}
                                            animate={{ width: i === currentStep ? 32 : 8 }}
                                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                            className={`h-2 rounded-full ${i === currentStep
                                                    ? "bg-primary"
                                                    : "bg-default-300"
                                                }`}
                                        />
                                    ))}
                                </div>

                                {/* Nav buttons */}
                                <div className="flex gap-3 mt-5">
                                    {isLast ? (
                                        <>
                                            <Button
                                                variant="flat"
                                                className="flex-1"
                                                onPress={() => setCurrentStep((s) => s - 1)}
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                color="primary"
                                                className="flex-1"
                                                onPress={closeModal}
                                            >
                                                <Check className="w-4 h-4 mr-1" />
                                                Got it!
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            color="primary"
                                            className="w-full"
                                            onPress={() => setCurrentStep((s) => s + 1)}
                                        >
                                            Next
                                            <ChevronRight className="w-4 h-4 ml-1" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );

    return { HelpButton, Modal, openModal };
}
