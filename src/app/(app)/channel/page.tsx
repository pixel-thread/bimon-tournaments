"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Textarea, Modal, ModalContent, ModalBody, ModalHeader } from "@heroui/react";
import {
    Send, Image as ImageIcon, Copy, Check, Trash2, MessageSquare,
    ChevronLeft, KeyRound, X, Loader2, Shield, Crown, Users, Swords
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { useAuthUser } from "@/hooks/use-auth-user";

/* ─── Types ────────────────────────────────────────── */

interface Author {
    id: string;
    displayName: string | null;
    customProfileImageUrl: string | null;
    user: { imageUrl: string | null };
}

interface Announcement {
    id: string;
    type: string;
    channel?: string;
    content: string;
    imageUrl: string | null;
    pinned: boolean;
    parentId: string | null;
    authorId: string;
    author: Author;
    createdAt: string;
    _count?: { replies: number };
}

type ChannelTab = "general" | "tournament";

/* ─── Helpers ──────────────────────────────────────── */

function timeAgo(date: string): string {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
}

function AuthorAvatar({ author, size = 32 }: { author: Author; size?: number }) {
    const src = author.customProfileImageUrl || author.user?.imageUrl;
    const name = author.displayName || "?";
    if (src) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={src}
                alt={name}
                className="rounded-full object-cover shrink-0"
                style={{ width: size, height: size }}
            />
        );
    }
    return (
        <div
            className="rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0"
            style={{ width: size, height: size, fontSize: size * 0.4 }}
        >
            {name[0]?.toUpperCase()}
        </div>
    );
}

/* ─── Room Info Card ───────────────────────────────── */

function RoomInfoCard({ content }: { content: string }) {
    const [copied, setCopied] = useState(false);

    // Parse room info from content
    let roomId = "";
    let password = "";
    let map = "";
    let matchNum = "";
    const lines = content.split("\n");
    for (const line of lines) {
        const roomMatch = line.match(/Room ID:\s*(\S+)/i);
        const passMatch = line.match(/Password:\s*(\S+)/i);
        const mapMatch = line.match(/Map:\s*(\S+)/i);
        const matchMatch = line.match(/Match\s*(\d+)/i);
        if (roomMatch) roomId = roomMatch[1];
        if (passMatch) password = passMatch[1];
        if (mapMatch) map = mapMatch[1];
        if (matchMatch) matchNum = matchMatch[1];
    }

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(roomId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* fallback */
            const ta = document.createElement("textarea");
            ta.value = roomId;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <KeyRound className="w-3.5 h-3.5" />
                {matchNum && <span>Match {matchNum}</span>}
                {map && <span>— {map}</span>}
            </div>
            <div className="flex items-center gap-3">
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 rounded-lg px-3 py-1.5 transition-colors group"
                >
                    <span className="text-sm font-mono font-bold tracking-wider text-primary">
                        {roomId}
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
                    <span className="text-sm font-mono font-bold text-foreground/80">{password}</span>
                </div>
            </div>
        </div>
    );
}

/* ─── Message Bubble ───────────────────────────────── */

