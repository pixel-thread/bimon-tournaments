"use client";

import { Avatar, type AvatarProps } from "@heroui/react";
import { useMemo } from "react";

/**
 * Diverse people emoji pool — deterministically assigned per player.
 * Covers a wide range of skin tones, genders, and styles.
 */
const PEOPLE_EMOJIS = [
    "🧑", "👩", "👨", "🧔", "👱", "🧑‍🦱", "👩‍🦰", "👨‍🦳",
    "🧑‍🦲", "👩‍🦱", "👨‍🦱", "🧑‍🦰", "👱‍♀️", "👱‍♂️", "🧔‍♂️", "🧔‍♀️",
    "👲", "🧕", "👳", "👳‍♀️", "🤴", "👸", "🥷", "🦸",
    "🦹", "🧙", "🧝", "🧛", "🧜", "🧞", "🧟", "🤠",
    "🤡", "👼", "🎅", "🤶", "🦊", "🐱", "🐶", "🐰",
    "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸",
];

/**
 * Get a deterministic emoji for a player based on their ID.
 * Same player always gets the same emoji.
 */
export function getPlayerEmoji(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
    }
    return PEOPLE_EMOJIS[Math.abs(hash) % PEOPLE_EMOJIS.length];
}

interface PlayerAvatarProps extends Omit<AvatarProps, "fallback" | "showFallback"> {
    /** Player ID for deterministic emoji assignment */
    playerId?: string;
    /** Player display name — used if no image */
    playerName?: string;
}

/**
 * Avatar component for players.
 * - If `src` (image URL) is provided → shows the image
 * - Otherwise → shows a deterministic people emoji based on playerId
 *
 * Usage: <PlayerAvatar src={p.imageUrl} playerId={p.id} playerName={p.displayName} size="sm" />
 */
export function PlayerAvatar({ playerId, playerName, src, className, ...props }: PlayerAvatarProps) {
    const emoji = useMemo(
        () => getPlayerEmoji(playerId || playerName || "default"),
        [playerId, playerName]
    );

    // If there's an actual image URL, just use the normal Avatar
    if (src) {
        return (
            <Avatar
                src={src}
                name={playerName || undefined}
                className={className}
                {...props}
            />
        );
    }

    // No image — show emoji fallback
    return (
        <Avatar
            showFallback
            name={playerName || undefined}
            className={className}
            {...props}
            fallback={
                <span className="text-lg leading-none select-none" role="img" aria-label={playerName || "player"}>
                    {emoji}
                </span>
            }
        />
    );
}
