"use client";

import { Avatar, type AvatarProps } from "@heroui/react";
import NiceAvatar, { genConfig } from "react-nice-avatar";
import { useMemo } from "react";

interface PlayerAvatarProps extends Omit<AvatarProps, "fallback" | "showFallback"> {
    /** Player ID for deterministic avatar assignment */
    playerId?: string;
    /** Player display name — used if no image */
    playerName?: string;
}

/**
 * Avatar component for players.
 * - If `src` (image URL) is provided → shows the image
 * - Otherwise → shows a react-nice-avatar character based on playerId
 *
 * Usage: <PlayerAvatar src={p.imageUrl} playerId={p.id} playerName={p.displayName} size="sm" />
 */
export function PlayerAvatar({ playerId, playerName, src, className, size, ...props }: PlayerAvatarProps) {
    const seed = playerId || playerName || "default";

    const config = useMemo(() => genConfig(seed), [seed]);

    // Map HeroUI sizes to pixel values
    const sizeMap: Record<string, string> = { sm: "2rem", md: "2.5rem", lg: "3.5rem" };
    const cssSize = sizeMap[size as string] || "2rem";

    // If there's an actual image URL, just use the normal Avatar
    if (src) {
        return (
            <Avatar
                src={src}
                name={playerName || undefined}
                className={className}
                size={size}
                {...props}
            />
        );
    }

    // No image — show react-nice-avatar character
    return (
        <NiceAvatar
            style={{ width: cssSize, height: cssSize }}
            className={className}
            {...config}
        />
    );
}
