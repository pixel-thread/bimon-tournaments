"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Card, CardBody, Button, Textarea, Chip, Switch, Avatar, Input,
    Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure,
    Skeleton,
} from "@heroui/react";
import {
    MessageCircle, Send, Heart, Lightbulb, Bug, Star, HelpCircle,
    ThumbsUp, ThumbsDown, EyeOff, User, Plus, BarChart3,
    Check, X, PlusCircle, Pin, Pencil, Trash2, MoreVertical,
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { GAME } from "@/lib/game-config";
import { useAuthUser } from "@/hooks/use-auth-user";
import { CrossGamePromo } from "@/components/common/cross-game-promo";
import { useLocale } from "@/components/common/locale-provider";

const CATEGORIES = [
    { value: "feedback", label: "Feedback", icon: MessageCircle, color: "primary" as const },
    { value: "suggestion", label: "Suggestion", icon: Lightbulb, color: "warning" as const },
    { value: "bug", label: "Bug Report", icon: Bug, color: "danger" as const },
    { value: "appreciation", label: "Thank You", icon: Heart, color: "success" as const },
    { value: "other", label: "Other", icon: HelpCircle, color: "default" as const },
];

interface MessageDTO {
    id: string;
    message: string;
    category: string;
    isAnonymous: boolean;
    isRead: boolean;
    adminReply: string | null;
    upvotes: number;
    downvotes: number;
    createdAt: string;
    isOwn: boolean;
    isPinned: boolean;
    myVote: number | null;
    game: string;
    player: { displayName: string; imageUrl: string } | null;
}

const GAME_LABELS: Record<string, { label: string; color: string }> = {
    bgmi: { label: "PUBGMI", color: "bg-amber-500/15 text-amber-500" },
    pes: { label: "KICKOFF", color: "bg-emerald-500/15 text-emerald-500" },
    freefire: { label: "BOOYAH", color: "bg-violet-500/15 text-violet-500" },
    mlbb: { label: "MLBB", color: "bg-blue-500/15 text-blue-400" },
};

const ALL_GAMES = [
    { mode: "bgmi", label: "PUBGMI" },
    { mode: "pes", label: "KICKOFF" },
    { mode: "freefire", label: "BOOYAH" },
    { mode: "mlbb", label: "MLBB" },
];

interface PollOptionDTO {
    id: string;
    text: string;
    votes: number;
    addedBy: string | null;
}

interface PollDTO {
    id: string;
    question: string;
    isOwn: boolean;
    creatorName: string;
    totalVotes: number;
    myVoteOptionId: string | null;
    createdAt: string;
    isPinned: boolean;
    game: string;
    options: PollOptionDTO[];
    pendingSuggestions: { id: string; text: string; suggestedBy: string }[];
}

function RotatingSubtitle() {
    const [index, setIndex] = useState(0);
    const { tk } = useLocale();
    const messages = [tk("communitySubtitle1"), tk("communitySubtitle2")];

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((i) => (i + 1) % messages.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [messages.length]);

    return (
        <AnimatePresence mode="wait">
            <motion.p
                key={index}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3 }}
                className="text-sm text-foreground/50"
            >
                {messages[index]}
            </motion.p>
        </AnimatePresence>
    );
}

