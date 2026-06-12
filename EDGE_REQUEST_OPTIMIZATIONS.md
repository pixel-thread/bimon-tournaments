# 🔄 Edge Request Optimizations — Revert Guide

> **Date:** June 12, 2026  
> **Reason:** Vercel free tier hit 75% of 1M Edge Requests by June 12  
> **Root Cause:** RoomInfoBanner (polling 30s on ALL pages) + Channel page (polling 15s)  
> **When to revert:** After upgrading to Vercel Pro, or at the start of next billing cycle

---

## Summary of All Changes

| # | Change | File | Original | Now | Revert? |
|---|--------|------|----------|-----|---------|
| 1 | RoomInfoBanner removed | `layout.tsx` | Polling 30s all pages | Commented out | Low — use WhatsApp |
| 2 | Channel tab hidden | `mobile-nav.tsx` | Visible in nav | Hidden | Medium |
| 3 | Duplicate notifications merged | `use-squad-invite-count.ts` + `header.tsx` | 2 calls to `/api/notifications` | 1 shared call | **Keep forever** |
| 4 | Clan invite polling frozen | `use-clan-invite-count.ts` | 60s polling | Window focus only | Medium |
| 5 | Bracket polling frozen | `bracket/[id]/page.tsx` | 30s polling | Window focus only | High (if bracket active) |
| 6 | My Slot polling → refresh button | `my-slot-page.tsx` | 15s polling | Refresh button + window focus | High (if you want auto) |
| 7 | Polls staleTime increased | `use-polls.ts` | 30s | 2min | Low |
| 8 | Squads staleTime increased | `use-squads.ts` | 15s | 60s | Low |
| 9 | Cache busters `_t=` removed | `use-polls.ts` + `use-squads.ts` | `_t=${Date.now()}` | Removed | **Keep forever** |
| 10 | Public settings cache increased | `header.tsx` | 5min staleTime | 15min | Low |

---

## Revert Instructions Per File

### 1. RoomInfoBanner — DELETED

Component file `src/components/common/room-info-banner.tsx` was **deleted**.
To restore, create the file with this code, then add `<RoomInfoBanner />` to `layout.tsx`:

<details>
<summary>Click to expand full component code</summary>

```tsx
"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Check, KeyRound, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { ActiveRoomInfo } from "@/app/api/room-info/active/route";

export function RoomInfoBanner() {
    const [dismissed, setDismissed] = useState(false);
    const [copied, setCopied] = useState(false);

    const { data: roomInfo } = useQuery<ActiveRoomInfo | null>({
        queryKey: ["active-room-info"],
        queryFn: async () => {
            const res = await fetch("/api/room-info/active");
            if (!res.ok) return null;
            const json = await res.json();
            return json.data || null;
        },
        refetchInterval: 30_000,
        staleTime: 15_000,
    });

    const handleCopy = useCallback(async () => {
        if (!roomInfo) return;
        try {
            await navigator.clipboard.writeText(roomInfo.roomId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const ta = document.createElement("textarea");
            ta.value = roomInfo.roomId;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [roomInfo]);

    if (!roomInfo || dismissed) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: -60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -60, opacity: 0 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                className="fixed top-16 left-0 right-0 z-40"
            >
                <div className="mx-auto max-w-2xl px-3 py-1.5">
                    <div className="relative rounded-xl border border-primary/20 bg-background/95 backdrop-blur-xl shadow-lg shadow-primary/5 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 animate-pulse" />
                        <div className="relative px-4 py-3">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                                    </span>
                                    <span className="text-xs font-semibold text-foreground/70">
                                        Match {roomInfo.matchNumber} — {roomInfo.map}
                                    </span>
                                    {roomInfo.tournamentName && (
                                        <span className="text-xs text-foreground/30 hidden sm:inline">
                                            • {roomInfo.tournamentName}
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => setDismissed(true)}
                                    className="p-1 rounded-full hover:bg-foreground/10 transition-colors"
                                >
                                    <X className="w-3 h-3 text-foreground/30" />
                                </button>
                            </div>
                            <div className="flex items-center gap-3">
                                <KeyRound className="w-4 h-4 text-primary shrink-0" />
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 rounded-lg px-3 py-1.5 transition-colors group"
                                >
                                    <span className="text-sm font-mono font-bold tracking-wider text-primary">
                                        {roomInfo.roomId}
                                    </span>
                                    {copied ? (
                                        <Check className="w-3.5 h-3.5 text-success" />
                                    ) : (
                                        <Copy className="w-3.5 h-3.5 text-primary/50 group-hover:text-primary transition-colors" />
                                    )}
                                </button>
                                <div className="w-px h-5 bg-foreground/10" />
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-foreground/40">Pass:</span>
                                    <span className="text-sm font-mono font-bold text-foreground/80">
                                        {roomInfo.password}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
```

