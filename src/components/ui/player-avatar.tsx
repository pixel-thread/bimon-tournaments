"use client";

import { Avatar, type AvatarProps } from "@heroui/react";
import Avatar2 from "boring-avatars";

interface PlayerAvatarProps extends Omit<AvatarProps, "fallback" | "showFallback"> {
    /** Player ID for deterministic avatar assignment */
    playerId?: string;
    /** Player display name — used if no image */
    playerName?: string;
}

/** Color palette for generated avatars — vibrant game-themed */
const AVATAR_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#FF9FF3", "#54A0FF", "#5F27CD", "#01A3A4"];

/**
 * Avatar component for players.
 * - If `src` (image URL) is provided → shows the image
 * - Otherwise → shows a colorful generated "beam" avatar (modern character face)
 *
 * Usage: <PlayerAvatar src={p.imageUrl} playerId={p.id} playerName={p.displayName} size="sm" />
 */
export function PlayerAvatar({ playerId, playerName, src, className, size, ...props }: PlayerAvatarProps) {
    const seed = playerId || playerName || "default";

    // Map HeroUI sizes to pixel values for boring-avatars
    const sizeMap: Record<string, number> = { sm: 32, md: 40, lg: 56 };
    const pxSize = sizeMap[size as string] || 32;

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

    // No image — show boring-avatars "beam" character
    return (
        <Avatar
            showFallback
            className={className}
            size={size}
            {...props}
            fallback={
                <Avatar2
                    size={pxSize}
                    name={seed}
                    variant="beam"
                    colors={AVATAR_COLORS}
                />
            }
        />
    );
}