// ─── Poll Card ────────────────────────────────────────────────
function PollCard({ poll, isSuperAdmin, onVote, onSuggest, onApprove, onReject, onEdit, onDelete, onPin }: {
    poll: PollDTO;
    isSuperAdmin: boolean;
    onVote: (pollId: string, optionId: string) => void;
    onSuggest: (pollId: string, text: string) => void;
    onApprove: (optionId: string) => void;
    onReject: (optionId: string) => void;
    onEdit: (pollId: string, question: string) => void;
    onDelete: (pollId: string) => void;
    onPin: (pollId: string) => void;
}) {
    const [suggestText, setSuggestText] = useState("");
    const [showSuggest, setShowSuggest] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editQuestion, setEditQuestion] = useState(poll.question);
    const maxVotes = Math.max(...poll.options.map(o => o.votes), 1);

    return (
        <Card className={`border ${poll.isPinned ? "border-warning/40" : poll.isOwn ? "border-primary/30" : "border-divider"}`}>
            <CardBody className="p-3 space-y-2.5">
                {/* Header */}
                <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center shrink-0 mt-0.5">
                        {poll.isPinned ? <Pin className="h-3 w-3 text-warning" /> : <BarChart3 className="h-3 w-3 text-secondary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        {isEditing ? (
                            <div className="flex gap-1.5">
                                <Input size="sm" value={editQuestion} onValueChange={setEditQuestion} maxLength={200} />
                                <Button isIconOnly size="sm" color="primary" variant="flat" onPress={() => { onEdit(poll.id, editQuestion); setIsEditing(false); }}>
                                    <Check className="h-3 w-3" />
                                </Button>
                                <Button isIconOnly size="sm" variant="light" onPress={() => setIsEditing(false)}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ) : (
                            <p className="text-sm font-semibold">{poll.question}</p>
                        )}
                        <div className="flex items-center gap-1.5">
                            <p className="text-[10px] text-foreground/40">
                                by {poll.creatorName} · {poll.totalVotes} vote{poll.totalVotes !== 1 ? "s" : ""}
                            </p>
                            {poll.game && poll.game !== GAME.mode && GAME_LABELS[poll.game] && (
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${GAME_LABELS[poll.game].color}`}>
                                    {GAME_LABELS[poll.game].label}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                        {poll.isOwn && (
                            <Chip size="sm" variant="flat" className="text-[8px] h-4">You</Chip>
                        )}
                        {poll.isOwn && !isEditing && (
                            <Button isIconOnly size="sm" variant="light" className="h-6 w-6 min-w-6" onPress={() => setIsEditing(true)}>
                                <Pencil className="h-2.5 w-2.5" />
                            </Button>
                        )}
                        {(poll.isOwn || isSuperAdmin) && (
                            <Button isIconOnly size="sm" variant="light" color="danger" className="h-6 w-6 min-w-6" onPress={() => onDelete(poll.id)}>
                                <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                        )}
                        {isSuperAdmin && (
                            <Button isIconOnly size="sm" variant="light" color={poll.isPinned ? "warning" : "default"} className="h-6 w-6 min-w-6" onPress={() => onPin(poll.id)}>
                                <Pin className="h-2.5 w-2.5" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Options with vote bars */}
                <div className="space-y-1.5 pl-8">
                    {poll.options.map((opt) => {
                        const pct = poll.totalVotes > 0 ? (opt.votes / poll.totalVotes) * 100 : 0;
                        const isSelected = poll.myVoteOptionId === opt.id;
                        const isWinning = opt.votes === maxVotes && opt.votes > 0;

                        return (
                            <button
                                key={opt.id}
                                onClick={() => onVote(poll.id, opt.id)}
                                className="w-full text-left relative overflow-hidden rounded-lg border border-divider transition-all hover:border-primary/40"
                            >
                                {/* Bar fill */}
                                <div
                                    className={`absolute inset-y-0 left-0 transition-all duration-500 ${isSelected ? "bg-foreground/10" : isWinning ? "bg-success/10" : "bg-foreground/5"}`}
                                    style={{ width: `${pct}%` }}
                                />
                                <div className="relative flex items-center justify-between px-3 py-2">
                                    <div className="flex items-center gap-1.5">
                                        {isSelected && (
                                            <Check className="h-3 w-3 shrink-0 game-text" />
                                        )}
                                        <span className={`text-xs ${isSelected ? "font-semibold game-text" : "font-medium"}`}>
                                            {opt.text}
                                        </span>
                                        {opt.addedBy && (
                                            <span className="text-[9px] text-foreground/30">+{opt.addedBy}</span>
                                        )}
                                    </div>
                                    <span className={`text-[10px] font-semibold ${isWinning ? "text-success" : "text-foreground/40"}`}>
                                        {opt.votes} ({pct.toFixed(0)}%)
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Suggest option */}
                <div className="pl-8">
                    {showSuggest ? (
                        <div className="flex gap-1.5">
                            <Input
                                size="sm"
                                placeholder="Suggest an option..."
                                value={suggestText}
                                onValueChange={setSuggestText}
                                maxLength={100}
                                className="flex-1"
                            />
                            <Button
                                isIconOnly
                                size="sm"
                                color="primary"
                                variant="flat"
                                isDisabled={!suggestText.trim()}
                                onPress={() => {
                                    onSuggest(poll.id, suggestText.trim());
                                    setSuggestText("");
                                    setShowSuggest(false);
                                }}
                            >
                                <Send className="h-3 w-3" />
                            </Button>
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                onPress={() => { setShowSuggest(false); setSuggestText(""); }}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowSuggest(true)}
                            className="flex items-center gap-1 text-[10px] text-foreground/40 hover:text-primary transition-colors"
                        >
                            <PlusCircle className="h-3 w-3" />
                            Suggest option
                        </button>
                    )}
                </div>

                {/* Pending suggestions (creator only) */}
                {poll.pendingSuggestions.length > 0 && (
                    <div className="pl-8 space-y-1">
                        <p className="text-[9px] text-orange-500 uppercase tracking-wider font-semibold">
                            Pending Suggestions
                        </p>
                        {poll.pendingSuggestions.map((s) => (
                            <div key={s.id} className="flex items-center justify-between bg-orange-500/10 rounded-lg px-2.5 py-1.5">
                                <div>
                                    <span className="text-xs font-medium">{s.text}</span>
                                    <span className="text-[9px] text-foreground/40 ml-1">by {s.suggestedBy}</span>
                                </div>
                                <div className="flex gap-1">
                                    <Button isIconOnly size="sm" variant="light" color="success" onPress={() => onApprove(s.id)}>
                                        <Check className="h-3 w-3" />
                                    </Button>
                                    <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => onReject(s.id)}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardBody>
        </Card>
    );
}

// ─── Main Page ────────────────────────────────────────────────
const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

export default function CommunityPage() {
    const queryClient = useQueryClient();
    const { isSuperAdmin } = useAuthUser();
    const composeModal = useDisclosure();
    const pollModal = useDisclosure();
    const [fabOpen, setFabOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
    const [editingMsgText, setEditingMsgText] = useState("");
    const [category, setCategory] = useState("feedback");
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [gameFilter, setGameFilter] = useState<string>(GAME.mode);

    // Fetch community chat group link from public settings
    const { data: publicSettings } = useQuery({
        queryKey: ["public-settings"],
        queryFn: async () => {
            const res = await fetch("/api/settings/public");
            if (!res.ok) return {};
            const json = await res.json();
            return json.data ?? {};
        },
        staleTime: 5 * 60 * 1000,
    });
    const communityChatLink = (publicSettings?.whatsAppGroups || [])[2] || "";
    const [communityWADismissed, setCommunityWADismissed] = useState(() =>
        typeof window !== "undefined" ? !!localStorage.getItem("community_wa_joined") : false
    );
    const [communityConfirmOpen, setCommunityConfirmOpen] = useState(false);
    const [communityConfirmText, setCommunityConfirmText] = useState("");

    // Poll creation form
    const [pollQuestion, setPollQuestion] = useState("");
    const [pollOptions, setPollOptions] = useState(["", ""]);

    // Fetch community feed (filtered by game on server)
    const gameQueryParam = gameFilter === "all" ? undefined : gameFilter;
    const { data, isPending: messagesLoading } = useQuery<{ messages: MessageDTO[]; unreadCount: number }>({
        queryKey: ["community-messages", gameFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (gameQueryParam) params.set("game", gameQueryParam);
            const res = await fetch(`/api/community?${params}`);
            if (!res.ok) throw new Error("Failed");
            const json = await res.json();
            return json.data;
        },
    });

    // Fetch community polls (filtered by game on server)
    const { data: polls = [], isPending: pollsLoading } = useQuery<PollDTO[]>({
        queryKey: ["community-polls", gameFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (gameQueryParam) params.set("game", gameQueryParam);
            const res = await fetch(`/api/community/polls?${params}`);
            if (!res.ok) throw new Error("Failed");
            const json = await res.json();
            return json.data;
        },
    });

    const isLoading = messagesLoading || pollsLoading;

    // Submit message
    const submit = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/community", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message, category, isAnonymous }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed");
            return json;
        },
        onSuccess: (data) => {
            toast.success(data.message);
            setMessage("");
            setCategory("feedback");
            setIsAnonymous(false);
            composeModal.onClose();
            queryClient.invalidateQueries({ queryKey: ["community-messages"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // Create poll
    const createPoll = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/community/polls", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: pollQuestion,
                    options: pollOptions.filter(o => o.trim()),
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed");
            return json;
        },
        onSuccess: (data) => {
            toast.success(data.message);
            setPollQuestion("");
            setPollOptions(["", ""]);
            pollModal.onClose();
            queryClient.invalidateQueries({ queryKey: ["community-polls"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // Vote on poll (optimistic)
    const voteMutation = useMutation({
        mutationFn: async ({ pollId, optionId }: { pollId: string; optionId: string }) => {
            const res = await fetch("/api/community/polls", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "vote", pollId, optionId }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed");
            return json;
        },
        onMutate: async ({ pollId, optionId }) => {
            await queryClient.cancelQueries({ queryKey: ["community-polls"] });
            const previous = queryClient.getQueryData<PollDTO[]>(["community-polls"]);

            queryClient.setQueryData<PollDTO[]>(["community-polls"], (old) =>
                (old ?? []).map((poll) => {
                    if (poll.id !== pollId) return poll;
                    const prevOptionId = poll.myVoteOptionId;
                    const isChangingVote = prevOptionId !== null;
                    return {
                        ...poll,
                        myVoteOptionId: optionId,
                        totalVotes: isChangingVote ? poll.totalVotes : poll.totalVotes + 1,
                        options: poll.options.map((o) => ({
                            ...o,
                            votes: o.id === optionId
                                ? o.votes + 1
                                : o.id === prevOptionId
                                    ? o.votes - 1
                                    : o.votes,
                        })),
                    };
                })
            );
            return { previous };
        },
        onError: (err: Error, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(["community-polls"], context.previous);
            }
            toast.error(err.message);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ["community-polls"] }),
    });

    // Suggest option
    const suggestMutation = useMutation({
        mutationFn: async ({ pollId, text }: { pollId: string; text: string }) => {
            const res = await fetch("/api/community/polls", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "suggest", pollId, text }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed");
            return json;
        },
        onSuccess: (data) => {
            toast.success(data.message);
            queryClient.invalidateQueries({ queryKey: ["community-polls"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // Approve/reject suggestion
    const moderateMutation = useMutation({
        mutationFn: async ({ action, optionId }: { action: "approve" | "reject"; optionId: string }) => {
            const res = await fetch("/api/community/polls", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, optionId }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed");
            return json;
        },
        onSuccess: (data) => {
            toast.success(data.message);
            queryClient.invalidateQueries({ queryKey: ["community-polls"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // Vote on message
    const msgVoteMutation = useMutation({
        mutationFn: async ({ messageId, vote }: { messageId: string; vote: 1 | -1 }) => {
            const res = await fetch("/api/community", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "vote", messageId, vote }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed");
            return json;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["community-messages"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // Generic action for messages (edit, delete, pin)
    const msgActionMutation = useMutation({
        mutationFn: async (body: Record<string, unknown>) => {
            const res = await fetch("/api/community", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || json.message || "Failed");
            return json;
        },
        onSuccess: (data) => {
            if (data.message) toast.success(data.message);
            setEditingMsgId(null);
            queryClient.invalidateQueries({ queryKey: ["community-messages"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // Generic action for polls (edit, delete, pin)
    const pollActionMutation = useMutation({
        mutationFn: async (body: Record<string, unknown>) => {
            const res = await fetch("/api/community/polls", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || json.message || "Failed");
            return json;
        },
        onSuccess: (data) => {
            if (data.message) toast.success(data.message);
            queryClient.invalidateQueries({ queryKey: ["community-polls"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const addPollOption = () => {
        if (pollOptions.length < 10) setPollOptions([...pollOptions, ""]);
    };

    const removePollOption = (i: number) => {
        if (pollOptions.length > 2) setPollOptions(pollOptions.filter((_, idx) => idx !== i));
    };

    const updatePollOption = (i: number, val: string) => {
        setPollOptions(pollOptions.map((o, idx) => idx === i ? val : o));
    };

    return (
        <div className="space-y-5 max-w-2xl mx-auto px-1 pb-24">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 game-text" />
                    Community
                </h1>
                <div className="h-5 mt-1">
                    <RotatingSubtitle />
                </div>
            </motion.div>

            {/* WhatsApp Community Chat banner */}
            {communityChatLink && !communityWADismissed && (
                <div className="space-y-1">
                    <a
                        href={communityChatLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors"
                    >
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                            <WhatsAppIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                Join WhatsApp Community Chat
                            </p>
                            <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/60">
                                Chat with other players, discuss matches & more
                            </p>
                        </div>
                        <span className="shrink-0 px-3 py-1 rounded-lg bg-emerald-500 text-white text-xs font-bold">
                            Join
                        </span>
                    </a>
                    {!communityConfirmOpen ? (
                        <button
                            type="button"
                            onClick={() => setCommunityConfirmOpen(true)}
                            className="w-full text-center text-[10px] text-emerald-600/50 dark:text-emerald-400/50 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors py-0.5"
                        >
                            ✓ I have already joined
                        </button>
                    ) : (
                        <div className="space-y-1 px-1">
                            <p className="text-[10px] text-foreground/40 text-center">Type <span className="font-semibold text-foreground/60">joined</span> below to dismiss permanently</p>
                            <div className="flex items-center gap-1.5">
                            <input
                                type="text"
                                placeholder='joined'
                                value={communityConfirmText}
                                onChange={(e) => setCommunityConfirmText(e.target.value)}
                                className="flex-1 text-[11px] bg-transparent border border-emerald-500/30 rounded-lg px-2 py-1 text-foreground/70 placeholder:text-foreground/30 outline-none focus:border-emerald-500/60"
                                autoFocus
                            />
                            <button
                                type="button"
                                disabled={communityConfirmText.toLowerCase().trim() !== "joined"}
                                onClick={() => {
                                    setCommunityWADismissed(true);
                                    localStorage.setItem("community_wa_joined", "1");
                                }}
                                className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                            >
                                OK
                            </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Cross-game promo — shows other games we run */}
            <CrossGamePromo showAll />

            {/* Game filter tabs */}
            <div className="flex gap-1 flex-wrap">
                    {/* Current game first */}
                    <button
                        onClick={() => setGameFilter(GAME.mode)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                            gameFilter === GAME.mode
                                ? "game-text font-semibold"
                                : "text-foreground/40 hover:text-foreground/60"
                        }`}
                        style={gameFilter === GAME.mode ? { backgroundColor: 'color-mix(in srgb, var(--game-primary) 12%, transparent)' } : {}}
                    >
                        {GAME.name}
                    </button>
                    {/* Other games */}
                    {ALL_GAMES.filter(g => g.mode !== GAME.mode).map((g) => (
                        <button
                            key={g.mode}
                            onClick={() => setGameFilter(g.mode)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                                gameFilter === g.mode
                                    ? `font-semibold ${GAME_LABELS[g.mode]?.color || "bg-foreground/10 text-foreground"}`
                                    : "text-foreground/40 hover:text-foreground/60"
                            }`}
                        >
                            {g.label}
                        </button>
                    ))}
                    <button
                        onClick={() => setGameFilter("all")}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                            gameFilter === "all"
                                ? "bg-foreground/10 text-foreground font-semibold"
                                : "text-foreground/40 hover:text-foreground/60"
                        }`}
                    >
                        All
                    </button>
                </div>
            {/* Loading skeletons */}
            {isLoading && (
                <div className="space-y-2.5">
                    {/* Poll skeletons */}
                    {[1, 2].map((i) => (
                        <Card key={`poll-sk-${i}`} className="border border-divider">
                            <CardBody className="p-3 space-y-2.5">
                                <div className="flex items-start gap-2">
                                    <Skeleton className="w-6 h-6 rounded-full shrink-0" />
                                    <div className="flex-1 space-y-1.5">
                                        <Skeleton className="h-4 w-3/4 rounded" />
                                        <Skeleton className="h-2.5 w-1/3 rounded" />
                                    </div>
                                </div>
                                <div className="space-y-1.5 pl-8">
                                    <Skeleton className="h-9 w-full rounded-lg" />
                                    <Skeleton className="h-9 w-full rounded-lg" />
                                    <Skeleton className="h-9 w-full rounded-lg" />
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                    {/* Message skeletons */}
                    {[1, 2, 3].map((i) => (
                        <Card key={`msg-sk-${i}`} className="border border-divider">
                            <CardBody className="p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="w-6 h-6 rounded-full shrink-0" />
                                    <Skeleton className="h-3 w-20 rounded" />
                                    <Skeleton className="h-5 w-16 rounded-full ml-auto" />
                                </div>
                                <div className="pl-8 space-y-1.5">
                                    <Skeleton className="h-3 w-full rounded" />
                                    <Skeleton className="h-3 w-4/5 rounded" />
                                </div>
                                <div className="flex items-center justify-between pl-8">
                                    <Skeleton className="h-2.5 w-24 rounded" />
                                    <div className="flex items-center gap-1">
                                        <Skeleton className="h-7 w-7 rounded-lg" />
                                        <Skeleton className="h-3 w-5 rounded" />
                                        <Skeleton className="h-7 w-7 rounded-lg" />
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}

            {/* Active polls */}
            {!isLoading && polls.length > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.03 }}
                    className="space-y-2.5"
                >
                    {polls.map((poll) => (
                        <PollCard
                            key={poll.id}
                            poll={poll}
                            isSuperAdmin={isSuperAdmin}
                            onVote={(pId, oId) => voteMutation.mutate({ pollId: pId, optionId: oId })}
                            onSuggest={(pId, text) => suggestMutation.mutate({ pollId: pId, text })}
                            onApprove={(oId) => moderateMutation.mutate({ action: "approve", optionId: oId })}
                            onReject={(oId) => moderateMutation.mutate({ action: "reject", optionId: oId })}
                            onEdit={(pId, q) => pollActionMutation.mutate({ action: "edit", pollId: pId, question: q })}
                            onDelete={(pId) => pollActionMutation.mutate({ action: "delete", pollId: pId })}
                            onPin={(pId) => pollActionMutation.mutate({ action: "pin", pollId: pId })}
                        />
                    ))}
                </motion.div>
            )}

            {/* Community feed */}
            {!isLoading && data?.messages && data.messages.length > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.05 }}
                    className="space-y-2.5"
                >
                    <AnimatePresence>
                        {data.messages.map((msg) => {
                            const cat = CATEGORIES.find(c => c.value === msg.category);
                            const CatIcon = cat?.icon || MessageCircle;
                            const netVotes = msg.upvotes - msg.downvotes;

                            return (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                >
                                    <Card className={`border ${msg.isPinned ? "border-warning/40" : msg.isOwn ? "border-primary/30" : "border-divider"}`}>
                                        <CardBody className="p-3 space-y-2">
                                            {/* Top row */}
                                            <div className="flex items-center gap-2">
                                                {msg.isPinned && (
                                                    <Pin className="h-3 w-3 text-warning shrink-0" />
                                                )}
                                                {msg.isAnonymous || !msg.player ? (
                                                    <div className="w-6 h-6 rounded-full bg-default-200 flex items-center justify-center shrink-0">
                                                        <EyeOff className="h-3 w-3 text-foreground/40" />
                                                    </div>
                                                ) : (
                                                    <Avatar
                                                        src={msg.player.imageUrl}
                                                        name={msg.player.displayName}
                                                        size="sm"
                                                        className="w-6 h-6 shrink-0"
                                                    />
                                                )}
                                                <span className="text-xs font-medium truncate">
                                                    {msg.isAnonymous ? "Anonymous" : (msg.player?.displayName || "Unknown")}
                                                </span>
                                                {msg.game && msg.game !== GAME.mode && GAME_LABELS[msg.game] && (
                                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${GAME_LABELS[msg.game].color}`}>
                                                        {GAME_LABELS[msg.game].label}
                                                    </span>
                                                )}
                                                <Chip size="sm" variant="flat" color={cat?.color || "default"} className="text-[9px] ml-auto shrink-0">
                                                    <CatIcon className="h-2.5 w-2.5 inline mr-0.5" />
                                                    {cat?.label || msg.category}
                                                </Chip>

                                                {/* Action buttons */}
                                                {msg.isOwn && editingMsgId !== msg.id && (
                                                    <Button isIconOnly size="sm" variant="light" className="h-6 w-6 min-w-6" onPress={() => { setEditingMsgId(msg.id); setEditingMsgText(msg.message); }}>
                                                        <Pencil className="h-2.5 w-2.5" />
                                                    </Button>
                                                )}
                                                {(msg.isOwn || isSuperAdmin) && (
                                                    <Button isIconOnly size="sm" variant="light" color="danger" className="h-6 w-6 min-w-6" onPress={() => msgActionMutation.mutate({ action: "delete", messageId: msg.id })}>
                                                        <Trash2 className="h-2.5 w-2.5" />
                                                    </Button>
                                                )}
                                                {isSuperAdmin && (
                                                    <Button isIconOnly size="sm" variant="light" color={msg.isPinned ? "warning" : "default"} className="h-6 w-6 min-w-6" onPress={() => msgActionMutation.mutate({ action: "pin", messageId: msg.id })}>
                                                        <Pin className="h-2.5 w-2.5" />
                                                    </Button>
                                                )}
                                            </div>

                                            {/* Message (editable) */}
                                            {editingMsgId === msg.id ? (
                                                <div className="flex gap-1.5 pl-8">
                                                    <Input size="sm" value={editingMsgText} onValueChange={setEditingMsgText} maxLength={500} />
                                                    <Button isIconOnly size="sm" color="primary" variant="flat" onPress={() => msgActionMutation.mutate({ action: "edit", messageId: msg.id, message: editingMsgText })}>
                                                        <Check className="h-3 w-3" />
                                                    </Button>
                                                    <Button isIconOnly size="sm" variant="light" onPress={() => setEditingMsgId(null)}>
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <p className="text-sm pl-8">{msg.message}</p>
                                            )}

                                            {/* Admin reply */}
                                            {msg.adminReply && (
                                                <div className="rounded-lg px-3 py-2 ml-8" style={{ backgroundColor: 'color-mix(in srgb, var(--game-primary) 10%, transparent)' }}>
                                                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5 game-text">
                                                        Admin Reply
                                                    </p>
                                                    <p className="text-xs">{msg.adminReply}</p>
                                                </div>
                                            )}

                                            {/* Bottom row */}
                                            <div className="flex items-center justify-between pl-8">
                                                <div className="flex items-center gap-1">
                                                    <p className="text-[10px] text-foreground/30">
                                                        {new Date(msg.createdAt).toLocaleDateString(undefined, {
                                                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                                                        })}
                                                    </p>
                                                    {msg.isOwn && (
                                                        <Chip size="sm" variant="flat" className="text-[8px] h-4">You</Chip>
                                                    )}
                                                    {msg.isRead && msg.isOwn && (
                                                        <Chip size="sm" variant="flat" color="success" className="text-[8px] h-4">Read</Chip>
                                                    )}
                                                </div>

                                                {/* Vote buttons */}
                                                <div className="flex items-center gap-0.5">
                                                    <Button
                                                        isIconOnly
                                                        size="sm"
                                                        variant={msg.myVote === 1 ? "solid" : "light"}
                                                        color={msg.myVote === 1 ? "success" : "default"}
                                                        className="h-7 w-7 min-w-7"
                                                        onPress={() => msgVoteMutation.mutate({ messageId: msg.id, vote: 1 })}
                                                    >
                                                        <ThumbsUp className="h-3 w-3" />
                                                    </Button>
                                                    <span className={`text-xs font-semibold min-w-[20px] text-center ${netVotes > 0 ? "text-success" : netVotes < 0 ? "text-danger" : "text-foreground/40"}`}>
                                                        {netVotes > 0 ? `+${netVotes}` : netVotes}
                                                    </span>
                                                    <Button
                                                        isIconOnly
                                                        size="sm"
                                                        variant={msg.myVote === -1 ? "solid" : "light"}
                                                        color={msg.myVote === -1 ? "danger" : "default"}
                                                        className="h-7 w-7 min-w-7"
                                                        onPress={() => msgVoteMutation.mutate({ messageId: msg.id, vote: -1 })}
                                                    >
                                                        <ThumbsDown className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardBody>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </motion.div>
            )}

            {/* Empty state */}
            {!isLoading && (!data?.messages || data.messages.length === 0) && polls.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                    <Star className="h-10 w-10 text-foreground/15 mx-auto mb-3" />
                    <p className="text-sm text-foreground/40">Be the first to share your thoughts!</p>
                </motion.div>
            )}

            {/* FAB with menu */}
            <div className="fixed bottom-20 right-4 z-50">
                <AnimatePresence>
                    {fabOpen && (
                        <>
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-40"
                                onClick={() => setFabOpen(false)}
                            />
                            {/* Menu items */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute bottom-16 right-0 flex flex-col gap-2 items-end z-50"
                            >
                                <Button
                                    size="sm"
                                    color="secondary"
                                    className="rounded-full shadow-lg pl-3 pr-4"
                                    startContent={<BarChart3 className="h-4 w-4" />}
                                    onPress={() => {
                                        setFabOpen(false);
                                        pollModal.onOpen();
                                    }}
                                >
                                    New Poll
                                </Button>
                                <Button
                                    size="sm"
                                    color="primary"
                                    className="rounded-full shadow-lg pl-3 pr-4"
                                    startContent={<Send className="h-4 w-4" />}
                                    onPress={() => {
                                        setFabOpen(false);
                                        composeModal.onOpen();
                                    }}
                                >
                                    New Message
                                </Button>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.2 }}
                >
                    <Button
                        isIconOnly
                        color="primary"
                        size="lg"
                        className="rounded-full shadow-lg shadow-primary/30 h-14 w-14 z-50 relative"
                        onPress={() => setFabOpen(!fabOpen)}
                    >
                        <motion.div animate={{ rotate: fabOpen ? 45 : 0 }} transition={{ duration: 0.2 }}>
                            <Plus className="h-6 w-6" />
                        </motion.div>
                    </Button>
                </motion.div>
            </div>

            {/* Compose Message Modal */}
            <Modal
                isOpen={composeModal.isOpen}
                onClose={composeModal.onClose}
                placement="center"
                scrollBehavior="inside"
                classNames={{
                    base: "max-h-[85dvh]",
                    body: "pb-6",
                }}
            >
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2 pb-2">
                        <Send className="h-4 w-4 game-text" />
                        New Message
                    </ModalHeader>
                    <ModalBody className="space-y-3">
                        {/* Category pills */}
                        <div className="flex flex-wrap gap-1.5">
                            {CATEGORIES.map((cat) => {
                                const CatIcon = cat.icon;
                                return (
                                    <Button
                                        key={cat.value}
                                        size="sm"
                                        variant={category === cat.value ? "solid" : "flat"}
                                        color={category === cat.value ? cat.color : "default"}
                                        className="text-xs"
                                        startContent={<CatIcon className="h-3 w-3" />}
                                        onPress={() => setCategory(cat.value)}
                                    >
                                        {cat.label}
                                    </Button>
                                );
                            })}
                        </div>

                        {/* Message input */}
                        <Textarea
                            placeholder={`What's on your mind about ${GAME.name}?`}
                            value={message}
                            onValueChange={setMessage}
                            maxLength={500}
                            minRows={4}
                            maxRows={8}
                            description={`${message.length}/500`}
                        />

                        {/* Anonymous toggle */}
                        <div className="flex items-center gap-2">
                            <Switch
                                size="sm"
                                isSelected={isAnonymous}
                                onValueChange={setIsAnonymous}
                                thumbIcon={isAnonymous
                                    ? <EyeOff className="h-3 w-3" />
                                    : <User className="h-3 w-3" />
                                }
                            />
                            <span className="text-xs text-foreground/60">
                                {isAnonymous ? "Posting as Anonymous" : "Posting with your name"}
                            </span>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={composeModal.onClose}>
                            Cancel
                        </Button>
                        <Button
                            color="primary"
                            isDisabled={!message.trim()}
                            isLoading={submit.isPending}
                            startContent={<Send className="h-4 w-4" />}
                            onPress={() => submit.mutate()}
                        >
                            Send
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Create Poll Modal */}
            <Modal
                isOpen={pollModal.isOpen}
                onClose={pollModal.onClose}
                placement="center"
                scrollBehavior="inside"
                classNames={{
                    base: "max-h-[85dvh]",
                    body: "pb-6",
                }}
            >
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2 pb-2">
                        <BarChart3 className="h-4 w-4 text-secondary" />
                        New Poll
                    </ModalHeader>
                    <ModalBody className="space-y-3">
                        <Input
                            label="Question"
                            placeholder="What should we decide?"
                            value={pollQuestion}
                            onValueChange={setPollQuestion}
                            maxLength={200}
                        />

                        <div className="space-y-2">
                            <p className="text-xs font-medium text-foreground/60">Options</p>
                            {pollOptions.map((opt, i) => (
                                <div key={i} className="flex gap-1.5">
                                    <Input
                                        size="sm"
                                        placeholder={`Option ${i + 1}`}
                                        value={opt}
                                        onValueChange={(v) => updatePollOption(i, v)}
                                        maxLength={100}
                                    />
                                    {pollOptions.length > 2 && (
                                        <Button
                                            isIconOnly
                                            size="sm"
                                            variant="light"
                                            color="danger"
                                            onPress={() => removePollOption(i)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            {pollOptions.length < 10 && (
                                <Button
                                    size="sm"
                                    variant="flat"
                                    startContent={<Plus className="h-3 w-3" />}
                                    onPress={addPollOption}
                                    className="text-xs"
                                >
                                    Add Option
                                </Button>
                            )}
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={pollModal.onClose}>
                            Cancel
                        </Button>
                        <Button
                            color="secondary"
                            isDisabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
                            isLoading={createPoll.isPending}
                            startContent={<BarChart3 className="h-4 w-4" />}
                            onPress={() => createPoll.mutate()}
                        >
                            Create Poll
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}