function MessageBubble({
    msg,
    isAdmin,
    onOpenThread,
    onDelete,
}: {
    msg: Announcement;
    isAdmin: boolean;
    onOpenThread?: () => void;
    onDelete?: () => void;
}) {
    const authorName = msg.author.displayName || "Unknown";

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="group px-4 py-2 hover:bg-foreground/[0.02] transition-colors"
        >
            <div className="flex gap-3">
                <AuthorAvatar author={msg.author} size={36} />
                <div className="flex-1 min-w-0">
                    {/* Author line */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{authorName}</span>
                        <span className="text-xs text-foreground/30">{timeAgo(msg.createdAt)}</span>
                        {isAdmin && onDelete && (
                            <button
                                onClick={onDelete}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-danger/10 transition-all"
                            >
                                <Trash2 className="w-3 h-3 text-danger/50" />
                            </button>
                        )}
                    </div>

                    {/* Content */}
                    {msg.type === "room-info" ? (
                        <RoomInfoCard content={msg.content} />
                    ) : (
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words mt-0.5">
                            {msg.content}
                        </p>
                    )}

                    {/* Image */}
                    {msg.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={msg.imageUrl}
                            alt="Attachment"
                            className="mt-2 rounded-lg max-w-sm max-h-64 object-cover border border-divider"
                        />
                    )}

                    {/* Thread indicator */}
                    {onOpenThread && (
                        <button
                            onClick={onOpenThread}
                            className="flex items-center gap-1.5 mt-1.5 text-xs text-primary/60 hover:text-primary transition-colors"
                        >
                            <MessageSquare className="w-3 h-3" />
                            {(msg._count?.replies || 0) > 0
                                ? `${msg._count!.replies} ${msg._count!.replies === 1 ? "reply" : "replies"}`
                                : "Reply"}
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

/* ─── Thread Panel ─────────────────────────────────── */

function ThreadPanel({
    parent,
    isOpen,
    onClose,
    canPost,
    isAdmin: isAdminUser,
    channel,
}: {
    parent: Announcement | null;
    isOpen: boolean;
    onClose: () => void;
    canPost: boolean;
    isAdmin: boolean;
    channel: ChannelTab;
}) {
    const queryClient = useQueryClient();
    const [reply, setReply] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    const { data: replies = [], isLoading } = useQuery<Announcement[]>({
        queryKey: ["thread-replies", parent?.id],
        queryFn: async () => {
            const res = await fetch(`/api/announcements/${parent!.id}/replies`);
            if (!res.ok) return [];
            const json = await res.json();
            return json.data || [];
        },
        enabled: isOpen && !!parent,
        refetchInterval: 10_000,
    });

    // Auto-scroll to bottom on new replies
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [replies.length]);

    const postReply = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/announcements", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: reply.trim(),
                    parentId: parent!.id,
                    channel,
                }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.message || "Failed to post");
            }
            return res.json();
        },
        onSuccess: () => {
            setReply("");
            queryClient.invalidateQueries({ queryKey: ["thread-replies", parent?.id] });
            queryClient.invalidateQueries({ queryKey: ["announcements", channel] });
        },
        onError: (err) => toast.error(err.message),
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="full" placement="bottom" scrollBehavior="inside" hideCloseButton>
            <ModalContent className="max-h-[85dvh] rounded-t-2xl">
                <ModalHeader className="flex items-center gap-3 border-b border-divider px-4 py-3">
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-foreground/10">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm font-semibold">Thread</span>
                </ModalHeader>
                <ModalBody className="p-0 flex flex-col">
                    {/* Parent message */}
                    {parent && (
                        <div className="border-b border-divider">
                            <MessageBubble msg={parent} isAdmin={isAdminUser} />
                        </div>
                    )}

                    {/* Replies */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-5 h-5 animate-spin text-foreground/30" />
                            </div>
                        ) : replies.length === 0 ? (
                            <p className="text-center text-xs text-foreground/30 py-8">No replies yet</p>
                        ) : (
                            replies.map((r) => (
                                <MessageBubble key={r.id} msg={r} isAdmin={isAdminUser} />
                            ))
                        )}
                    </div>

                    {/* Reply input */}
                    {canPost && (
                        <div className="border-t border-divider p-3 flex gap-2">
                            <Textarea
                                value={reply}
                                onValueChange={setReply}
                                placeholder="Reply..."
                                minRows={1}
                                maxRows={4}
                                size="sm"
                                className="flex-1"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey && reply.trim()) {
                                        e.preventDefault();
                                        postReply.mutate();
                                    }
                                }}
                            />
                            <Button
                                isIconOnly
                                color="primary"
                                size="sm"
                                isDisabled={!reply.trim()}
                                isLoading={postReply.isPending}
                                onPress={() => postReply.mutate()}
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}

/* ─── Channel Page ─────────────────────────────────── */

