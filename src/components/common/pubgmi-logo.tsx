"use client";

import { useEffect, useState, useRef } from "react";
import { GAME, GAME_MODE } from "@/lib/game-config";

/**
 * Animated game logo — adapts to GAME_MODE:
 *
 * BGMI mode: PUBGMI ↔ BGMI slot-machine animation
 * Free Fire mode: BOO-YAH bounce animation
 */
interface PubgmiLogoProps {
    variant?: "hero" | "header";
    className?: string;
}

// ─── BGMI Phases ───
type BgmiPhase =
    | "PUBGMI"
    | "DROP_PU"
    | "BGMI"
    | "SWAP"
    | "PUBGMI_MID"
    | "DROP_MI"
    | "PUBG"
    | "ROLL_MI"
    ;

const BGMI_TIMINGS = {
    PUBGMI: 2400,
    DROP_PU: 900,
    BGMI: 1500,
    SWAP: 2000,
    PUBGMI_MID: 2000,
    DROP_MI: 900,
    PUBG: 1200,
    ROLL_MI: 1400,
};

// ─── BGMI Logo ───
function BgmiLogo({ className }: PubgmiLogoProps) {
    const [phase, setPhase] = useState<BgmiPhase>("PUBGMI");
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const advance = (nextPhase: BgmiPhase, delay: number) => {
            timeoutRef.current = setTimeout(() => setPhase(nextPhase), delay);
        };

        switch (phase) {
            case "PUBGMI":
                advance("DROP_PU", BGMI_TIMINGS.PUBGMI);
                break;
            case "DROP_PU":
                advance("BGMI", BGMI_TIMINGS.DROP_PU);
                break;
            case "BGMI":
                advance("SWAP", BGMI_TIMINGS.BGMI);
                break;
            case "SWAP":
                advance("PUBGMI_MID", BGMI_TIMINGS.SWAP);
                break;
            case "PUBGMI_MID":
                advance("DROP_MI", BGMI_TIMINGS.PUBGMI_MID);
                break;
            case "DROP_MI":
                advance("PUBG", BGMI_TIMINGS.DROP_MI);
                break;
            case "PUBG":
                advance("ROLL_MI", BGMI_TIMINGS.PUBG);
                break;
            case "ROLL_MI":
                advance("PUBGMI", BGMI_TIMINGS.ROLL_MI + 600);
                break;
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [phase]);

    const s = (letter: string, pos: number) => (
        <span key={`s-${pos}`} className="pubgmi-letter">{letter}</span>
    );

    const fall = (letter: string, i: number, prefix: string) => (
        <span
            key={`fall-${prefix}-${i}`}
            className="pubgmi-letter pubgmi-fall-down"
            style={{ "--fall-delay": `${i * 150}ms` } as React.CSSProperties}
        >
            {letter}
        </span>
    );

    const roll = (letter: string, i: number, prefix: string) => (
        <span
            key={`roll-${prefix}-${i}`}
            className="pubgmi-letter pubgmi-roll-in"
            style={{ "--roll-delay": `${i * 150}ms` } as React.CSSProperties}
        >
            {letter}
        </span>
    );

    const renderLetters = () => {
        switch (phase) {
            case "PUBGMI":
            case "PUBGMI_MID":
                return (
                    <>
                        {s("P", 0)}{s("U", 1)}{s("B", 2)}{s("G", 3)}{s("M", 4)}{s("I", 5)}
                    </>
                );

            case "DROP_PU":
                return (
                    <>
                        {fall("P", 0, "pu")}{fall("U", 1, "pu")}
                        {s("B", 2)}{s("G", 3)}{s("M", 4)}{s("I", 5)}
                    </>
                );

            case "BGMI":
                return (
                    <>
                        {s("B", 2)}{s("G", 3)}{s("M", 4)}{s("I", 5)}
                    </>
                );

            case "SWAP":
                return (
                    <span className="pubgmi-swap-container">
                        <span className="pubgmi-swap-out">
                            {"BGMI".split("").map((letter, i) => (
                                <span
                                    key={`swap-out-${i}`}
                                    className="pubgmi-letter pubgmi-fall-down"
                                    style={{ "--fall-delay": `${i * 100}ms` } as React.CSSProperties}
                                >
                                    {letter}
                                </span>
                            ))}
                        </span>
                        {"PUBGMI".split("").map((letter, i) => (
                            <span
                                key={`swap-in-${i}`}
                                className="pubgmi-letter pubgmi-roll-in"
                                style={{ "--roll-delay": `${300 + i * 120}ms` } as React.CSSProperties}
                            >
                                {letter}
                            </span>
                        ))}
                    </span>
                );

            case "DROP_MI":
                return (
                    <>
                        {s("P", 0)}{s("U", 1)}{s("B", 2)}{s("G", 3)}
                        {fall("M", 0, "mi")}{fall("I", 1, "mi")}
                    </>
                );

            case "PUBG":
                return (
                    <>
                        {s("P", 0)}{s("U", 1)}{s("B", 2)}{s("G", 3)}
                    </>
                );

            case "ROLL_MI":
                return (
                    <>
                        {s("P", 0)}{s("U", 1)}{s("B", 2)}{s("G", 3)}
                        {roll("M", 0, "mi")}{roll("I", 1, "mi")}
                    </>
                );

            default:
                return null;
        }
    };

    return (
        <span
            className={`pubgmi-logo inline-flex items-baseline select-none ${className || ""}`}
            aria-label="PUBGMI"
        >
            {renderLetters()}
        </span>
    );
}

