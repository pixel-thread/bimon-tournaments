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
 * Check if an image URL is a Google/Clerk default avatar (just initials, not a real photo).
 * These are boring colored circles — we replace them with nice avatars.
 */
function isDefaultAvatar(url: string): boolean {
    // Google default avatars
    if (url.includes("lh3.googleusercontent.com/a/")) return true;
    // Clerk default avatars (initials)
    if (url.includes("img.clerk.com") && !url.includes("oauth_google")) return true;
    // Gravatar default
    if (url.includes("gravatar.com") && url.includes("d=")) return true;
    return false;
}

/**
 * Avatar component for players.
 * - If `src` is a real uploaded photo → shows the image
 * - If `src` is a Google/Clerk default (initials) → shows nice avatar instead
 * - If no `src` → shows nice avatar
 *
 * Usage: <PlayerAvatar src={p.imageUrl} playerId={p.id} playerName={p.displayName} size="sm" />
 */
export function PlayerAvatar({ playerId, playerName, src, className, size, ...props }: PlayerAvatarProps) {
    const seed = playerId || playerName || "default";

    const config = useMemo(() => genConfig(seed), [seed]);

    // Map HeroUI sizes to pixel values
    const sizeMap: Record<string, string> = { sm: "2rem", md: "2.5rem", lg: "3.5rem" };
    const cssSize = sizeMap[size as string] || "2rem";

    // Use real photo only if it's an actual uploaded image, not a default avatar
    const hasRealPhoto = src && !isDefaultAvatar(src);

    if (hasRealPhoto) {
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

    // No real photo — show react-nice-avatar character
    return (
        <NiceAvatar
            style={{ width: cssSize, height: cssSize }}
            className={className}
            {...config}
        />
    );
}
