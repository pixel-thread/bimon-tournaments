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
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
    Progress,
    Switch,
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
    Camera,
    MoreVertical,
    ShieldCheck,
    ShieldOff,
    ArrowUpRight,
    Wallet,
    ArrowDownToLine,
    ArrowUpFromLine,
    Eye,
    EyeOff,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { GAME } from "@/lib/game-config";
import { CategoryBadge } from "@/components/ui/category-badge";
import { useAuthUser } from "@/hooks/use-auth-user";

const label = GAME.clanLabel;
const labelLower = label.toLowerCase();

interface ClanMember {
    id: string;
    displayName: string;
    imageUrl: string | null;
    role: "LEADER" | "CO_LEADER" | "MEMBER";
    joinedAt: string;
}

interface ClanData {
    id: string;
    name: string;
    tag: string;
    description: string | null;
    logoUrl: string | null;
    leaderId: string;
    level: number;
    levelProgress: number;
    myRole: "LEADER" | "CO_LEADER" | "MEMBER";
    members: ClanMember[];
}

interface TreasuryData {
    balance: number;
    showTreasuryPublic: boolean;
    isLeaderOrCoLeader: boolean;
    pendingRequests: {
        id: string;
        amount: number;
        message: string | null;
        createdAt: string;
        player: { id: string; displayName: string; imageUrl: string | null };
    }[];
    transactions: {
        id: string;
        amount: number;
        type: string;
        description: string;
        createdAt: string;
        playerName: string;
    }[];
}