// ─── Free Fire Logo — BOO-YAH ↔ KG┊Dengstai alternating cascade ───
const FF_WORDS = [
    ["B", "O", "O", "-", "Y", "A", "H"],
    ["K", "G", "┊", "D", "e", "n", "g", "s", "t", "a", "i"],
];

function FreeFireLogo({ className }: PubgmiLogoProps) {
    const [wordIndex, setWordIndex] = useState(0);
    const [phase, setPhase] = useState<"SHOW" | "SWAP">("SHOW");
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const currentLetters = FF_WORDS[wordIndex];
    const nextLetters = FF_WORDS[(wordIndex + 1) % FF_WORDS.length];

    useEffect(() => {
        const advance = (nextPhase: "SHOW" | "SWAP", delay: number) => {
            timeoutRef.current = setTimeout(() => setPhase(nextPhase), delay);
        };

        switch (phase) {
            case "SHOW":
                advance("SWAP", 2500);
                break;
            case "SWAP":
                // After swap animation completes, move to next word
                const swapDuration = Math.max(
                    currentLetters.length * 100 + 500,  // fall time
                    nextLetters.length * 80 + 500,       // roll time (starts 300ms after fall begins)
                ) + 300;
                timeoutRef.current = setTimeout(() => {
                    setWordIndex((i) => (i + 1) % FF_WORDS.length);
                    setPhase("SHOW");
                }, swapDuration);
                break;
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [phase, wordIndex, currentLetters.length, nextLetters.length]);

    return (
        <span
            className={`pubgmi-logo inline-flex items-baseline select-none ${className || ""}`}
            aria-label={currentLetters.join("")}
        >
            {phase === "SHOW" && (
                currentLetters.map((l, i) => (
                    <span key={`show-${wordIndex}-${i}`} className="pubgmi-letter">{l}</span>
                ))
            )}

            {phase === "SWAP" && (
                <span className="pubgmi-swap-container">
                    {/* Current word: cascade fall */}
                    <span className="pubgmi-swap-out">
                        {currentLetters.map((l, i) => (
                            <span
                                key={`fall-${wordIndex}-${i}`}
                                className="pubgmi-letter pubgmi-fall-down"
                                style={{ "--fall-delay": `${i * 100}ms` } as React.CSSProperties}
                            >
                                {l}
                            </span>
                        ))}
                    </span>
                    {/* Next word: cascade roll in (starts while fall is still happening) */}
                    {nextLetters.map((l, i) => (
                        <span
                            key={`roll-${wordIndex}-${i}`}
                            className="pubgmi-letter pubgmi-roll-in"
                            style={{ "--roll-delay": `${300 + i * 80}ms` } as React.CSSProperties}
                        >
                            {l}
                        </span>
                    ))}
                </span>
            )}
        </span>
    );
}

// ─── PES Logo — KICKOFF ↔ eFootball alternating cascade ───
const PES_WORDS = [
    ["K", "I", "C", "K", "O", "F", "F"],
    ["e", "F", "O", "O", "T", "B", "A", "L", "L"],
];

function PesLogo({ className }: PubgmiLogoProps) {
    const [wordIndex, setWordIndex] = useState(0);
    const [phase, setPhase] = useState<"SHOW" | "SWAP">("SHOW");
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const currentLetters = PES_WORDS[wordIndex];
    const nextLetters = PES_WORDS[(wordIndex + 1) % PES_WORDS.length];

    useEffect(() => {
        const advance = (nextPhase: "SHOW" | "SWAP", delay: number) => {
            timeoutRef.current = setTimeout(() => setPhase(nextPhase), delay);
        };

        switch (phase) {
            case "SHOW":
                advance("SWAP", 2500);
                break;
            case "SWAP":
                const swapDuration = Math.max(
                    currentLetters.length * 100 + 500,
                    nextLetters.length * 80 + 500,
                ) + 300;
                timeoutRef.current = setTimeout(() => {
                    setWordIndex((i) => (i + 1) % PES_WORDS.length);
                    setPhase("SHOW");
                }, swapDuration);
                break;
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [phase, wordIndex, currentLetters.length, nextLetters.length]);

    return (
        <span
            className={`pubgmi-logo inline-flex items-baseline select-none ${className || ""}`}
            aria-label={currentLetters.join("")}
        >
            {phase === "SHOW" && (
                currentLetters.map((l, i) => (
                    <span key={`show-${wordIndex}-${i}`} className="pubgmi-letter">{l}</span>
                ))
            )}

            {phase === "SWAP" && (
                <span className="pubgmi-swap-container">
                    <span className="pubgmi-swap-out">
                        {currentLetters.map((l, i) => (
                            <span
                                key={`fall-${wordIndex}-${i}`}
                                className="pubgmi-letter pubgmi-fall-down"
                                style={{ "--fall-delay": `${i * 100}ms` } as React.CSSProperties}
                            >
                                {l}
                            </span>
                        ))}
                    </span>
                    {nextLetters.map((l, i) => (
                        <span
                            key={`roll-${wordIndex}-${i}`}
                            className="pubgmi-letter pubgmi-roll-in"
                            style={{ "--roll-delay": `${300 + i * 80}ms` } as React.CSSProperties}
                        >
                            {l}
                        </span>
                    ))}
                </span>
            )}
        </span>
    );
}

// ─── MLBB Logo — Mobai Legend ↔ ML:BB alternating cascade ───
const MLBB_WORDS = [
    ["M", "o", "b", "a", "i", " ", "L", "e", "g", "e", "n", "d"],
    ["M", "L", ":", "B", "B"],
];

function MlbbLogo({ className }: PubgmiLogoProps) {
    const [wordIndex, setWordIndex] = useState(0);
    const [phase, setPhase] = useState<"SHOW" | "SWAP">("SHOW");
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const currentLetters = MLBB_WORDS[wordIndex];
    const nextLetters = MLBB_WORDS[(wordIndex + 1) % MLBB_WORDS.length];

    useEffect(() => {
        const advance = (nextPhase: "SHOW" | "SWAP", delay: number) => {
            timeoutRef.current = setTimeout(() => setPhase(nextPhase), delay);
        };

        switch (phase) {
            case "SHOW":
                advance("SWAP", 2500);
                break;
            case "SWAP":
                const swapDuration = Math.max(
                    currentLetters.length * 100 + 500,
                    nextLetters.length * 80 + 500,
                ) + 300;
                timeoutRef.current = setTimeout(() => {
                    setWordIndex((i) => (i + 1) % MLBB_WORDS.length);
                    setPhase("SHOW");
                }, swapDuration);
                break;
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [phase, wordIndex, currentLetters.length, nextLetters.length]);

    return (
        <span
            className={`pubgmi-logo inline-flex items-baseline select-none ${className || ""}`}
            aria-label={currentLetters.join("")}
        >
            {phase === "SHOW" && (
                currentLetters.map((l, i) => (
                    <span key={`show-${wordIndex}-${i}`} className="pubgmi-letter">{l}</span>
                ))
            )}

            {phase === "SWAP" && (
                <span className="pubgmi-swap-container">
                    <span className="pubgmi-swap-out">
                        {currentLetters.map((l, i) => (
                            <span
                                key={`fall-${wordIndex}-${i}`}
                                className="pubgmi-letter pubgmi-fall-down"
                                style={{ "--fall-delay": `${i * 100}ms` } as React.CSSProperties}
                            >
                                {l}
                            </span>
                        ))}
                    </span>
                    {nextLetters.map((l, i) => (
                        <span
                            key={`roll-${wordIndex}-${i}`}
                            className="pubgmi-letter pubgmi-roll-in"
                            style={{ "--roll-delay": `${300 + i * 80}ms` } as React.CSSProperties}
                        >
                            {l}
                        </span>
                    ))}
                </span>
            )}
        </span>
    );
}

// ─── Exported Component — picks based on GAME_MODE ───
export function PubgmiLogo(props: PubgmiLogoProps) {
    if (GAME_MODE === "freefire") {
        return <FreeFireLogo {...props} />;
    }
    if (GAME_MODE === "pes") {
        return <PesLogo {...props} />;
    }
    if (GAME_MODE === "mlbb") {
        return <MlbbLogo {...props} />;
    }
    return <BgmiLogo {...props} />;
}
