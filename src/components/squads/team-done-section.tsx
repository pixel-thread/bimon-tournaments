"use client";

import { useState, useEffect } from "react";
import { Input, Button, Spinner, Avatar, Modal, ModalContent, ModalHeader, ModalBody } from "@heroui/react";
import { Search, X, Share2, Zap, Ghost, Phone, Mail, UserPlus, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useSearchPlayers, useRecentTeammates } from "@/hooks/use-squads";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/* ─── WhatsApp Icon ─────────────────────────────────────────── */

function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
    );
}

/* ─── Discord Icon ──────────────────────────────────────────── */

function DiscordIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
        </svg>
    );
}

/* ─── Types ─────────────────────────────────────────────────── */

interface TeamDoneSectionProps {
    whatsappGroupLink?: string | null;
    whatsappJoined: boolean;
    onWhatsappJoin: () => void;
    createdSquadId: string | null;
    pollId: string;
    /** If true, this is a ranked/squad tournament — require Discord */
    isRanked?: boolean;
    /** Discord invite link for the server */
    discordInviteLink?: string | null;
}

interface MatchedPlayer {
    id: string;
    displayName: string;
    imageUrl: string | null;
    phone: string | null;
    email: string | null;
}

interface AddedMember {
    id: string;
    displayName: string;
    isGhost: boolean;
}

interface PreviousGhost {
    id: string;
    displayName: string;
    phone: string | null;
}

/* ─── Component ─────────────────────────────────────────────── */

