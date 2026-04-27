"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Card,
    CardBody,
    Button,
    Chip,
    Skeleton,
    Tooltip,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure,
} from "@heroui/react";
import {
    UserX,
    Search,
    Check,
    RotateCcw,
    Phone,
    Mail,
    User,
    AlertCircle,
    Shield,
    Loader2,
    Ban,
    Merge,
    ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────

interface PlayerInfo {
    id: string;
    displayName: string | null;
    phoneNumber: string | null;
    category: string;
    createdAt: string;
    user: {
        username: string;
        email: string | null;
        secondaryEmail: string | null;
        imageUrl: string | null;
    } | null;
}

interface DuplicateAlert {
    id: string;
    matchType: string;
    matchValue: string;
    isReviewed: boolean;
    reviewNote: string | null;
    createdAt: string;
    player1: PlayerInfo;
    player2: PlayerInfo;
}

interface DuplicateData {
    alerts: DuplicateAlert[];
    unreviewedCount: number;
    totalCount: number;
}

// ─── Match type config ──────────────────────────────────────

const MATCH_ICONS: Record<string, typeof Phone> = {
    PHONE: Phone,
    EMAIL: Mail,
    USERNAME: User,
    DISPLAY_NAME: User,
    REAL_NAME: User,
};

const MATCH_COLORS: Record<string, "danger" | "warning" | "primary"> = {
    PHONE: "danger",
    EMAIL: "warning",
    USERNAME: "primary",
    DISPLAY_NAME: "danger",
    REAL_NAME: "warning",
};

const MATCH_LABELS: Record<string, string> = {
    PHONE: "Same Phone",
    EMAIL: "Email Overlap",
    USERNAME: "Same Google Name",
    DISPLAY_NAME: "Similar IGN",
    REAL_NAME: "Same Real Name",
};

// ─── Component ──────────────────────────────────────────────

export default function DuplicatesPage() {
    const queryClient = useQueryClient();
    const [showReviewed, setShowReviewed] = useState(false);

    const { data, isLoading, error } = useQuery<DuplicateData>({
        queryKey: ["duplicate-alerts"],
        queryFn: async () => {
            const res = await fetch("/api/dashboard/duplicates");
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            return json.data;
        },
        staleTime: 30_000,
    });

    const scan = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/dashboard/duplicates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "scan" }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            return json;
        },
        onSuccess: (data) => {
            toast.success(data.message);
            queryClient.invalidateQueries({ queryKey: ["duplicate-alerts"] });
            queryClient.invalidateQueries({ queryKey: ["duplicate-count"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const dismiss = useMutation({
        mutationFn: async ({ alertId, note }: { alertId: string; note?: string }) => {
            const res = await fetch("/api/dashboard/duplicates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "dismiss", alertId, note }),
            });
            if (!res.ok) throw new Error("Failed");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["duplicate-alerts"] });
            queryClient.invalidateQueries({ queryKey: ["duplicate-count"] });
            toast.success("Alert dismissed");
        },
    });

    const undismiss = useMutation({
        mutationFn: async (alertId: string) => {
            const res = await fetch("/api/dashboard/duplicates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "undismiss", alertId }),
            });
            if (!res.ok) throw new Error("Failed");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["duplicate-alerts"] });
            queryClient.invalidateQueries({ queryKey: ["duplicate-count"] });
        },
    });

    // ── Ban / Merge state ────────────────────────────────
    const banModal = useDisclosure();
    const mergeModal = useDisclosure();
    const [selectedAlert, setSelectedAlert] = useState<DuplicateAlert | null>(null);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [keepPlayerId, setKeepPlayerId] = useState<string | null>(null);

    const banPlayer = useMutation({
        mutationFn: async (playerId: string) => {
            const res = await fetch(`/api/players/${playerId}/ban`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isBanned: true, reason: "Duplicate account" }),
            });
            if (!res.ok) throw new Error("Failed to ban player");
        },
        onSuccess: () => {
            toast.success("Player banned");
            banModal.onClose();
            // Auto-dismiss the alert after banning
            if (selectedAlert) dismiss.mutate({ alertId: selectedAlert.id, note: "Banned" });
            setSelectedAlert(null);
            setSelectedPlayerId(null);
            queryClient.invalidateQueries({ queryKey: ["duplicate-alerts"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const mergePlayers = useMutation({
        mutationFn: async ({ oldPlayerId, keepPlayer }: { oldPlayerId: string; keepPlayer: PlayerInfo }) => {
            const query = keepPlayer.user?.username || keepPlayer.displayName || "";
            const res = await fetch(`/api/players/${oldPlayerId}/link`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || json.message || "Failed to merge");
            return json;
        },
        onSuccess: (data) => {
            toast.success(data.message || "Players merged successfully");
            mergeModal.onClose();
            // Auto-dismiss the alert after merging
            if (selectedAlert) dismiss.mutate({ alertId: selectedAlert.id, note: "Merged" });
            setSelectedAlert(null);
            setKeepPlayerId(null);
            queryClient.invalidateQueries({ queryKey: ["duplicate-alerts"] });
            queryClient.invalidateQueries({ queryKey: ["duplicate-count"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const filteredAlerts = data?.alerts.filter(
        (a) => showReviewed || !a.isReviewed
    ) ?? [];

    const mainContent = (
        <div className="space-y-5 p-4">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <UserX className="h-5 w-5 text-danger" />
                        <h1 className="text-lg font-bold">Duplicate Accounts</h1>
                    </div>
                    <p className="text-xs text-foreground/40 mt-0.5">
                        Detect players who might have multiple accounts
                    </p>
                </div>
                <Button
                    size="sm"
                    color="primary"
                    variant="flat"
                    isLoading={scan.isPending}
                    startContent={!scan.isPending && <Search className="h-3.5 w-3.5" />}
                    onPress={() => scan.mutate()}
                    className="font-semibold"
                >
                    {scan.isPending ? "Scanning..." : "Scan All"}
                </Button>
            </div>

            {/* Stats bar */}
            {data && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3"
                >
                    <Card className="flex-1 border border-divider">
                        <CardBody className="p-3 flex-row items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/10">
                                <AlertCircle className="h-5 w-5 text-danger" />
                            </div>
                            <div>
                                <p className="text-[10px] font-medium uppercase tracking-wider text-foreground/40">
                                    Unreviewed
                                </p>
                                <p className="text-xl font-bold text-danger">
                                    {data.unreviewedCount}
                                </p>
                            </div>
                        </CardBody>
                    </Card>
                    <Card className="flex-1 border border-divider">
                        <CardBody className="p-3 flex-row items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                                <Shield className="h-5 w-5 text-success" />
                            </div>
                            <div>
                                <p className="text-[10px] font-medium uppercase tracking-wider text-foreground/40">
                                    Total Alerts
                                </p>
                                <p className="text-xl font-bold">{data.totalCount}</p>
                            </div>
                        </CardBody>
                    </Card>
                </motion.div>
            )}

            {/* Filter toggle */}
            {data && data.totalCount > data.unreviewedCount && (
                <Button
                    size="sm"
                    variant="flat"
                    onPress={() => setShowReviewed(!showReviewed)}
                    className="text-xs"
                >
                    {showReviewed ? "Hide reviewed" : `Show reviewed (${data.totalCount - data.unreviewedCount})`}
                </Button>
            )}

            {/* Loading */}
            {isLoading && (
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-40 rounded-xl" />
                    ))}
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 rounded-lg bg-danger-50 p-4 text-sm text-danger dark:bg-danger-50/10">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Failed to load duplicate alerts.
                </div>
            )}

            {/* Alerts list */}
            <AnimatePresence mode="popLayout">
                {filteredAlerts.map((alert, i) => {
                    const MatchIcon = MATCH_ICONS[alert.matchType] || User;
                    const color = MATCH_COLORS[alert.matchType] || "primary";

                    return (
                        <motion.div
                            key={alert.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ delay: i * 0.03 }}
                        >
                            <Card
                                className={`border ${alert.isReviewed
                                    ? "border-divider opacity-60"
                                    : "border-danger/30 bg-danger/5"
                                    }`}
                            >
                                <CardBody className="p-4 space-y-3">
                                    {/* Match type badge */}
                                    <div className="flex items-center justify-between">
                                        <Chip
                                            size="sm"
                                            color={color}
                                            variant="flat"
                                            startContent={<MatchIcon className="h-3 w-3" />}
                                            className="text-[10px] font-semibold"
                                        >
                                            {MATCH_LABELS[alert.matchType] || alert.matchType}
                                        </Chip>
                                        <span className="text-[10px] text-foreground/30">
                                            {new Date(alert.createdAt).toLocaleDateString("en-IN", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                        </span>
                                    </div>

                                    {/* Match value */}
                                    <div className="rounded-lg bg-default-50 px-3 py-1.5">
                                        <p className="text-[10px] text-foreground/40">Match Value</p>
                                        <p className="text-xs font-mono font-medium break-all">
                                            {alert.matchValue}
                                        </p>
                                    </div>

                                    {/* Two player cards side by side */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <PlayerCard player={alert.player1} label="Player 1" />
                                        <PlayerCard player={alert.player2} label="Player 2" />
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-1">
                                        {!alert.isReviewed ? (
                                            <>
                                                <Button
                                                    size="sm"
                                                    color="danger"
                                                    variant="flat"
                                                    className="font-semibold"
                                                    startContent={<Ban className="h-3.5 w-3.5" />}
                                                    onPress={() => {
                                                        setSelectedAlert(alert);
                                                        setSelectedPlayerId(null);
                                                        banModal.onOpen();
                                                    }}
                                                >
                                                    Ban
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    color="warning"
                                                    variant="flat"
                                                    className="font-semibold"
                                                    startContent={<Merge className="h-3.5 w-3.5" />}
                                                    onPress={() => {
                                                        setSelectedAlert(alert);
                                                        setKeepPlayerId(null);
                                                        mergeModal.onOpen();
                                                    }}
                                                >
                                                    Merge
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    color="success"
                                                    variant="flat"
                                                    className="flex-1 font-semibold"
                                                    isDisabled={dismiss.isPending}
                                                    startContent={<Check className="h-3.5 w-3.5" />}
                                                    onPress={() => dismiss.mutate({ alertId: alert.id })}
                                                >
                                                    Dismiss
                                                </Button>
                                            </>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="flat"
                                                className="flex-1"
                                                isDisabled={undismiss.isPending}
                                                startContent={<RotateCcw className="h-3.5 w-3.5" />}
                                                onPress={() => undismiss.mutate(alert.id)}
                                            >
                                                Reopen
                                            </Button>
                                        )}
                                    </div>

                                    {alert.reviewNote && (
                                        <p className="text-[10px] text-foreground/40 italic">
                                            Note: {alert.reviewNote}
                                        </p>
                                    )}
                                </CardBody>
                            </Card>
                        </motion.div>
                    );
                })}
            </AnimatePresence>

            {/* Empty state */}
            {!isLoading && filteredAlerts.length === 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-2 py-12 text-center"
                >
                    <Check className="h-10 w-10 text-success/40" />
                    <p className="text-sm font-medium text-foreground/50">All clear!</p>
                    <p className="text-xs text-foreground/30">
                        {data?.totalCount
                            ? "All alerts have been reviewed"
                            : "No suspicious accounts detected. Click \"Scan All\" to run a check."}
                    </p>
                </motion.div>
            )}
        </div>
    );

    // Helper to get player display label
    function playerLabel(p: PlayerInfo) {
        return p.displayName || p.user?.username || p.id.slice(0, 8);
    }

    return (
        <>
            {mainContent}

            {/* ── Ban Modal ─────────────────────────── */}
            <Modal isOpen={banModal.isOpen} onOpenChange={banModal.onOpenChange} size="sm">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex items-center gap-2 text-danger">
                                <Ban className="h-4 w-4" /> Ban Player
                            </ModalHeader>
                            <ModalBody>
                                <p className="text-sm text-foreground/60">Pick which account to ban:</p>
                                {selectedAlert && (
                                    <div className="flex flex-col gap-2">
                                        {[selectedAlert.player1, selectedAlert.player2].map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() => setSelectedPlayerId(p.id)}
                                                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                                                    selectedPlayerId === p.id
                                                        ? "border-danger bg-danger/10"
                                                        : "border-divider hover:border-foreground/20"
                                                }`}
                                            >
                                                {p.user?.imageUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={p.user.imageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                                                ) : (
                                                    <div className="h-8 w-8 rounded-full bg-default-100 flex items-center justify-center text-xs font-bold text-foreground/40">?</div>
                                                )}
                                                <div>
                                                    <p className="text-sm font-semibold">{playerLabel(p)}</p>
                                                    <p className="text-xs text-foreground/40">@{p.user?.username || "?"}</p>
                                                </div>
                                                {p.category === "BOT" && <Chip size="sm" variant="flat" className="ml-auto text-[8px] h-4">BOT</Chip>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </ModalBody>
                            <ModalFooter>
                                <Button size="sm" variant="flat" onPress={onClose}>Cancel</Button>
                                <Button
                                    size="sm"
                                    color="danger"
                                    isDisabled={!selectedPlayerId}
                                    isLoading={banPlayer.isPending}
                                    onPress={() => selectedPlayerId && banPlayer.mutate(selectedPlayerId)}
                                >
                                    Ban {selectedPlayerId ? playerLabel(
                                        selectedAlert!.player1.id === selectedPlayerId ? selectedAlert!.player1 : selectedAlert!.player2
                                    ) : ""}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* ── Merge Modal ─────────────────────────── */}
            <Modal isOpen={mergeModal.isOpen} onOpenChange={mergeModal.onOpenChange} size="sm">
                <ModalContent>
                    {() => {
                        const keepPlayer = selectedAlert && keepPlayerId
                            ? (selectedAlert.player1.id === keepPlayerId ? selectedAlert.player1 : selectedAlert.player2)
                            : null;
                        const removePlayer = selectedAlert && keepPlayerId
                            ? (selectedAlert.player1.id === keepPlayerId ? selectedAlert.player2 : selectedAlert.player1)
                            : null;

                        return (
                            <>
                                <ModalHeader className="flex items-center gap-2 text-warning">
                                    <Merge className="h-4 w-4" /> Merge Players
                                </ModalHeader>
                                <ModalBody>
                                    <p className="text-sm text-foreground/60">Pick which account to <strong>keep</strong>. The other will be merged into it and deleted.</p>
                                    {selectedAlert && (
                                        <div className="flex flex-col gap-2">
                                            {[selectedAlert.player1, selectedAlert.player2].map((p) => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => setKeepPlayerId(p.id)}
                                                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                                                        keepPlayerId === p.id
                                                            ? "border-warning bg-warning/10"
                                                            : "border-divider hover:border-foreground/20"
                                                    }`}
                                                >
                                                    {p.user?.imageUrl ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={p.user.imageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                                                    ) : (
                                                        <div className="h-8 w-8 rounded-full bg-default-100 flex items-center justify-center text-xs font-bold text-foreground/40">?</div>
                                                    )}
                                                    <div>
                                                        <p className="text-sm font-semibold">{playerLabel(p)}</p>
                                                        <p className="text-xs text-foreground/40">@{p.user?.username || "?"}</p>
                                                    </div>
                                                    {keepPlayerId === p.id && (
                                                        <Chip size="sm" color="success" variant="flat" className="ml-auto text-[8px] h-5">KEEP</Chip>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {keepPlayer && removePlayer && (
                                        <div className="mt-2 rounded-lg bg-warning/5 border border-warning/20 p-3 text-xs text-foreground/60 space-y-1">
                                            <p className="font-semibold text-warning">This will:</p>
                                            <p>• Move all history from <strong>{playerLabel(removePlayer)}</strong> → <strong>{playerLabel(keepPlayer)}</strong></p>
                                            <p>• Combine wallet balances</p>
                                            <p>• Delete <strong>{playerLabel(removePlayer)}</strong> permanently</p>
                                        </div>
                                    )}
                                </ModalBody>
                                <ModalFooter>
                                    <Button size="sm" variant="flat" onPress={mergeModal.onClose}>Cancel</Button>
                                    <Button
                                        size="sm"
                                        color="warning"
                                        isDisabled={!keepPlayerId || !removePlayer}
                                        isLoading={mergePlayers.isPending}
                                        startContent={<ArrowRight className="h-3.5 w-3.5" />}
                                        onPress={() => {
                                            if (removePlayer && keepPlayer) {
                                                mergePlayers.mutate({ oldPlayerId: removePlayer.id, keepPlayer });
                                            }
                                        }}
                                    >
                                        Merge into {keepPlayer ? playerLabel(keepPlayer) : ""}
                                    </Button>
                                </ModalFooter>
                            </>
                        );
                    }}
                </ModalContent>
            </Modal>
        </>
    );
}

// ─── Player Card Sub-Component ──────────────────────────────

function PlayerCard({ player, label }: { player: PlayerInfo; label: string }) {
    return (
        <div className="rounded-xl border border-divider p-3 space-y-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-foreground/30">
                {label}
            </p>
            <div className="flex items-center gap-2">
                {player.user?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={player.user.imageUrl}
                        alt=""
                        className="h-7 w-7 rounded-full object-cover ring-1 ring-divider"
                    />
                ) : (
                    <div className="h-7 w-7 rounded-full bg-default-100 flex items-center justify-center text-[10px] font-bold text-foreground/40">
                        ?
                    </div>
                )}
                <div className="min-w-0">
                    <p className="text-xs font-bold truncate">
                        {player.displayName || "—"}
                    </p>
                    <p className="text-[10px] text-foreground/40 truncate">
                        @{player.user?.username || "?"}
                    </p>
                </div>
            </div>

            {/* Details */}
            <div className="space-y-0.5 pt-1">
                {player.user?.email && (
                    <Tooltip content={player.user.email} delay={200}>
                        <p className="text-[10px] text-foreground/50 truncate flex items-center gap-1">
                            <Mail className="h-2.5 w-2.5 shrink-0" />
                            {player.user.email}
                        </p>
                    </Tooltip>
                )}
                {player.phoneNumber && (
                    <p className="text-[10px] text-foreground/50 flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5 shrink-0" />
                        {player.phoneNumber}
                    </p>
                )}
                <div className="flex items-center gap-1.5 pt-0.5">
                    <Chip
                        size="sm"
                        variant="flat"
                        className="text-[8px] h-4 min-w-0"
                    >
                        {player.category}
                    </Chip>
                    <span className="text-[9px] text-foreground/30">
                        {new Date(player.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                        })}
                    </span>
                </div>
            </div>
        </div>
    );
}
