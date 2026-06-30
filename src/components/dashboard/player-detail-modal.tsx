"use client";

import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    Avatar,
    Chip,
    Button,
    Input,
    Select,
    SelectItem,
    Skeleton,
    Textarea,
    Switch,
} from "@heroui/react";
import {
    Crown,
    ShieldBan,
    ShieldCheck,
    ShieldAlert,
    BadgeDollarSign,
    Wallet,
    Plus,
    Minus,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    ChevronDown,
    Link2,
    Flame,
    Phone,
    Mail,
    Hash,
    Link,
    Unlink,
    Pencil,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CategoryBadge } from "@/components/ui/category-badge";
import { GAME } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";
import { toast } from "sonner";

interface PlayerDetailModalProps {
    playerId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

interface PlayerDetail {
    id: string;
    displayName: string | null;
    realName: string | null;
    username: string;
    email: string | null;
    secondaryEmail: string | null;
    imageUrl: string | null;
    category: string;
    isBanned: boolean;
    hasRoyalPass: boolean;
    isUCExempt: boolean;
    isTrusted: boolean;
    uid: string | null;
    phoneNumber: string | null;
    bio: string | null;
    createdAt: string;
    balance: number;
    stats: { kills: number; matches: number; kd: number };
    streak: { current: number; longest: number };
    ban: { reason: string | null; bannedAt: string | null; duration: number } | null;
}

interface Transaction {
    id: string;
    amount: number;
    type: "CREDIT" | "DEBIT";
    description: string;
    createdAt: string;
}



export function PlayerDetailModal({ playerId, isOpen, onClose }: PlayerDetailModalProps) {
    const queryClient = useQueryClient();
    const [ucAmount, setUcAmount] = useState("");
    const [ucType, setUcType] = useState<"CREDIT" | "DEBIT">("CREDIT");
    const [ucCurrency, setUcCurrency] = useState<"BP" | "DIAMOND">("BP");
    const [ucDescription, setUcDescription] = useState(GAME.hasDualCurrency ? "BP Top-up" : `${GAME.currency} Top-up`);

    // Label for the currently selected currency
    const activeCurrencyLabel = GAME.hasDualCurrency
        ? (ucCurrency === "DIAMOND" ? (GAME.rewardCurrency ?? "Diamond") : (GAME.entryCurrency ?? "BP"))
        : GAME.currency;
    const [banReason, setBanReason] = useState("");
    const [activeTab, setActiveTab] = useState<"overview" | "transactions">("overview");
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const toggleSection = (key: string) => setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
    const [mergeSearch, setMergeSearch] = useState("");
    const [mergeSelected, setMergeSelected] = useState<{ id: string; displayName: string; username: string; email: string; imageUrl: string | null } | null>(null);
    const [mergeSuggestions, setMergeSuggestions] = useState<{ id: string; displayName: string; username: string; email: string; imageUrl: string | null }[]>([]);
    const [mergeSearching, setMergeSearching] = useState(false);
    const mergeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [secondaryEmailInput, setSecondaryEmailInput] = useState("");
    const [editingSecondary, setEditingSecondary] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState("");
    const [editingEmail, setEditingEmail] = useState(false);
    const [emailInput, setEmailInput] = useState("");
    const [editingPhone, setEditingPhone] = useState(false);
    const [phoneInput, setPhoneInput] = useState("");

    // Debounced search for merge autocomplete
    useEffect(() => {
        if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current);
        if (!mergeSearch || mergeSearch.length < 2 || mergeSelected) {
            setMergeSuggestions([]);
            return;
        }
        setMergeSearching(true);
        mergeTimerRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/players/search?q=${encodeURIComponent(mergeSearch)}`);
                const json = await res.json();
                // Filter out the current player from suggestions
                setMergeSuggestions((json.data || []).filter((p: { id: string }) => p.id !== playerId));
            } catch { setMergeSuggestions([]); }
            setMergeSearching(false);
        }, 300);
        return () => { if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current); };
    }, [mergeSearch, mergeSelected, playerId]);

    // Fetch player details
    const { data: player, isLoading } = useQuery<PlayerDetail>({
        queryKey: ["admin-player", playerId],
        queryFn: async () => {
            const res = await fetch(`/api/players/${playerId}`);
            if (!res.ok) throw new Error("Failed to fetch");
            return res.json();
        },
        enabled: !!playerId && isOpen,
    });

    // Fetch transactions
    const { data: txData, isLoading: txLoading } = useQuery<{ data: Transaction[] }>({
        queryKey: ["admin-player-transactions", playerId],
        queryFn: async () => {
            const res = await fetch(`/api/players/${playerId}/transactions?limit=30`);
            if (!res.ok) throw new Error("Failed to fetch");
            return res.json();
        },
        enabled: !!playerId && isOpen && activeTab === "transactions",
    });

    // UC mutation
    const walletMutation = useMutation({
        mutationFn: async (data: { amount: number; type: string; description: string; currency?: string }) => {
            const res = await fetch(`/api/players/${playerId}/wallet`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to update");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-player", playerId] });
            queryClient.invalidateQueries({ queryKey: ["admin-player-transactions", playerId] });
            queryClient.invalidateQueries({ queryKey: ["admin-players"] });
            setUcAmount("");
            setUcDescription(GAME.hasDualCurrency ? `${activeCurrencyLabel} Top-up` : `${GAME.currency} Top-up`);
        },
    });

    // Ban mutation
    const banMutation = useMutation({
        mutationFn: async (data: { isBanned: boolean; reason?: string }) => {
            const res = await fetch(`/api/players/${playerId}/ban`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to update");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-player", playerId] });
            queryClient.invalidateQueries({ queryKey: ["admin-players"] });
            setBanReason("");
        },
    });

    // Toggle mutation (isTrusted / isUCExempt)
    const toggleMutation = useMutation({
        mutationFn: async (data: { isTrusted?: boolean; isUCExempt?: boolean }) => {
            const res = await fetch(`/api/players/${playerId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to update");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-player", playerId] });
            queryClient.invalidateQueries({ queryKey: ["admin-players"] });
        },
    });

    // Link/merge player mutation
    const linkMutation = useMutation({
        mutationFn: async (data: { query: string }) => {
            const res = await fetch(`/api/players/${playerId}/link`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || json.error || "Failed to link");
            return json;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-player", playerId] });
            queryClient.invalidateQueries({ queryKey: ["admin-players"] });
            setMergeSearch("");
            setMergeSelected(null);
            setMergeSuggestions([]);
        },
    });

    const secondaryEmailMutation = useMutation({
        mutationFn: async (email: string | null) => {
            const res = await fetch(`/api/players/${playerId}/secondary-email`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || json.error || "Failed");
            return json;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["admin-player", playerId] });
            queryClient.invalidateQueries({ queryKey: ["admin-players"] });
            setEditingSecondary(false);
            setSecondaryEmailInput("");
            toast.success(data.message);
        },
        onError: (err: Error) => {
            toast.error(err.message);
        },
    });

    // Rename mutation
    const renameMutation = useMutation({
        mutationFn: async (displayName: string) => {
            const res = await fetch(`/api/players/${playerId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ displayName }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to rename");
            return json;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-player", playerId] });
            queryClient.invalidateQueries({ queryKey: ["admin-players"] });
            setEditingName(false);
            setNameInput("");
            toast.success("Player renamed");
        },
        onError: (err: Error) => {
            toast.error(err.message);
        },
    });

    // Edit player mutation (name, email, phone — uses same PATCH endpoint)
    const fieldEditMutation = useMutation({
        mutationFn: async (data: { displayName?: string; email?: string | null; phoneNumber?: string | null }) => {
            const res = await fetch(`/api/players/${playerId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to update");
            return json;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-player", playerId] });
            queryClient.invalidateQueries({ queryKey: ["admin-players"] });
            setEditingName(false);
            setNameInput("");
            setEmailInput("");
            setPhoneInput("");
            toast.success("Player updated");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const handleUcSubmit = () => {
        const amt = parseInt(ucAmount);
        if (!amt || amt <= 0 || !ucDescription.trim()) return;
        walletMutation.mutate({
            amount: amt,
            type: ucType,
            description: ucDescription.trim(),
            ...(GAME.hasDualCurrency ? { currency: ucCurrency } : {}),
        });
    };

    const handleBanToggle = () => {
        if (!player) return;
        banMutation.mutate({
            isBanned: !player.isBanned,
            reason: banReason || undefined,
        });
    };

    // Group transactions by date
    const groupedTransactions = txData?.data?.reduce<Record<string, Transaction[]>>((acc, tx) => {
        const dateKey = new Date(tx.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(tx);
        return acc;
    }, {});

    return (
        <>
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="2xl"
            scrollBehavior="inside"
            classNames={{
                base: "max-h-[90vh]",
                body: "px-0",
            }}
        >
            <ModalContent>
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute right-3 top-3 z-50 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                >
                    ✕
                </button>
                <ModalHeader className="flex-col gap-0 p-0 overflow-hidden">
                    {isLoading ? (
                        <div className="p-5 space-y-3">
                            <Skeleton className="h-12 w-48 rounded-lg" />
                            <Skeleton className="h-4 w-64 rounded-lg" />
                        </div>
                    ) : (
                        <div className="relative">
                            {/* Gradient background */}
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-secondary/10 to-transparent" />
                            
                            <div className="relative px-5 pt-5 pb-4">
                                {/* Player info row */}
                                <div className="flex items-start gap-3.5">
                                    <div className="relative">
                                        <Avatar
                                            src={player?.imageUrl || undefined}
                                            name={player?.displayName || player?.username}
                                            size="lg"
                                            className="ring-2 ring-background shadow-lg"
                                        />
                                        {player?.hasRoyalPass && (
                                            <div className="absolute -top-1 -right-1 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full p-0.5 shadow-md">
                                                <Crown className="h-3 w-3 text-black" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start gap-1.5 flex-wrap">
                                            <h2 className="text-lg font-bold leading-snug" style={{ wordBreak: "break-word" }}>
                                                {player?.displayName || player?.username}
                                            </h2>
                                            <button
                                                onClick={() => {
                                                    setNameInput(player?.displayName || player?.username || "");
                                                    setEmailInput(player?.email || "");
                                                    setPhoneInput(player?.phoneNumber || "");
                                                    setEditingName(true);
                                                }}
                                                className="p-1 rounded-md text-foreground/25 hover:text-primary hover:bg-primary/10 transition-colors mt-0.5 cursor-pointer"
                                                title="Edit player"
                                            >
                                                <Pencil className="h-3 w-3" />
                                            </button>
                                            {player?.isBanned && (
                                                <Chip size="sm" color="danger" variant="flat" className="h-5 shrink-0 mt-0.5">
                                                    Banned
                                                </Chip>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-xs text-foreground/50">@{player?.username}</span>
                                            {player?.category && <CategoryBadge category={player.category} size="sm" />}
                                        </div>
                                        {/* Contact row */}
                                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                            <span className="flex items-center gap-1 text-[11px] text-foreground/40">
                                                <Mail className="h-3 w-3 shrink-0" />
                                                <span className="break-all">{player?.email || "—"}</span>
                                            </span>
                                            <span className="flex items-center gap-1 text-[11px] text-foreground/40">
                                                <Phone className="h-3 w-3 shrink-0" />
                                                {player?.phoneNumber || "—"}
                                            </span>
                                        </div>
                                        {/* Expandable details toggle */}
                                        <button
                                            type="button"
                                            onClick={() => toggleSection("headerInfo")}
                                            className="flex items-center gap-0.5 text-[10px] text-foreground/30 hover:text-primary transition-colors mt-1.5 cursor-pointer"
                                        >
                                            {expandedSections.headerInfo ? "Less" : "More info"}
                                            <ChevronDown className={`h-2.5 w-2.5 transition-transform ${expandedSections.headerInfo ? "rotate-180" : ""}`} />
                                        </button>
                                        {expandedSections.headerInfo && (
                                        <div className="mt-1.5 space-y-1">
                                            {/* Real name (Google account name) — admin only */}
                                            {player?.realName && (
                                                <p className="text-[11px] text-foreground/40 flex items-center gap-1">
                                                    <span className="text-foreground/25">Real:</span> {player.realName}
                                                </p>
                                            )}
                                            {/* UID */}
                                            {player?.uid && (
                                                <span className="flex items-center gap-1 text-[11px] text-foreground/40">
                                                    <Hash className="h-3 w-3 shrink-0" />
                                                    <span className="font-mono">{player.uid}</span>
                                                </span>
                                            )}

                                        {/* Secondary email */}
                                        <div className="flex items-center gap-1.5 mt-1">
                                            {editingSecondary ? (
                                                <div className="flex items-center gap-1.5 w-full">
                                                    <Input
                                                        size="sm"
                                                        placeholder="Secondary email..."
                                                        value={secondaryEmailInput}
                                                        onValueChange={setSecondaryEmailInput}
                                                        startContent={<Link className="h-3 w-3 text-default-400" />}
                                                        className="flex-1"
                                                        classNames={{ inputWrapper: "h-7 min-h-7", input: "text-[11px]" }}
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter" && secondaryEmailInput.trim()) {
                                                                secondaryEmailMutation.mutate(secondaryEmailInput.trim());
                                                            } else if (e.key === "Escape") {
                                                                setEditingSecondary(false);
                                                            }
                                                        }}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        color="primary"
                                                        variant="flat"
                                                        isLoading={secondaryEmailMutation.isPending}
                                                        className="h-7 min-w-0 px-2 text-[11px]"
                                                        onPress={() => secondaryEmailInput.trim() && secondaryEmailMutation.mutate(secondaryEmailInput.trim())}
                                                    >
                                                        Link
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="flat"
                                                        className="h-7 min-w-0 px-2 text-[11px]"
                                                        onPress={() => setEditingSecondary(false)}
                                                    >
                                                        ✕
                                                    </Button>
                                                </div>
                                            ) : player?.secondaryEmail ? (
                                                <span className="flex items-center gap-1 text-[11px] text-foreground/40">
                                                    <Link className="h-3 w-3 text-success" />
                                                    <span className="truncate max-w-[160px]">{player.secondaryEmail}</span>
                                                    <button
                                                        onClick={() => { setSecondaryEmailInput(player.secondaryEmail || ""); setEditingSecondary(true); }}
                                                        className="text-primary hover:text-primary/80 ml-0.5"
                                                        title="Edit secondary email"
                                                    >
                                                        ✎
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm(`Remove secondary email "${player.secondaryEmail}"?`)) {
                                                                secondaryEmailMutation.mutate(null);
                                                            }
                                                        }}
                                                        className="text-danger hover:text-danger/80 ml-0.5"
                                                        title="Unlink secondary email"
                                                    >
                                                        <Unlink className="h-3 w-3" />
                                                    </button>
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => { setSecondaryEmailInput(""); setEditingSecondary(true); }}
                                                    className="flex items-center gap-1 text-[11px] text-foreground/30 hover:text-primary transition-colors"
                                                >
                                                    <Link className="h-3 w-3" />
                                                    Link secondary email
                                                </button>
                                            )}
                                        </div>
                                        {/* Bio */}
                                        {player?.bio && (
                                            <p className="text-xs italic text-foreground/40">&ldquo;{player.bio}&rdquo;</p>
                                        )}
                                    </div>
                                    )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </ModalHeader>

                <ModalBody className="gap-0 pb-6">
                    {/* Tab switcher */}
                    <div className="flex gap-0 border-b border-divider mx-4 mb-4">
                        <button
                            onClick={() => setActiveTab("overview")}
                            className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors relative ${activeTab === "overview"
                                ? "text-primary"
                                : "text-foreground/40 hover:text-foreground/70"
                                }`}
                        >
                            Overview & Actions
                            {activeTab === "overview" && (
                                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab("transactions")}
                            className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors relative ${activeTab === "transactions"
                                ? "text-primary"
                                : "text-foreground/40 hover:text-foreground/70"
                                }`}
                        >
                            Transactions
                            {txData?.data && txData.data.length > 0 && (
                                <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-foreground/10 text-[10px] font-semibold">
                                    {txData.data.length}
                                </span>
                            )}
                            {activeTab === "transactions" && (
                                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
                            )}
                        </button>
                    </div>

                    <div className="px-4">
                        {isLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-20 w-full rounded-xl" />
                                <Skeleton className="h-32 w-full rounded-xl" />
                            </div>
                        ) : activeTab === "overview" ? (
                            <div className="space-y-3">
                                {/* UC Credit/Debit form */}
                                <div className="space-y-3 rounded-xl border border-divider p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10">
                                                <Wallet className="h-3.5 w-3.5 text-primary" />
                                            </div>
                                            <h3 className="text-sm font-semibold">Wallet</h3>
                                        </div>
                                        <div className="flex flex-col items-end gap-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <CurrencyIcon size={14} variant="entry" />
                                                <span className={`text-sm font-bold ${(player?.balance ?? 0) < 0 ? "text-danger" : "text-primary"}`}>
                                                    {player?.balance?.toLocaleString()} {GAME.hasDualCurrency ? GAME.entryCurrency : GAME.currency}
                                                </span>
                                            </div>
                                            {GAME.hasDualCurrency && (
                                                <div className="flex items-center gap-1.5">
                                                    <CurrencyIcon size={14} variant="reward" />
                                                    <span className="text-sm font-bold text-primary">
                                                        {((player as any)?.diamondBalance ?? 0).toLocaleString()} {GAME.rewardCurrency}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Currency selector for dual-currency games */}
                                    {GAME.hasDualCurrency && (
                                        <div className="flex items-center gap-1 p-1 rounded-lg bg-default-100">
                                            {([
                                                { key: "BP" as const, label: GAME.entryCurrency ?? "BP", emoji: GAME.entryCurrencyEmoji ?? "⚔️" },
                                                { key: "DIAMOND" as const, label: GAME.rewardCurrency ?? "Diamond", emoji: GAME.rewardCurrencyEmoji ?? "💎" },
                                            ]).map(({ key, label, emoji }) => (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => {
                                                        setUcCurrency(key);
                                                        setUcDescription(`${label} Top-up`);
                                                    }}
                                                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer ${
                                                        ucCurrency === key
                                                            ? "bg-background shadow-sm text-foreground"
                                                            : "text-foreground/50 hover:text-foreground/70"
                                                    }`}
                                                >
                                                    <span>{emoji}</span>
                                                    <span>{label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <Select
                                            size="sm"
                                            selectedKeys={[ucType]}
                                            onSelectionChange={(keys) => {
                                                const val = Array.from(keys)[0] as string;
                                                if (val) setUcType(val as "CREDIT" | "DEBIT");
                                            }}
                                            className="w-32"
                                            aria-label="Transaction type"
                                        >
                                            <SelectItem key="CREDIT">Credit</SelectItem>
                                            <SelectItem key="DEBIT">Debit</SelectItem>
                                        </Select>
                                        <Input
                                            size="sm"
                                            type="number"
                                            placeholder="Amount"
                                            value={ucAmount}
                                            onValueChange={setUcAmount}
                                            startContent={
                                                ucType === "CREDIT" ? (
                                                    <Plus className="h-3 w-3 text-success" />
                                                ) : (
                                                    <Minus className="h-3 w-3 text-danger" />
                                                )
                                            }
                                            className="flex-1"
                                        />
                                    </div>
                                    <Textarea
                                        size="sm"
                                        placeholder="Reason (e.g. Tournament prize, penalty...)"
                                        value={ucDescription}
                                        onValueChange={setUcDescription}
                                        minRows={1}
                                        maxRows={2}
                                    />
                                    <Button
                                        size="sm"
                                        color={ucType === "CREDIT" ? "success" : "danger"}
                                        variant="flat"
                                        onPress={handleUcSubmit}
                                        isLoading={walletMutation.isPending}
                                        isDisabled={!ucAmount || !ucDescription.trim()}
                                        className="w-full"
                                    >
                                        {ucType === "CREDIT" ? "Credit" : "Debit"} {ucAmount || "0"} {activeCurrencyLabel}
                                    </Button>
                                    {walletMutation.isSuccess && (
                                        <p className="text-center text-xs text-success">
                                            ✓ {activeCurrencyLabel} balance updated successfully
                                        </p>
                                    )}
                                    {walletMutation.isError && (
                                        <p className="text-center text-xs text-danger">
                                            Failed to update balance
                                        </p>
                                    )}
                                </div>

                                {/* Player Flags — collapsed by default */}
                                <div className="rounded-xl border border-divider">
                                    <button
                                        type="button"
                                        onClick={() => toggleSection("flags")}
                                        className="flex w-full items-center justify-between p-3 text-sm font-semibold cursor-pointer hover:bg-default-50 rounded-xl transition-colors"
                                    >
                                        <span className="flex items-center gap-2">
                                            <ShieldAlert className="h-4 w-4 text-primary" />
                                            Player Flags
                                        </span>
                                        <ChevronDown className={`h-4 w-4 text-foreground/40 transition-transform ${expandedSections.flags ? "rotate-180" : ""}`} />
                                    </button>
                                    {expandedSections.flags && (
                                        <div className="space-y-3 px-4 pb-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <ShieldAlert className="h-4 w-4 text-primary" />
                                                    <div>
                                                        <p className="text-sm font-medium">Trusted Player</p>
                                                        <p className="text-xs text-foreground/50">Extended credit line (-200 {GAME.currency})</p>
                                                    </div>
                                                </div>
                                                <Switch
                                                    size="sm"
                                                    isSelected={player?.isTrusted ?? false}
                                                    isDisabled={toggleMutation.isPending}
                                                    onValueChange={(val) => toggleMutation.mutate({ isTrusted: val })}
                                                    aria-label="Toggle trusted"
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <BadgeDollarSign className="h-4 w-4 text-warning" />
                                                    <div>
                                                        <p className="text-sm font-medium">UC Exempt</p>
                                                        <p className="text-xs text-foreground/50">Skip {GAME.currency} deductions for entry fees</p>
                                                    </div>
                                                </div>
                                                <Switch
                                                    size="sm"
                                                    isSelected={player?.isUCExempt ?? false}
                                                    isDisabled={toggleMutation.isPending}
                                                    onValueChange={(val) => toggleMutation.mutate({ isUCExempt: val })}
                                                    aria-label={`Toggle ${GAME.currency} exempt`}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Ban/Unban — collapsed by default */}
                                <div className="rounded-xl border border-divider">
                                    <button
                                        type="button"
                                        onClick={() => toggleSection("ban")}
                                        className="flex w-full items-center justify-between p-3 text-sm font-semibold cursor-pointer hover:bg-default-50 rounded-xl transition-colors"
                                    >
                                        <span className="flex items-center gap-2">
                                            {player?.isBanned ? <ShieldBan className="h-4 w-4 text-danger" /> : <ShieldBan className="h-4 w-4 text-foreground/40" />}
                                            {player?.isBanned ? "Player is Banned" : "Ban Player"}
                                        </span>
                                        <ChevronDown className={`h-4 w-4 text-foreground/40 transition-transform ${expandedSections.ban ? "rotate-180" : ""}`} />
                                    </button>
                                    {expandedSections.ban && (
                                        <div className="space-y-3 px-4 pb-4">
                                            {player?.ban && (
                                                <p className="text-xs text-foreground/50">
                                                    Reason: {player.ban.reason || "No reason provided"}
                                                    {player.ban.bannedAt && (
                                                        <> · {new Date(player.ban.bannedAt).toLocaleDateString()}</>
                                                    )}
                                                </p>
                                            )}
                                            {!player?.isBanned && (
                                                <Input
                                                    size="sm"
                                                    placeholder="Ban reason (optional)"
                                                    value={banReason}
                                                    onValueChange={setBanReason}
                                                />
                                            )}
                                            <Button
                                                size="sm"
                                                color={player?.isBanned ? "success" : "danger"}
                                                variant="flat"
                                                onPress={handleBanToggle}
                                                isLoading={banMutation.isPending}
                                                startContent={
                                                    player?.isBanned ? (
                                                        <ShieldCheck className="h-4 w-4" />
                                                    ) : (
                                                        <ShieldBan className="h-4 w-4" />
                                                    )
                                                }
                                                className="w-full"
                                            >
                                                {player?.isBanned ? "Unban Player" : "Ban Player"}
                                            </Button>
                                            {banMutation.isSuccess && (
                                                <p className="text-center text-xs text-success">
                                                    ✓ Status updated
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Merge Legacy Player — BGMI only (legacy Season 1 players) */}
                                {GAME.gameName === "BGMI" && (
                                <div className="rounded-xl border border-divider">
                                    <button
                                        type="button"
                                        onClick={() => toggleSection("link")}
                                        className="flex w-full items-center justify-between p-3 text-sm font-semibold cursor-pointer hover:bg-default-50 rounded-xl transition-colors"
                                    >
                                        <span className="flex items-center gap-2">
                                            <Link2 className="h-4 w-4 text-primary" />
                                            Merge Legacy Player
                                        </span>
                                        <ChevronDown className={`h-4 w-4 text-foreground/40 transition-transform ${expandedSections.link ? "rotate-180" : ""}`} />
                                    </button>
                                    {expandedSections.link && (
                                        <div className="space-y-3 px-4 pb-4">
                                            <p className="text-xs text-foreground/40">
                                                Merge this player&apos;s history into another player&apos;s account.
                                            </p>
                                            <p className="text-[10px] text-foreground/30">
                                                Currently linked to: <span className="font-medium text-foreground/60">{player?.email}</span>
                                            </p>

                                            {/* Search with autocomplete */}
                                            <div className="relative">
                                                <Input
                                                    size="sm"
                                                    type="text"
                                                    placeholder="Search player name, username, or email..."
                                                    value={mergeSelected ? `${mergeSelected.displayName} (${mergeSelected.email || mergeSelected.username})` : mergeSearch}
                                                    onValueChange={(val) => {
                                                        if (mergeSelected) {
                                                            setMergeSelected(null);
                                                            setMergeSearch("");
                                                        } else {
                                                            setMergeSearch(val);
                                                        }
                                                    }}
                                                    onClear={() => { setMergeSelected(null); setMergeSearch(""); }}
                                                    isClearable
                                                    startContent={<Link2 className="h-3 w-3 text-foreground/30" />}
                                                    endContent={mergeSearching ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : undefined}
                                                />
                                                {/* Suggestions dropdown */}
                                                {mergeSuggestions.length > 0 && !mergeSelected && (
                                                    <div className="absolute z-50 mt-1 w-full rounded-lg border border-divider bg-content1 shadow-lg overflow-hidden">
                                                        {mergeSuggestions.map((s) => (
                                                            <button
                                                                key={s.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setMergeSelected(s);
                                                                    setMergeSuggestions([]);
                                                                }}
                                                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-default-100 transition-colors cursor-pointer"
                                                            >
                                                                <Avatar src={s.imageUrl || undefined} name={s.displayName || s.username} size="sm" className="h-6 w-6 shrink-0" />
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="truncate font-medium text-xs">{s.displayName || s.username}</p>
                                                                    <p className="truncate text-[10px] text-foreground/40">@{s.username} · {s.email}</p>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <Button
                                                size="sm"
                                                color="primary"
                                                variant="flat"
                                                className="w-full"
                                                isLoading={linkMutation.isPending}
                                                isDisabled={!mergeSelected}
                                                onPress={() => {
                                                    if (mergeSelected && confirm(`Merge "${player?.displayName}" into "${mergeSelected.displayName}" (${mergeSelected.email || mergeSelected.username})?\n\nThis will:\n• Move all stats, matches, wallet balance, and transactions\n• Combine data from both players\n• Delete this old player record\n\nThis cannot be undone.`)) {
                                                        linkMutation.mutate({ query: mergeSelected.email || mergeSelected.username });
                                                    }
                                                }}
                                                startContent={!linkMutation.isPending ? <Link2 className="h-4 w-4" /> : undefined}
                                            >
                                                Merge Player
                                            </Button>
                                            {linkMutation.isSuccess && (
                                                <p className="text-center text-xs text-success">
                                                    ✓ {linkMutation.data?.message || "Player merged successfully"}
                                                </p>
                                            )}
                                            {linkMutation.isError && (
                                                <p className="text-center text-xs text-danger">
                                                    {(linkMutation.error as Error).message}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                                )}
                            </div>
                        ) : (
                            /* Transactions tab */
                            <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                                {txLoading ? (
                                    <div className="space-y-2">
                                        {[1, 2, 3, 4, 5].map((i) => (
                                            <Skeleton key={i} className="h-14 w-full rounded-xl" />
                                        ))}
                                    </div>
                                ) : !txData?.data.length ? (
                                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                                        <div className="flex items-center justify-center h-14 w-14 rounded-full bg-default-100">
                                            <Wallet className="h-6 w-6 text-foreground/20" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground/50">No transactions yet</p>
                                            <p className="text-xs text-foreground/30 mt-0.5">Wallet activity will appear here</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {groupedTransactions && Object.entries(groupedTransactions).map(([dateLabel, txs]) => {
                                            return (
                                                <div key={dateLabel}>
                                                    {/* Date header */}
                                                    <p className="text-[10px] font-semibold text-foreground/25 uppercase tracking-wider px-2 pt-2 pb-1">{dateLabel}</p>

                                                    {/* Transactions for this date */}
                                                    {txs.map((tx) => {
                                                        const allTxs = txData!.data;
                                                        const txIndex = allTxs.indexOf(tx);
                                                        const laterTxs = allTxs.slice(0, txIndex);
                                                        let balAfter = player?.balance ?? 0;
                                                        for (const lt of laterTxs) {
                                                            balAfter -= lt.type === "CREDIT" ? lt.amount : -lt.amount;
                                                        }
                                                        const balBefore = tx.type === "CREDIT"
                                                            ? balAfter - tx.amount
                                                            : balAfter + tx.amount;
                                                        const isCredit = tx.type === "CREDIT";

                                                        return (
                                                            <div
                                                                key={tx.id}
                                                                className="flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-default-50 transition-colors"
                                                            >
                                                                {/* Colored dot */}
                                                                <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${isCredit ? "bg-success" : "bg-danger"}`} />

                                                                {/* Description & meta */}
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[13px] leading-snug">{tx.description}</p>
                                                                    <p className="text-[11px] text-foreground/30 mt-0.5">
                                                                        {balBefore.toLocaleString()} → {balAfter.toLocaleString()} {GAME.currency}
                                                                    </p>
                                                                </div>

                                                                {/* Amount */}
                                                                <span className={`text-[13px] font-bold shrink-0 ${isCredit ? "text-success" : "text-danger"}`}>
                                                                    {isCredit ? "+" : "−"}{tx.amount.toLocaleString()}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </ModalBody>
            </ModalContent>
        </Modal>

            {/* Edit Player Modal */}
            <Modal
                isOpen={editingName}
                onClose={() => setEditingName(false)}
                size="sm"
                placement="center"
                classNames={{ base: "max-w-[380px]" }}
            >
                <ModalContent>
                    <ModalHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <Pencil className="h-4 w-4 text-primary" />
                            <span>Edit Player</span>
                        </div>
                    </ModalHeader>
                    <ModalBody className="pb-5 space-y-3">
                        <Input
                            autoFocus
                            size="sm"
                            label="Display Name"
                            placeholder="Enter new name"
                            value={nameInput}
                            onValueChange={setNameInput}
                            maxLength={20}
                        />
                        <Input
                            size="sm"
                            label="Email"
                            placeholder="player@email.com"
                            value={emailInput}
                            onValueChange={setEmailInput}
                            startContent={<Mail className="h-3 w-3 text-default-400" />}
                        />
                        <Input
                            size="sm"
                            label="Phone"
                            placeholder="10 digit number"
                            value={phoneInput}
                            onValueChange={v => setPhoneInput(v.replace(/\D/g, "").slice(0, 10))}
                            maxLength={10}
                            startContent={<Phone className="h-3 w-3 text-default-400" />}
                        />
                        <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            onPress={() => {
                                const updates: Record<string, unknown> = {};
                                if (nameInput.trim().length >= 2 && nameInput.trim() !== (player?.displayName || "")) {
                                    updates.displayName = nameInput.trim();
                                }
                                if (emailInput.trim() !== (player?.email || "")) {
                                    updates.email = emailInput.trim() || null;
                                }
                                if (phoneInput.trim() !== (player?.phoneNumber || "")) {
                                    updates.phoneNumber = phoneInput.trim() || null;
                                }
                                if (Object.keys(updates).length === 0) {
                                    toast.error("No changes to save");
                                    return;
                                }
                                fieldEditMutation.mutate(updates as any);
                            }}
                            isLoading={fieldEditMutation.isPending}
                            className="w-full"
                        >
                            Save Changes
                        </Button>
                    </ModalBody>
                </ModalContent>
            </Modal>
        </>
    );
}