export default function ChannelPage() {
    const { user, isAdmin } = useAuthUser();
    const queryClient = useQueryClient();
    const [message, setMessage] = useState("");
    const [threadParent, setThreadParent] = useState<Announcement | null>(null);
    const [activeTab, setActiveTab] = useState<ChannelTab>("general");
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    // Check tournament role + whether active tournament exists
    const { data: roleData } = useQuery<{ role: string; hasActiveTournament: boolean }>({
        queryKey: ["channel-role", user?.player?.id],
        queryFn: async () => {
            const res = await fetch("/api/announcements?check=role");
            if (!res.ok) return { role: "viewer", hasActiveTournament: false };
            const json = await res.json();
            return json.data || { role: "viewer", hasActiveTournament: false };
        },
        enabled: !!user,
        staleTime: 60 * 1000,
    });

    const tournamentRole = roleData?.role || "viewer";
    const hasActiveTournament = roleData?.hasActiveTournament || false;

    // Permissions per tab
    const canPostGeneral = !!user?.player;
    const canPostTournament = isAdmin || tournamentRole === "captain";
    const canPost = activeTab === "general" ? canPostGeneral : canPostTournament;

    // Fetch announcements for current tab
    const { data, isLoading } = useQuery<{ items: Announcement[]; nextCursor: string | null }>({
        queryKey: ["announcements", activeTab],
        queryFn: async () => {
            const res = await fetch(`/api/announcements?channel=${activeTab}`);
            if (!res.ok) return { items: [], nextCursor: null };
            const json = await res.json();
            return json.data || { items: [], nextCursor: null };
        },
        refetchInterval: 15_000,
    });

    const announcements = data?.items || [];

    // Post message
    const postMessage = useMutation({
        mutationFn: async (imageUrl?: string) => {
            const res = await fetch("/api/announcements", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: message.trim(),
                    imageUrl: imageUrl || undefined,
                    channel: activeTab,
                }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.message || "Failed to post");
            }
            return res.json();
        },
        onSuccess: () => {
            setMessage("");
            queryClient.invalidateQueries({ queryKey: ["announcements", activeTab] });
            setTimeout(() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 200);
        },
        onError: (err) => toast.error(err.message),
    });

    // Delete message
    const deleteMessage = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["announcements", activeTab] });
            toast.success("Deleted");
        },
    });

    // Image upload (admin only)
    const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !message.trim()) {
            toast.error("Type a message first, then attach an image");
            return;
        }

        setUploading(true);
        try {
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result as string;
                postMessage.mutate(dataUrl);
                setUploading(false);
            };
            reader.onerror = () => {
                toast.error("Failed to read image");
                setUploading(false);
            };
            reader.readAsDataURL(file);
        } catch {
            toast.error("Failed to upload");
            setUploading(false);
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
    }, [message, postMessage]);

    return (
        <div className="flex flex-col h-[calc(100dvh-128px)] lg:h-[calc(100dvh-64px)] max-w-2xl mx-auto">
            {/* Header + Tabs */}
            <div className="border-b border-divider">
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        <h1 className="text-sm font-bold">Channel</h1>
                    </div>
                    {activeTab === "tournament" && !canPostTournament && (
                        <div className="flex items-center gap-1 text-xs text-foreground/30">
                            <Shield className="w-3 h-3" />
                            View only
                        </div>
                    )}
                    {activeTab === "tournament" && canPostTournament && !isAdmin && (
                        <div className="flex items-center gap-1 text-xs text-warning/60">
                            <Crown className="w-3 h-3" />
                            Captain
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex px-4 gap-1">
                    <button
                        onClick={() => setActiveTab("general")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors ${
                            activeTab === "general"
                                ? "text-primary border-b-2 border-primary bg-primary/5"
                                : "text-foreground/40 hover:text-foreground/60"
                        }`}
                    >
                        <Users className="w-3.5 h-3.5" />
                        General
                    </button>
                    {(hasActiveTournament || isAdmin) && (
                        <button
                            onClick={() => setActiveTab("tournament")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors ${
                                activeTab === "tournament"
                                    ? "text-warning border-b-2 border-warning bg-warning/5"
                                    : "text-foreground/40 hover:text-foreground/60"
                            }`}
                        >
                            <Swords className="w-3.5 h-3.5" />
                            Tournament
                        </button>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-foreground/20" />
                    </div>
                ) : announcements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <MessageSquare className="w-10 h-10 text-foreground/10" />
                        <p className="text-sm text-foreground/30">
                            {activeTab === "tournament" ? "No tournament messages yet" : "No messages yet"}
                        </p>
                        {canPost && (
                            <p className="text-xs text-foreground/20">Send the first message below ↓</p>
                        )}
                    </div>
                ) : (
                    <div className="py-2">
                        <AnimatePresence initial={false}>
                            {announcements.map((msg) => (
                                <MessageBubble
                                    key={msg.id}
                                    msg={msg}
                                    isAdmin={isAdmin}
                                    onOpenThread={() => setThreadParent(msg)}
                                    onDelete={isAdmin ? () => deleteMessage.mutate(msg.id) : undefined}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Input bar */}
            {canPost && (
                <div className="border-t border-divider p-3 flex gap-2 items-end">
                    {/* Image button (admin only) */}
                    {isAdmin && (
                        <>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageUpload}
                            />
                            <Button
                                isIconOnly
                                variant="flat"
                                size="sm"
                                isLoading={uploading}
                                onPress={() => fileInputRef.current?.click()}
                                className="shrink-0"
                            >
                                <ImageIcon className="w-4 h-4" />
                            </Button>
                        </>
                    )}

                    <Textarea
                        value={message}
                        onValueChange={setMessage}
                        placeholder={
                            activeTab === "tournament"
                                ? "Message tournament channel..."
                                : "Send a message..."
                        }
                        minRows={1}
                        maxRows={4}
                        size="sm"
                        className="flex-1"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && message.trim()) {
                                e.preventDefault();
                                postMessage.mutate(undefined);
                            }
                        }}
                    />
                    <Button
                        isIconOnly
                        color="primary"
                        size="sm"
                        isDisabled={!message.trim()}
                        isLoading={postMessage.isPending}
                        onPress={() => postMessage.mutate(undefined)}
                        className="shrink-0"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            )}

            {/* Thread panel */}
            <ThreadPanel
                parent={threadParent}
                isOpen={!!threadParent}
                onClose={() => setThreadParent(null)}
                canPost={canPost}
                isAdmin={isAdmin}
                channel={activeTab}
            />
        </div>
    );
}