interface PendingInvite {
    id: string;
    clanId: string;
    clanName: string;
    clanTag: string;
    clanDescription: string | null;
    clanLogoUrl: string | null;
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
    const { isAdmin } = useAuthUser();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [kickTarget, setKickTarget] = useState<ClanMember | null>(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [changingRole, setChangingRole] = useState<string | null>(null);

    // Treasury state
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [depositAmount, setDepositAmount] = useState("");
    const [withdrawAmount, setWithdrawAmount] = useState("");
    const [withdrawMessage, setWithdrawMessage] = useState("");
    const [treasuryLoading, setTreasuryLoading] = useState(false);

    const handleRoleChange = async (memberId: string, action: "PROMOTE_CO_LEADER" | "DEMOTE" | "TRANSFER_LEADER") => {
        if (action === "TRANSFER_LEADER" && !confirm("Transfer leadership? You will become a regular member. This cannot be undone.")) return;
        setChangingRole(memberId);
        try {
            const res = await fetch("/api/clans/change-role", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targetPlayerId: memberId, action }),
            });
            if (res.ok) {
                toast.success(
                    action === "PROMOTE_CO_LEADER" ? "Promoted to Co-Leader" :
                    action === "DEMOTE" ? "Demoted to Member" :
                    "Leadership transferred"
                );
                invalidate();
            } else {
                const json = await res.json();
                toast.error(json.message || "Failed");
            }
        } catch {
            toast.error("Network error");
        } finally {
            setChangingRole(null);
        }
    };

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
    const isLeaderOrCoLeader = clan?.myRole === "LEADER" || clan?.myRole === "CO_LEADER";

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["my-clan"] });
        queryClient.invalidateQueries({ queryKey: ["clan-invite-count"] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        queryClient.invalidateQueries({ queryKey: ["clan-treasury"] });
    };

    // Fetch treasury data
    const { data: treasury } = useQuery<TreasuryData>({
        queryKey: ["clan-treasury"],
        queryFn: async () => {
            const res = await fetch("/api/clans/treasury");
            if (!res.ok) return null;
            const json = await res.json();
            return json.data;
        },
        enabled: !!clan,
        staleTime: 15_000,
    });

    const handleDeposit = async () => {
        const amount = parseInt(depositAmount);
        if (!amount || amount <= 0) return toast.error("Enter a valid amount");
        setTreasuryLoading(true);
        try {
            const res = await fetch("/api/clans/treasury/deposit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount }),
            });
            const json = await res.json();
            if (res.ok) {
                toast.success(json.message);
                setShowDepositModal(false);
                setDepositAmount("");
                invalidate();
            } else {
                toast.error(json.message);
            }
        } catch { toast.error("Network error"); }
        finally { setTreasuryLoading(false); }
    };

    const handleWithdrawRequest = async () => {
        const amount = parseInt(withdrawAmount);
        if (!amount || amount <= 0) return toast.error("Enter a valid amount");
        setTreasuryLoading(true);
        try {
            const res = await fetch("/api/clans/treasury/withdraw-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount, message: withdrawMessage }),
            });
            const json = await res.json();
            if (res.ok) {
                toast.success(json.message);
                setShowWithdrawModal(false);
                setWithdrawAmount("");
                setWithdrawMessage("");
                invalidate();
            } else {
                toast.error(json.message);
            }
        } catch { toast.error("Network error"); }
        finally { setTreasuryLoading(false); }
    };

    const handleReviewRequest = async (requestId: string, action: "APPROVE" | "REJECT") => {
        try {
            const res = await fetch("/api/clans/treasury/review", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId, action }),
            });
            const json = await res.json();
            if (res.ok) {
                toast.success(json.message);
                invalidate();
            } else {
                toast.error(json.message);
            }
        } catch { toast.error("Network error"); }
    };

    const handleToggleTreasuryPublic = async (value: boolean) => {
        try {
            const res = await fetch("/api/clans/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ showTreasuryPublic: value }),
            });
            if (res.ok) {
                toast.success(value ? "Treasury visible on public page" : "Treasury hidden from public");
                invalidate();
            }
        } catch { toast.error("Network error"); }
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
                <div className="flex-1">
                    <h1 className="text-lg font-bold">My {label}</h1>
                    <p className="text-xs text-foreground/40">
                        {clan ? `[${clan.tag}] ${clan.name}` : `Create or join a ${labelLower}`}
                    </p>
                </div>
                {/* Browse clans link */}
                <button
                    onClick={() => router.push("/clans")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-default-100 text-foreground/60 text-xs font-medium hover:bg-default-200 transition-colors"
                >
                    <Users className="h-3.5 w-3.5" />
                    Browse
                </button>
                {isAdmin && (
                    <button
                        onClick={() => router.push("/dashboard/clan")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                    >
                        <Shield className="h-3.5 w-3.5" />
                        Admin
                    </button>
                )}
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
                                <div className="relative shrink-0">
                                    <Avatar
                                        src={clan.logoUrl || undefined}
                                        name={clan.tag}
                                        className="h-12 w-12"
                                        showFallback
                                        fallback={
                                            <Shield className="w-6 h-6 text-primary" />
                                        }
                                        classNames={{
                                            base: clan.logoUrl ? "" : "bg-primary/20",
                                        }}
                                    />
                                    {isLeader && (
                                        <label
                                            className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary cursor-pointer hover:bg-primary/80 transition-colors"
                                        >
                                            {uploadingLogo
                                                ? <Loader2 className="h-2.5 w-2.5 animate-spin text-white" />
                                                : <Camera className="h-2.5 w-2.5 text-white" />
                                            }
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                disabled={uploadingLogo}
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    setUploadingLogo(true);
                                                    try {
                                                        const formData = new FormData();
                                                        formData.append("image", file);
                                                        const res = await fetch("/api/clans/upload-logo", {
                                                            method: "POST",
                                                            body: formData,
                                                        });
                                                        if (res.ok) {
                                                            toast.success("Logo updated!");
                                                            invalidate();
                                                        } else {
                                                            const json = await res.json();
                                                            toast.error(json.error || "Upload failed");
                                                        }
                                                    } catch {
                                                        toast.error("Upload failed");
                                                    } finally {
                                                        setUploadingLogo(false);
                                                        e.target.value = "";
                                                    }
                                                }}
                                            />
                                        </label>
                                    )}
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

                    {/* ─── Level Bar ─── */}
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-divider bg-default-50">
                        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10">
                            <span className="text-sm font-bold text-primary">{clan.level}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium">Level {clan.level}</span>
                                <span className="text-[10px] text-foreground/40">{clan.levelProgress}%</span>
                            </div>
                            <Progress
                                value={clan.levelProgress}
                                size="sm"
                                color="primary"
                                classNames={{ track: "h-1.5", indicator: "h-1.5" }}
                            />
                        </div>
                    </div>

                    {/* ─── Treasury ─── */}
                    {treasury && (
                        <div className="space-y-2">
                            <div className="p-3 rounded-xl border border-divider bg-default-50">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Wallet className="h-4 w-4 text-primary" />
                                        <span className="text-xs font-semibold">Treasury</span>
                                    </div>
                                    <span className="text-sm font-bold">{treasury.balance.toLocaleString()} {GAME.currency}</span>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="flat"
                                        color="success"
                                        className="flex-1 text-xs"
                                        startContent={<ArrowDownToLine className="h-3 w-3" />}
                                        onPress={() => setShowDepositModal(true)}
                                    >
                                        Deposit
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="flat"
                                        color="warning"
                                        className="flex-1 text-xs"
                                        startContent={<ArrowUpFromLine className="h-3 w-3" />}
                                        onPress={() => setShowWithdrawModal(true)}
                                    >
                                        Request
                                    </Button>
                                </div>

                                {/* Public visibility toggle — Leader only */}
                                {isLeader && (
                                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-divider">
                                        <div className="flex items-center gap-1.5">
                                            {treasury.showTreasuryPublic ? <Eye className="h-3 w-3 text-foreground/40" /> : <EyeOff className="h-3 w-3 text-foreground/40" />}
                                            <span className="text-[10px] text-foreground/40">Show on public page</span>
                                        </div>
                                        <Switch
                                            size="sm"
                                            isSelected={treasury.showTreasuryPublic}
                                            onValueChange={handleToggleTreasuryPublic}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Pending Requests — Leader/Co-Leader */}
                            {isLeaderOrCoLeader && treasury.pendingRequests.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider flex items-center gap-1.5">
                                        <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                                        Pending Requests ({treasury.pendingRequests.length})
                                    </p>
                                    {treasury.pendingRequests.map((req) => (
                                        <div key={req.id} className="p-3 rounded-xl border border-warning/30 bg-warning/5">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <Avatar src={req.player.imageUrl || undefined} name={req.player.displayName} className="h-6 w-6" />
                                                <span className="text-xs font-medium flex-1 truncate">{req.player.displayName}</span>
                                                <span className="text-xs font-bold">{req.amount} {GAME.currency}</span>
                                            </div>
                                            {req.message && (
                                                <p className="text-[10px] text-foreground/40 mb-2 italic">&quot;{req.message}&quot;</p>
                                            )}
                                            <div className="flex gap-2">
                                                <Button size="sm" color="success" variant="flat" className="flex-1 text-xs h-7" onPress={() => handleReviewRequest(req.id, "APPROVE")}>
                                                    <Check className="h-3 w-3" /> Approve
                                                </Button>
                                                <Button size="sm" color="danger" variant="flat" className="flex-1 text-xs h-7" onPress={() => handleReviewRequest(req.id, "REJECT")}>
                                                    <X className="h-3 w-3" /> Reject
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Transaction History */}
                            {treasury.transactions.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider mb-1.5">Recent Activity</p>
                                    <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                                        {treasury.transactions.map((tx) => (
                                            <div key={tx.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg">
                                                <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${tx.type === "CREDIT" ? "bg-success/10" : "bg-danger/10"}`}>
                                                    {tx.type === "CREDIT"
                                                        ? <ArrowDownToLine className="h-2.5 w-2.5 text-success" />
                                                        : <ArrowUpFromLine className="h-2.5 w-2.5 text-danger" />
                                                    }
                                                </div>
                                                <span className="text-[10px] text-foreground/60 flex-1 min-w-0 truncate">{tx.description}</span>
                                                <span className="text-[10px] text-foreground/30 shrink-0">
                                                    {new Date(tx.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

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
                                            {member.role === "CO_LEADER" && (
                                                <ShieldCheck className="h-3 w-3 text-primary shrink-0" />
                                            )}
                                        </div>
                                        <p className="text-[10px] text-foreground/30">
                                            {member.role === "LEADER" ? "Leader" : member.role === "CO_LEADER" ? "Co-Leader" : "Member"}
                                            {" · "}
                                            Joined {new Date(member.joinedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    {isLeader && member.id !== clan.leaderId && (
                                        <Dropdown placement="bottom-end">
                                            <DropdownTrigger>
                                                <button
                                                    className="p-1.5 rounded-full hover:bg-default-200 text-foreground/40 hover:text-foreground/70 transition-colors"
                                                    disabled={changingRole === member.id}
                                                >
                                                    {changingRole === member.id
                                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        : <MoreVertical className="h-3.5 w-3.5" />
                                                    }
                                                </button>
                                            </DropdownTrigger>
                                            <DropdownMenu aria-label="Member actions">
                                                {member.role === "MEMBER" ? (
                                                    <DropdownItem
                                                        key="promote"
                                                        startContent={<ShieldCheck className="h-3.5 w-3.5" />}
                                                        onPress={() => handleRoleChange(member.id, "PROMOTE_CO_LEADER")}
                                                    >
                                                        Promote to Co-Leader
                                                    </DropdownItem>
                                                ) : (
                                                    <DropdownItem
                                                        key="demote"
                                                        startContent={<ShieldOff className="h-3.5 w-3.5" />}
                                                        onPress={() => handleRoleChange(member.id, "DEMOTE")}
                                                    >
                                                        Demote to Member
                                                    </DropdownItem>
                                                )}
                                                <DropdownItem
                                                    key="transfer"
                                                    startContent={<ArrowUpRight className="h-3.5 w-3.5" />}
                                                    onPress={() => handleRoleChange(member.id, "TRANSFER_LEADER")}
                                                    className="text-warning"
                                                >
                                                    Appoint as Leader
                                                </DropdownItem>
                                                <DropdownItem
                                                    key="kick"
                                                    color="danger"
                                                    startContent={<X className="h-3.5 w-3.5" />}
                                                    onPress={() => setKickTarget(member)}
                                                >
                                                    Kick
                                                </DropdownItem>
                                            </DropdownMenu>
                                        </Dropdown>
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

            {/* Deposit Modal */}
            <Modal isOpen={showDepositModal} onClose={() => setShowDepositModal(false)} size="sm">
                <ModalContent>
                    <ModalHeader className="text-sm">Deposit to Treasury</ModalHeader>
                    <ModalBody>
                        <Input
                            type="number"
                            label={`Amount (${GAME.currency})`}
                            placeholder="Enter amount"
                            value={depositAmount}
                            onValueChange={setDepositAmount}
                            variant="bordered"
                            size="sm"
                        />
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" size="sm" onPress={() => setShowDepositModal(false)}>Cancel</Button>
                        <Button color="success" size="sm" isLoading={treasuryLoading} onPress={handleDeposit}>Deposit</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Withdraw Request Modal */}
            <Modal isOpen={showWithdrawModal} onClose={() => setShowWithdrawModal(false)} size="sm">
                <ModalContent>
                    <ModalHeader className="text-sm">Request Withdrawal</ModalHeader>
                    <ModalBody>
                        <Input
                            type="number"
                            label={`Amount (${GAME.currency})`}
                            placeholder="Enter amount"
                            value={withdrawAmount}
                            onValueChange={setWithdrawAmount}
                            variant="bordered"
                            size="sm"
                        />
                        <Input
                            label="Reason (optional)"
                            placeholder="Why do you need the funds?"
                            value={withdrawMessage}
                            onValueChange={setWithdrawMessage}
                            variant="bordered"
                            size="sm"
                        />
                        <p className="text-[10px] text-foreground/40">
                            Your request will be reviewed by the Leader or Co-Leader.
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" size="sm" onPress={() => setShowWithdrawModal(false)}>Cancel</Button>
                        <Button color="warning" size="sm" isLoading={treasuryLoading} onPress={handleWithdrawRequest}>Submit Request</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

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
                        src={invite.clanLogoUrl || invite.leaderImageUrl || undefined}
                        name={invite.clanTag}
                        className="h-10 w-10 shrink-0"
                        showFallback
                        fallback={<Shield className="w-5 h-5 text-primary" />}
                        classNames={{
                            base: (invite.clanLogoUrl || invite.leaderImageUrl) ? "" : "bg-primary/20",
                        }}
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
                        placeholder="e.g. TSM (2-4 chars)"
                        value={tag}
                        onValueChange={(v) => setTag(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
                        maxLength={4}
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
    const queryClient = useQueryClient();

    const { data: results, isLoading: searching } = useQuery<SearchResult[]>({
        queryKey: ["clan-search-players", search],
        queryFn: async () => {
            const res = await fetch(`/api/clans/search-players?q=${encodeURIComponent(search)}`);
            if (!res.ok) return [];
            const json = await res.json();
            return json.data ?? [];
        },
        enabled: isOpen,
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
                queryClient.invalidateQueries({ queryKey: ["clan-search-players"] });
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
                        placeholder="Search player..."
                        value={search}
                        onValueChange={setSearch}
                        startContent={<Search className="h-4 w-4 text-foreground/40" />}
                        variant="bordered"
                        size="sm"
                        autoFocus
                    />

                    {searching && (
                        <div className="flex justify-center py-4">
                            <Spinner size="sm" />
                        </div>
                    )}

                    {results && results.length === 0 && !searching && (
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