export function TeamDoneSection({
    whatsappGroupLink,
    whatsappJoined,
    onWhatsappJoin,
    createdSquadId,
    pollId,
    isRanked,
    discordInviteLink,
}: TeamDoneSectionProps) {
    const queryClient = useQueryClient();
    const [inviteSearch, setInviteSearch] = useState("");
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
    const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

    // Ghost member state
    const [ghostPhone, setGhostPhone] = useState("");
    const [ghostEmail, setGhostEmail] = useState("");
    const [ghostName, setGhostName] = useState("");
    const [addedMembers, setAddedMembers] = useState<AddedMember[]>([]);
    const [confirmPlayer, setConfirmPlayer] = useState<MatchedPlayer | null>(null);
    const [showAddSection, setShowAddSection] = useState(false);

    const { data: searchResults, isLoading: isSearching } = useSearchPlayers(
        inviteSearch,
        pollId
    );
    const { data: recentTeammates } = useRecentTeammates(pollId, !!createdSquadId);

    // Fetch previous ghosts for quick-add
    const { data: previousGhosts } = useQuery<PreviousGhost[]>({
        queryKey: ["previous-ghosts", createdSquadId],
        queryFn: async () => {
            const res = await fetch(`/api/squads/${createdSquadId}/previous-ghosts`);
            if (!res.ok) return [];
            const json = await res.json();
            return json.data || [];
        },
        enabled: !!createdSquadId,
    });

    // Add member mutation (phone/email lookup)
    const addMemberMutation = useMutation({
        mutationFn: async (data: { phone?: string; email?: string; name: string; isSub?: boolean }) => {
            const res = await fetch(`/api/squads/${createdSquadId}/add-member`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || json.error || "Failed to add");
            return json;
        },
        onSuccess: (json) => {
            if (json.data?.matched) {
                // Real player found — show confirmation
                setConfirmPlayer(json.data.player);
            } else if (json.data?.added) {
                // Ghost or existing ghost added
                setAddedMembers((prev) => [...prev, json.data.player]);
                setGhostPhone("");
                setGhostEmail("");
                setGhostName("");
                toast.success(json.message || "Teammate added");
                queryClient.invalidateQueries({ queryKey: ["previous-ghosts"] });
            }
        },
        onError: (err: Error) => {
            toast.error(err.message);
        },
    });

    // Confirm real player mutation
    const confirmMutation = useMutation({
        mutationFn: async (playerId: string) => {
            const res = await fetch(`/api/squads/${createdSquadId}/add-member/confirm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ playerId }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || json.error || "Failed to add");
            return json;
        },
        onSuccess: (json) => {
            if (json.data?.added) {
                setAddedMembers((prev) => [...prev, json.data.player]);
                toast.success(json.message || "Player added");
            }
            setConfirmPlayer(null);
            setGhostPhone("");
            setGhostEmail("");
            setGhostName("");
        },
        onError: (err: Error) => {
            toast.error(err.message);
        },
    });

    // Quick-add a previous ghost
    const handleQuickAddGhost = (ghost: PreviousGhost) => {
        if (!createdSquadId || addedMembers.some((m) => m.id === ghost.id)) return;
        // Use the ghost's phone to add them (phone is masked in display, but we need the real phone)
        // Since we can't get the real phone from masked data, we add by playerId via confirm endpoint
        confirmMutation.mutate(ghost.id);
    };

    const handleAddMember = () => {
        const phone = ghostPhone.trim();
        const email = ghostEmail.trim();
        const name = ghostName.trim();

        if (!phone && !email) {
            toast.error("Enter phone or email");
            return;
        }
        if (!name) {
            toast.error("Enter player name");
            return;
        }

        addMemberMutation.mutate({
            phone: phone || undefined,
            email: email || undefined,
            name,
        });
    };

    // Fire-and-forget invite with per-player loading state
    const handleQuickInvite = (playerId: string) => {
        if (!createdSquadId || loadingIds.has(playerId) || invitedIds.has(playerId)) return;
        setLoadingIds((prev) => new Set(prev).add(playerId));
        fetch("/api/squads/invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ squadId: createdSquadId, playerId }),
        })
            .then((res) => res.json())
            .then((json) => {
                if (json.message) {
                    toast.success(json.message);
                }
                setInvitedIds((prev) => new Set(prev).add(playerId));
            })
            .catch(() => {
                toast.error("Failed to invite");
            })
            .finally(() => {
                setLoadingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(playerId);
                    return next;
                });
            });
    };

    const isBlocked = false;

    return (
        <div className="space-y-4">
            {/* WhatsApp group link (optional, non-blocking) */}
            {whatsappGroupLink && (
                <div className="space-y-2">
                    <a
                        href={whatsappGroupLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={onWhatsappJoin}
                        className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all ${
                            whatsappJoined
                                ? "bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                        }`}
                    >
                        <WhatsAppIcon className="w-5 h-5" />
                        {whatsappJoined ? "Joined WhatsApp Group ✅" : "Join WhatsApp Group"}
                    </a>
                </div>
            )}

            {!isBlocked ? (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="space-y-4"
                >
                    {/* Share invite on WhatsApp */}
                    {createdSquadId && (
                        <a
                            href={`https://wa.me/?text=${encodeURIComponent(`Join my team for the tournament! 🎮🔥\n${typeof window !== "undefined" ? window.location.origin : ""}/invite/${createdSquadId}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors cursor-pointer"
                        >
                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                <WhatsAppIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                                    Share Invite on WhatsApp
                                </p>
                                <p className="text-[11px] text-emerald-600/60 dark:text-emerald-400/60">
                                    Send invite link to your teammates
                                </p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                        </a>
                    )}

                    {/* Quick Add — players with auto-accept ON for this captain */}
                    {recentTeammates && recentTeammates.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-1.5">
                                <Zap className="w-3 h-3 text-amber-500" />
                                <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">
                                    Subscribers — tap to add
                                </p>
                            </div>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {recentTeammates.map((teammate) => {
                                    const isInvited = invitedIds.has(teammate.id);
                                    const isLoading = loadingIds.has(teammate.id);
                                    return (
                                        <div key={teammate.id} className="flex items-center gap-2 py-1.5">
                                            <Avatar
                                                src={teammate.imageUrl}
                                                name={teammate.displayName}
                                                size="sm"
                                                className="w-7 h-7 shrink-0"
                                            />
                                            <span className="text-sm font-medium truncate flex-1">
                                                {teammate.displayName}
                                            </span>
                                            <Button
                                                size="sm"
                                                color={isInvited ? "success" : "primary"}
                                                variant={isInvited ? "light" : "flat"}
                                                className="min-w-0 px-3 h-7"
                                                isLoading={isLoading}
                                                isDisabled={isInvited}
                                                onPress={() => handleQuickInvite(teammate.id)}
                                            >
                                                {isInvited ? "Added ✓" : "+ Add"}
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="text-[10px] text-foreground/30">These players subscribed to auto-join your invites</p>
                        </div>
                    )}

                    {/* ─── Add Teammates by Phone/Email (Ghost Members) ─── */}
                    {createdSquadId && (
                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={() => setShowAddSection(!showAddSection)}
                                className="flex items-center gap-1.5 w-full cursor-pointer"
                            >
                                <UserPlus className="w-3 h-3 text-purple-500" />
                                <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">
                                    Add by Phone / Email
                                </p>
                                <span className={`text-[10px] text-foreground/30 ml-auto transition-transform ${showAddSection ? "rotate-180" : ""}`}>
                                    ▼
                                </span>
                            </button>

                            {showAddSection && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    className="space-y-3"
                                >
                                    {/* Quick-add previous ghosts */}
                                    {previousGhosts && previousGhosts.length > 0 && (
                                        <div className="space-y-1.5">
                                            <p className="text-[10px] text-foreground/30 uppercase tracking-wider">
                                                Previous teammates
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {previousGhosts.map((ghost) => {
                                                    const isAdded = addedMembers.some((m) => m.id === ghost.id);
                                                    return (
                                                        <Button
                                                            key={ghost.id}
                                                            size="sm"
                                                            variant={isAdded ? "light" : "flat"}
                                                            color={isAdded ? "success" : "default"}
                                                            className="h-7 min-w-0 px-2.5 text-xs gap-1"
                                                            isDisabled={isAdded || confirmMutation.isPending}
                                                            onPress={() => handleQuickAddGhost(ghost)}
                                                        >
                                                            <Ghost className="w-3 h-3" />
                                                            {ghost.displayName}
                                                            {isAdded ? " ✓" : ""}
                                                        </Button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Phone / Email + Name inputs */}
                                    <div className="space-y-2 p-3 rounded-xl bg-default-50 border border-divider">
                                        <div className="flex gap-2">
                                            <Input
                                                size="sm"
                                                placeholder="Phone number"
                                                value={ghostPhone}
                                                onValueChange={setGhostPhone}
                                                startContent={<Phone className="w-3 h-3 text-default-400" />}
                                                className="flex-1"
                                                classNames={{ inputWrapper: "h-8 min-h-8", input: "text-xs" }}
                                                type="tel"
                                            />
                                            <Input
                                                size="sm"
                                                placeholder="Email (optional)"
                                                value={ghostEmail}
                                                onValueChange={setGhostEmail}
                                                startContent={<Mail className="w-3 h-3 text-default-400" />}
                                                className="flex-1"
                                                classNames={{ inputWrapper: "h-8 min-h-8", input: "text-xs" }}
                                                type="email"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <Input
                                                size="sm"
                                                placeholder="IGN / Player name"
                                                value={ghostName}
                                                onValueChange={setGhostName}
                                                className="flex-1"
                                                classNames={{ inputWrapper: "h-8 min-h-8", input: "text-xs" }}
                                                maxLength={20}
                                            />
                                            <Button
                                                size="sm"
                                                color="primary"
                                                variant="flat"
                                                className="h-8 min-w-0 px-3"
                                                isLoading={addMemberMutation.isPending}
                                                isDisabled={(!ghostPhone.trim() && !ghostEmail.trim()) || !ghostName.trim()}
                                                onPress={handleAddMember}
                                            >
                                                Add
                                            </Button>
                                        </div>
                                        <p className="text-[10px] text-foreground/25">
                                            Phone or email required. If they have an account, they&apos;ll be linked automatically.
                                        </p>
                                    </div>

                                    {/* Added members list */}
                                    {addedMembers.length > 0 && (
                                        <div className="space-y-1">
                                            {addedMembers.map((member) => (
                                                <div key={member.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-default-50">
                                                    {member.isGhost ? (
                                                        <div className="w-6 h-6 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0">
                                                            <Ghost className="w-3 h-3 text-purple-500" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-success/15 flex items-center justify-center shrink-0">
                                                            <span className="text-[10px]">✅</span>
                                                        </div>
                                                    )}
                                                    <span className={`text-sm font-medium truncate flex-1 ${member.isGhost ? "text-foreground/60" : ""}`}>
                                                        {member.displayName}
                                                    </span>
                                                    <span className="text-[10px] text-foreground/30">
                                                        {member.isGhost ? "Ghost" : "Linked"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </div>
                    )}

                    {/* Search & Invite players */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">
                            {recentTeammates && recentTeammates.length > 0 ? "Or search players" : "Invite players"}
                        </p>
                        <Input
                            placeholder="Search player..."
                            value={inviteSearch}
                            onValueChange={setInviteSearch}
                            size="sm"
                            startContent={<Search className="w-3.5 h-3.5 text-default-400" />}
                            endContent={inviteSearch ? (
                                <button type="button" onClick={() => setInviteSearch("")} className="p-0.5">
                                    <X className="w-3 h-3 text-default-400" />
                                </button>
                            ) : undefined}
                        />
                        {isSearching && (
                            <div className="flex justify-center py-2">
                                <Spinner size="sm" />
                            </div>
                        )}
                        {searchResults && searchResults.length > 0 && (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {searchResults.map((player) => {
                                    const isInvited = invitedIds.has(player.id);
                                    const isLoading = loadingIds.has(player.id);
                                    return (
                                        <div key={player.id} className="flex items-center gap-2 py-1.5">
                                            <Avatar
                                                src={player.imageUrl}
                                                name={player.displayName}
                                                size="sm"
                                                className="w-7 h-7 shrink-0"
                                            />
                                            <span className="text-sm font-medium truncate flex-1">
                                                {player.displayName}
                                            </span>
                                            <Button
                                                size="sm"
                                                color={isInvited ? "success" : "primary"}
                                                variant={isInvited ? "light" : "flat"}
                                                className="min-w-0 px-3 h-7"
                                                isLoading={isLoading}
                                                isDisabled={isInvited}
                                                onPress={() => handleQuickInvite(player.id)}
                                            >
                                                {isInvited ? "Invited ✓" : "Invite"}
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {searchResults && searchResults.length >= 10 && (
                            <p className="text-[11px] text-foreground/40 text-center py-1.5">Player not found? Type more</p>
                        )}
                        {searchResults && searchResults.length === 0 && inviteSearch.length >= 2 && (
                            <p className="text-xs text-foreground/40 text-center py-2">No players found</p>
                        )}
                    </div>
                </motion.div>
            ) : null}

            {/* Confirmation modal for real player match */}
            <Modal
                isOpen={!!confirmPlayer}
                onClose={() => setConfirmPlayer(null)}
                size="xs"
                placement="center"
            >
                <ModalContent>
                    <ModalHeader className="pb-2">
                        <span className="text-sm">Player Found</span>
                    </ModalHeader>
                    <ModalBody className="pb-5">
                        {confirmPlayer && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-success/10 border border-success/20">
                                    <Avatar
                                        src={confirmPlayer.imageUrl || undefined}
                                        name={confirmPlayer.displayName}
                                        size="sm"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate">
                                            {confirmPlayer.displayName}
                                        </p>
                                        {confirmPlayer.phone && (
                                            <p className="text-[11px] text-foreground/40">
                                                📱 {confirmPlayer.phone.slice(0, 4)}****{confirmPlayer.phone.slice(-2)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <p className="text-xs text-foreground/50 text-center">
                                    This player already has an account. Add them directly?
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="flat"
                                        className="flex-1"
                                        onPress={() => setConfirmPlayer(null)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        color="success"
                                        variant="flat"
                                        className="flex-1"
                                        isLoading={confirmMutation.isPending}
                                        onPress={() => confirmMutation.mutate(confirmPlayer.id)}
                                    >
                                        Add to Squad
                                    </Button>
                                </div>
                            </div>
                        )}
                    </ModalBody>
                </ModalContent>
            </Modal>
        </div>
    );
}
