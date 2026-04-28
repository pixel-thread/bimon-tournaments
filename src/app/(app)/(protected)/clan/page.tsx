"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Card,
    CardBody,
    Avatar,
    Button,
    Input,
    Chip,
    Spinner,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "@heroui/react";
import {
    Shield,
    Crown,
    UserPlus,
    Search,
    X,
    LogOut,
    Trash2,
    ArrowLeft,
    Users,
    Check,
    Ban,
    Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { GAME } from "@/lib/game-config";
import { CategoryBadge } from "@/components/ui/category-badge";

const label = GAME.clanLabel;
const labelLower = label.toLowerCase();

interface ClanMember {
    id: string;
    displayName: string;
    imageUrl: string | null;
    role: "LEADER" | "MEMBER";
    joinedAt: string;
}

interface ClanData {
    id: string;
    name: string;
    tag: string;
    description: string | null;
    leaderId: string;
    myRole: "LEADER" | "MEMBER";
    members: ClanMember[];
}

interface PendingInvite {
    id: string;
    clanId: string;
    clanName: string;
    clanTag: string;
    clanDescription: string | null;
    leaderName: string;
    leaderImageUrl: string | null;
    memberCount: number;
    createdAt: string;
}

interface SearchResult {
    id: string;
    displayName: string;
    username: string;
    imageUrl: string | null;
    category: string;
}

export default function ClanPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [kickTarget, setKickTarget] = useState<ClanMember | null>(null);

    // Fetch clan data + pending invites
    const { data, isLoading } = useQuery<{
        clan: ClanData | null;
        pendingInvites: PendingInvite[];
    }>({
        queryKey: ["my-clan"],
        queryFn: async () => {
            const res = await fetch("/api/clans");
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            return json.data;
        },
        staleTime: 30_000,
    });

    const clan = data?.clan ?? null;
    const pendingInvites = data?.pendingInvites ?? [];
    const isLeader = clan?.myRole === "LEADER";

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["my-clan"] });
        queryClient.invalidateQueries({ queryKey: ["clan-invite-count"] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
    };

    // ─── Loading State ──────────────────────────────────────
    if (isLoading) {
        return (
            <div className="mx-auto max-w-lg px-4 py-6">
                <div className="flex items-center justify-center py-20">
                    <Spinner size="lg" />
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={() => router.push("/profile")}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-default-100 hover:bg-default-200 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                    <h1 className="text-lg font-bold">My {label}</h1>
                    <p className="text-xs text-foreground/40">
                        {clan ? `[${clan.tag}] ${clan.name}` : `Create or join a ${labelLower}`}
                    </p>
                </div>
            </div>

            {/* ═══ NO CLAN STATE ═══ */}
            {!clan && (
                <div className="space-y-4">
                    {/* Pending invites */}
                    {pendingInvites.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-danger animate-pulse" />
                                Pending Invites
                            </p>
                            {pendingInvites.map((invite) => (
                                <InviteCard key={invite.id} invite={invite} onRespond={invalidate} />
                            ))}
                        </div>
                    )}

                    {/* Empty state + Create CTA */}
                    <Card className="border border-divider">
                        <CardBody className="flex flex-col items-center gap-4 py-12">
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <Shield className="w-8 h-8 text-primary" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-semibold">No {label} Yet</p>
                                <p className="text-xs text-foreground/40 mt-1">
                                    Create your own {labelLower} or wait for an invite from a leader.
                                </p>
                            </div>
                            <Button
                                color="primary"
                                className="font-medium"
                                onPress={() => setShowCreateModal(true)}
                                startContent={<Shield className="h-4 w-4" />}
                            >
                                Create {label}
                            </Button>
                        </CardBody>
                    </Card>
                </div>
            )}

            {/* ═══ HAS CLAN STATE ═══ */}
            {clan && (
                <div className="space-y-4">
                    {/* Clan header card */}
                    <Card className="border border-divider overflow-hidden">
                        <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                    <Shield className="w-6 h-6 text-primary" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <Chip size="sm" variant="flat" color="primary" className="text-[10px] h-4 px-1.5">
                                            {clan.tag}
                                        </Chip>
                                        <h2 className="text-base font-bold truncate">{clan.name}</h2>
                                    </div>
                                    {clan.description && (
                                        <p className="text-xs text-foreground/50 mt-0.5 line-clamp-2">
                                            {clan.description}
                                        </p>
                                    )}
                                    <p className="text-[10px] text-foreground/30 mt-1">
                                        {clan.members.length} {clan.members.length === 1 ? "member" : "members"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Leader actions */}
                    {isLeader && (
                        <Button
                            color="primary"
                            variant="flat"
                            fullWidth
                            className="font-medium"
                            startContent={<UserPlus className="h-4 w-4" />}
                            onPress={() => setShowInviteModal(true)}
                        >
                            Invite Player
                        </Button>
                    )}

                    {/* Member list */}
                    <div>
                        <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider mb-2">
                            Members
                        </p>
                        <div className="space-y-1">
                            {clan.members.map((member) => (
                                <div
                                    key={member.id}
                                    className="flex items-center gap-3 p-3 rounded-xl border border-divider bg-default-50"
                                >
                                    <Avatar
                                        src={member.imageUrl || undefined}
                                        name={member.displayName}
                                        className="h-10 w-10 shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-medium truncate">
                                                {member.displayName}
                                            </span>
                                            {member.role === "LEADER" && (
                                                <Crown className="h-3 w-3 text-yellow-500 shrink-0" />
                                            )}
                                        </div>
                                        <p className="text-[10px] text-foreground/30">
                                            Joined {new Date(member.joinedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    {isLeader && member.id !== clan.leaderId && (
                                        <button
                                            onClick={() => setKickTarget(member)}
                                            className="p-1.5 rounded-full hover:bg-danger/10 text-foreground/30 hover:text-danger transition-colors"
                                            title="Kick member"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Leave / Disband */}
                    <Button
                        color="danger"
                        variant="flat"
                        fullWidth
                        className="font-medium"
                        startContent={isLeader ? <Trash2 className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                        onPress={() => setShowLeaveConfirm(true)}
                    >
                        {isLeader ? `Disband ${label}` : `Leave ${label}`}
                    </Button>
                </div>
            )}

            {/* ═══ MODALS ═══ */}

            {/* Create Clan Modal */}
            <CreateClanModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreated={invalidate}
            />

            {/* Invite Player Modal */}
            {clan && (
                <InvitePlayerModal
                    isOpen={showInviteModal}
                    onClose={() => setShowInviteModal(false)}
                    clanId={clan.id}
                    onInvited={() => {
                        toast.success("Invite sent!");
                    }}
                />
            )}

            {/* Leave Confirm Modal */}
            <LeaveConfirmModal
                isOpen={showLeaveConfirm}
                onClose={() => setShowLeaveConfirm(false)}
                isLeader={isLeader}
                clanName={clan?.name ?? ""}
                onConfirmed={invalidate}
            />

            {/* Kick Confirm Modal */}
            <KickConfirmModal
                isOpen={!!kickTarget}
                onClose={() => setKickTarget(null)}
                member={kickTarget}
                onKicked={invalidate}
            />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
//  Sub-components
// ═══════════════════════════════════════════════════════════

function InviteCard({ invite, onRespond }: { invite: PendingInvite; onRespond: () => void }) {
    const [responding, setResponding] = useState<"ACCEPT" | "DECLINE" | null>(null);

    const respond = async (action: "ACCEPT" | "DECLINE") => {
        setResponding(action);
        try {
            const res = await fetch("/api/clans/respond-invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inviteId: invite.id, action }),
            });
            if (res.ok) {
                toast.success(action === "ACCEPT" ? `Joined ${invite.clanName}!` : "Invite declined");
                onRespond();
            } else {
                const json = await res.json();
                toast.error(json.message || "Failed");
            }
        } catch {
            toast.error("Network error");
        } finally {
            setResponding(null);
        }
    };

    return (
        <Card className="border border-divider">
            <CardBody className="p-3">
                <div className="flex items-center gap-3">
                    <Avatar
                        src={invite.leaderImageUrl || undefined}
                        name={invite.leaderName}
                        className="h-10 w-10 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <Chip size="sm" variant="flat" color="primary" className="text-[10px] h-4 px-1.5">
                                {invite.clanTag}
                            </Chip>
                            <span className="text-sm font-semibold truncate">{invite.clanName}</span>
                        </div>
                        <p className="text-[10px] text-foreground/40 mt-0.5">
                            Invited by {invite.leaderName} · {invite.memberCount} members
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 mt-3">
                    <Button
                        size="sm"
                        color="primary"
                        className="flex-1 font-medium"
                        isLoading={responding === "ACCEPT"}
                        isDisabled={!!responding}
                        onPress={() => respond("ACCEPT")}
                        startContent={!responding && <Check className="h-3.5 w-3.5" />}
                    >
                        Accept
                    </Button>
                    <Button
                        size="sm"
                        variant="flat"
                        className="flex-1 font-medium"
                        isLoading={responding === "DECLINE"}
                        isDisabled={!!responding}
                        onPress={() => respond("DECLINE")}
                        startContent={!responding && <X className="h-3.5 w-3.5" />}
                    >
                        Decline
                    </Button>
                </div>
            </CardBody>
        </Card>
    );
}

function CreateClanModal({
    isOpen,
    onClose,
    onCreated,
}: {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
}) {
    const [name, setName] = useState("");
    const [tag, setTag] = useState("");
    const [description, setDescription] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");

    const handleCreate = async () => {
        setError("");
        if (!name.trim() || !tag.trim()) {
            setError(`${label} name and tag are required`);
            return;
        }
        setCreating(true);
        try {
            const res = await fetch("/api/clans", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    tag: tag.trim(),
                    description: description.trim() || undefined,
                }),
            });
            if (res.ok) {
                toast.success(`${label} created!`);
                onCreated();
                onClose();
                setName("");
                setTag("");
                setDescription("");
            } else {
                const json = await res.json();
                setError(json.message || "Failed to create");
            }
        } catch {
            setError("Network error");
        } finally {
            setCreating(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="sm"
            placement="center"
            classNames={{
                base: "bg-background border border-divider",
                backdrop: "bg-black/60 backdrop-blur-sm",
            }}
        >
            <ModalContent>
                <ModalHeader className="pb-2">Create {label}</ModalHeader>
                <ModalBody className="space-y-3 pb-2">
                    <Input
                        label={`${label} Name`}
                        placeholder={`e.g. Thunder Squad`}
                        value={name}
                        onValueChange={setName}
                        maxLength={30}
                        variant="bordered"
                        size="sm"
                    />
                    <Input
                        label="Tag"
                        placeholder="e.g. THNDR (2-6 chars)"
                        value={tag}
                        onValueChange={(v) => setTag(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                        maxLength={6}
                        variant="bordered"
                        size="sm"
                        description="Letters and numbers only. Shown as [TAG] next to your name."
                    />
                    <Input
                        label="Description (optional)"
                        placeholder="A short description..."
                        value={description}
                        onValueChange={setDescription}
                        maxLength={200}
                        variant="bordered"
                        size="sm"
                    />
                    {error && (
                        <p className="text-xs text-danger">{error}</p>
                    )}
                </ModalBody>
                <ModalFooter className="pt-2">
                    <Button variant="flat" onPress={onClose} size="sm">
                        Cancel
                    </Button>
                    <Button
                        color="primary"
                        onPress={handleCreate}
                        isLoading={creating}
                        size="sm"
                        className="font-medium"
                    >
                        Create
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

function InvitePlayerModal({
    isOpen,
    onClose,
    clanId,
    onInvited,
}: {
    isOpen: boolean;
    onClose: () => void;
    clanId: string;
    onInvited: () => void;
}) {
    const [search, setSearch] = useState("");
    const [inviting, setInviting] = useState<string | null>(null);

    const { data: results, isLoading: searching } = useQuery<SearchResult[]>({
        queryKey: ["clan-search-players", search],
        queryFn: async () => {
            const res = await fetch(`/api/clans/search-players?q=${encodeURIComponent(search)}`);
            if (!res.ok) return [];
            const json = await res.json();
            return json.data ?? [];
        },
        enabled: isOpen && search.length >= 2,
        staleTime: 15_000,
    });

    const handleInvite = async (playerId: string) => {
        setInviting(playerId);
        try {
            const res = await fetch("/api/clans/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targetPlayerId: playerId }),
            });
            if (res.ok) {
                onInvited();
                // Remove from results by re-searching
                setSearch((s) => s); // trigger re-fetch
            } else {
                const json = await res.json();
                toast.error(json.message || "Failed to invite");
            }
        } catch {
            toast.error("Network error");
        } finally {
            setInviting(null);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => {
                onClose();
                setSearch("");
            }}
            size="sm"
            placement="center"
            scrollBehavior="inside"
            classNames={{
                base: "bg-background border border-divider",
                backdrop: "bg-black/60 backdrop-blur-sm",
            }}
        >
            <ModalContent>
                <ModalHeader className="pb-2">Invite Player</ModalHeader>
                <ModalBody className="pb-4">
                    <Input
                        placeholder="Search by name or username..."
                        value={search}
                        onValueChange={setSearch}
                        startContent={<Search className="h-4 w-4 text-foreground/40" />}
                        variant="bordered"
                        size="sm"
                        autoFocus
                    />

                    {search.length < 2 && (
                        <p className="text-xs text-foreground/40 text-center py-4">
                            Type at least 2 characters to search
                        </p>
                    )}

                    {searching && (
                        <div className="flex justify-center py-4">
                            <Spinner size="sm" />
                        </div>
                    )}

                    {results && results.length === 0 && search.length >= 2 && !searching && (
                        <p className="text-xs text-foreground/40 text-center py-4">
                            No players found
                        </p>
                    )}

                    {results && results.length > 0 && (
                        <div className="space-y-1 mt-2">
                            {results.map((p) => (
                                <div
                                    key={p.id}
                                    className="flex items-center gap-3 p-2.5 rounded-lg border border-divider"
                                >
                                    <Avatar
                                        src={p.imageUrl || undefined}
                                        name={p.displayName}
                                        className="h-9 w-9 shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-medium truncate block">
                                            {p.displayName}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-foreground/40">@{p.username}</span>
                                            <CategoryBadge category={p.category} size="sm" />
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        color="primary"
                                        variant="flat"
                                        isLoading={inviting === p.id}
                                        isDisabled={!!inviting}
                                        onPress={() => handleInvite(p.id)}
                                        className="shrink-0"
                                    >
                                        Invite
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}

function LeaveConfirmModal({
    isOpen,
    onClose,
    isLeader,
    clanName,
    onConfirmed,
}: {
    isOpen: boolean;
    onClose: () => void;
    isLeader: boolean;
    clanName: string;
    onConfirmed: () => void;
}) {
    const [loading, setLoading] = useState(false);

    const handleLeave = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/clans/leave", { method: "POST" });
            if (res.ok) {
                const json = await res.json();
                toast.success(
                    json.data?.action === "DISBANDED"
                        ? `${clanName} has been disbanded`
                        : `You left ${clanName}`
                );
                onConfirmed();
                onClose();
            } else {
                const json = await res.json();
                toast.error(json.message || "Failed");
            }
        } catch {
            toast.error("Network error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="sm"
            placement="center"
            classNames={{
                base: "bg-background border border-divider",
                backdrop: "bg-black/60 backdrop-blur-sm",
            }}
        >
            <ModalContent>
                <ModalHeader className="pb-2">
                    {isLeader ? `Disband ${label}?` : `Leave ${label}?`}
                </ModalHeader>
                <ModalBody className="pb-2">
                    <p className="text-sm text-foreground/60">
                        {isLeader
                            ? `This will permanently delete "${clanName}" and remove all members. This cannot be undone.`
                            : `Are you sure you want to leave "${clanName}"?`}
                    </p>
                </ModalBody>
                <ModalFooter className="pt-2">
                    <Button variant="flat" onPress={onClose} size="sm">
                        Cancel
                    </Button>
                    <Button
                        color="danger"
                        onPress={handleLeave}
                        isLoading={loading}
                        size="sm"
                        className="font-medium"
                    >
                        {isLeader ? "Disband" : "Leave"}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

function KickConfirmModal({
    isOpen,
    onClose,
    member,
    onKicked,
}: {
    isOpen: boolean;
    onClose: () => void;
    member: ClanMember | null;
    onKicked: () => void;
}) {
    const [loading, setLoading] = useState(false);

    const handleKick = async () => {
        if (!member) return;
        setLoading(true);
        try {
            const res = await fetch("/api/clans/kick", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targetPlayerId: member.id }),
            });
            if (res.ok) {
                toast.success(`${member.displayName} has been kicked`);
                onKicked();
                onClose();
            } else {
                const json = await res.json();
                toast.error(json.message || "Failed");
            }
        } catch {
            toast.error("Network error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="sm"
            placement="center"
            classNames={{
                base: "bg-background border border-divider",
                backdrop: "bg-black/60 backdrop-blur-sm",
            }}
        >
            <ModalContent>
                <ModalHeader className="pb-2">Kick Member?</ModalHeader>
                <ModalBody className="pb-2">
                    <p className="text-sm text-foreground/60">
                        Are you sure you want to kick <strong>{member?.displayName}</strong> from the {labelLower}?
                    </p>
                </ModalBody>
                <ModalFooter className="pt-2">
                    <Button variant="flat" onPress={onClose} size="sm">
                        Cancel
                    </Button>
                    <Button
                        color="danger"
                        onPress={handleKick}
                        isLoading={loading}
                        size="sm"
                        className="font-medium"
                    >
                        Kick
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