</details>

---

### 2. Channel Tab — `src/components/layout/mobile-nav.tsx`

```diff
  ...(GAME.features.hasBracket
      ? [{ label: "Matches", href: "/bracket", icon: Swords }]
-     : []),
- { label: "My Slot", href: "/games", icon: Gamepad2 },
- // Channel disabled — using WhatsApp now
+     : [{ label: "Channel", href: "/channel", icon: MessageCircle }]),
```

> NOTE: Also remove the `{ label: "My Slot", ... }` entry if you re-enable Channel, or keep both.

---

### 3. Clan Invite Polling — `src/hooks/use-clan-invite-count.ts`

```diff
- staleTime: 5 * 60 * 1000,
- // refetchInterval: 120_000, // FROZEN
- refetchOnWindowFocus: true,
+ staleTime: 30_000,
+ refetchInterval: 60_000,
```

---

### 4. Bracket Polling — `src/app/(app)/bracket/[id]/page.tsx`

```diff
- // refetchInterval: 60_000, // FROZEN
- refetchOnWindowFocus: true,
+ refetchInterval: 30_000,
```

---

### 5. My Slot Polling + Refresh Button — `src/components/game/my-slot-page.tsx`

To restore auto-polling and remove the refresh button:

**Query (~line 103):**
```diff
- const { data, isLoading, refetch, isFetching } = useQuery<MyGameData>({
+ const { data, isLoading } = useQuery<MyGameData>({
      queryKey: ["my-game"],
      queryFn: () => fetch("/api/my-game").then(r => r.json()),
-     // refetchInterval removed — manual refresh button
-     refetchOnWindowFocus: true,
+     refetchInterval: 15000,
  });
```

**Header area (~line 138):** Remove the refresh button and `flex-1 min-w-0`:
```diff
-                        <div className="flex-1 min-w-0">
+                        <div>
                             ...
                         </div>
-                        <button onClick={() => refetch()} ...>
-                            <RefreshCw ... />
-                        </button>
```

**Imports:** Remove `RefreshCw` from lucide-react imports.

---

### 6. Polls staleTime — `src/hooks/use-polls.ts`

```diff
- staleTime: 2 * 60 * 1000,
+ staleTime: 30 * 1000,
```

Also restore cache buster if needed:
```diff
- const res = await fetch("/api/polls");
+ const res = await fetch(`/api/polls?_t=${Date.now()}`);
```

---

### 7. Squads staleTime — `src/hooks/use-squads.ts`

```diff
- staleTime: 60_000,
+ staleTime: 15_000,
```

Also restore cache buster:
```diff
- const res = await fetch(`/api/squads?pollId=${pollId}`);
+ const res = await fetch(`/api/squads?pollId=${pollId}&_t=${Date.now()}`);
```

---

### 8. Public Settings — `src/components/layout/header.tsx`

```diff
- staleTime: 15 * 60 * 1000,
+ staleTime: 5 * 60 * 1000,
```

---

## ✅ Changes to KEEP Permanently (good optimizations)

These are genuine improvements, not workarounds. **Don't revert:**

1. **Merged duplicate `/api/notifications` call** — `useSquadInviteCount` now shares `["notification-count"]` query key with header. Saves 1 API call per page load.
2. **Removed `_t=${Date.now()}` cache busters** — allows proper browser/CDN caching. React Query handles freshness via `staleTime`.
3. **RoomInfoBanner removed** — room IDs are sent via WhatsApp now, banner is redundant.
