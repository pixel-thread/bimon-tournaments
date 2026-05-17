"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Card,
    CardBody,
    Button,
    Chip,
    Input,
    Skeleton,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Select,
    SelectItem,
    Textarea,
    useDisclosure,
    Divider,

} from "@heroui/react";
import {
    Trophy,
    Users,
    Gamepad2,
    Vote,
    Medal,
    Plus,
    Calendar,
    Pencil,
    Save,
    X,
    Trash2,
    ImageIcon,
    Upload,
    Heart,
    UserCircle,
    Swords,
    Dice5,
    AlertTriangle,
    CheckCircle2,
    Loader2,
    Clock,
    Camera,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { DeclareWinnersModal } from "@/components/dashboard/declare-winners-modal";

import { useAuthUser } from "@/hooks/use-auth-user";
import { GAME } from "@/lib/game-config";

// ─── Types ───────────────────────────────────────────────────
interface TournamentDTO {
    id: string;
    name: string;
    description: string | null;
    fee: number | null;
    status: string;
    type: string;
    isWinnerDeclared: boolean;
    isChampionship: boolean;
    maxPlacements: number;
    season: { id: string; name: string } | null;
    startDate: string;
    teamCount: number;
    matchCount: number;
    winnerCount: number;
    poll: { id: string; isActive: boolean; voteCount: number; allowSquads?: boolean; isChampionship?: boolean } | null;
}

interface SeasonDTO {
    id: string;
    name: string;
    isCurrent: boolean;
}

/**
 * /dashboard/operations — Admin operations center.
 * Select a tournament, configure, declare winners, manage seasons.
 */
export default function OperationsPage() {
    const queryClient = useQueryClient();
    const createModal = useDisclosure();
    const seasonModal = useDisclosure();
    const winnersModal = useDisclosure();
    const donationModal = useDisclosure();
    const editModal = useDisclosure();
    const { isSuperAdmin } = useAuthUser();

    const [selectedId, setSelectedId] = useState("");
    const [seasonId, setSeasonId] = useState("");

    // Edit form
    const [editName, setEditName] = useState("");
    const [editDesc, setEditDesc] = useState("");
    const [editFee, setEditFee] = useState("");
    const [editMaxPlacements, setEditMaxPlacements] = useState(3);

    // Create tournament form
    const [tName, setTName] = useState("");
    const [tDescription, setTDescription] = useState("");
    const [tFee, setTFee] = useState("");
    const [tType, setTType] = useState<"BR" | "BRACKET_1V1" | "LEAGUE" | "GROUP_KNOCKOUT">("BR");
    const [tSeasonId, setTSeasonId] = useState("");
    const [showDesc, setShowDesc] = useState(false);
    const [tMaxPlacements, setTMaxPlacements] = useState(3);

    // Auto-fill create form when modal opens
    const openCreateModal = () => {
        // Auto-generate next tournament name from the latest tournament
        const last = tournaments[0];
        if (last) {
            const match = last.name.match(/^(.*?\s*)(\d+)$/);
            if (match) {
                // Has trailing number — increment it
                setTName(`${match[1]}${parseInt(match[2]) + 1}`);
            } else {
                // No number — append " 2"
                setTName(`${last.name} 2`);
            }
        } else {
            setTName("Tournament 1");
        }
        setTFee(String(settings?.defaultEntryFee ?? 30));
        setTType(GAME.defaultTournamentType as typeof tType);
        // Auto-select current season
        const current = seasons.find((s) => s.isCurrent);
        setTSeasonId(current?.id ?? seasons[0]?.id ?? "");
        setTDescription("");
        setShowDesc(false);
        createModal.onOpen();
    };

    // Create season form
    const [sName, setSName] = useState("");

    // Fetch settings for defaults
    const { data: settings } = useQuery<{ defaultEntryFee: number }>({
        queryKey: ["app-settings"],
        queryFn: async () => {
            const res = await fetch("/api/settings");
            if (!res.ok) return { defaultEntryFee: 30 };
            const json = await res.json();
            return json.data ?? { defaultEntryFee: 30 };
        },
    });

    const { data: seasons = [] } = useQuery<SeasonDTO[]>({
        queryKey: ["seasons"],
        queryFn: async () => {
            const res = await fetch(`/api/seasons?_t=${Date.now()}`);
            if (!res.ok) return [];
            const json = await res.json();
            return json.data || [];
        },
    });

    // Auto-select current season
    useEffect(() => {
        if (seasons.length > 0 && !seasonId) {
            const current = seasons.find((s) => s.isCurrent);
            setSeasonId(current?.id ?? seasons[0].id);
        }
    }, [seasons, seasonId]);

    const { data: tournaments = [], isLoading } = useQuery<TournamentDTO[]>({
        queryKey: ["admin-tournaments", seasonId],
        queryFn: async () => {
            const url = seasonId
                ? `/api/tournaments?seasonId=${seasonId}`
                : "/api/tournaments";
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed");
            const json = await res.json();
            return json.data ?? [];
        },
    });

    const selected = tournaments.find((t) => t.id === selectedId);

    // Auto-select first active tournament
    useEffect(() => {
        if (tournaments.length > 0) {
            const active = tournaments.find((t) => t.status === "ACTIVE");
            setSelectedId(active?.id || tournaments[0].id);
        } else {
            setSelectedId("");
        }
    }, [tournaments]);

    // Sync edit form when selection changes
    useEffect(() => {
        if (selected) {
            setEditName(selected.name);
            setEditDesc(selected.description || "");
            setEditFee(selected.fee?.toString() || "0");
            setEditMaxPlacements(selected.maxPlacements ?? 3);
        }
    }, [selected?.id]);

    // ─── Mutations ───────────────────────────────────────────
    const updateTournament = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/tournaments/${selectedId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editName.trim(),
                    description: editDesc.trim() || null,
                    fee: editFee ? Number(editFee) : 0,
                    maxPlacements: editMaxPlacements,
                }),
            });
            if (!res.ok) throw new Error("Failed to update");
        },
        onSuccess: async () => {
            toast.success("Tournament updated!");
            queryClient.removeQueries({ queryKey: ["admin-tournaments", seasonId] });
            await queryClient.invalidateQueries({ queryKey: ["admin-tournaments"] });
        },
        onError: () => toast.error("Failed to update"),
    });

    const createTournament = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/tournaments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: tName.trim(),
                    description: tDescription.trim() || null,
                    fee: tFee ? Number(tFee) : 0,
                    seasonId: tSeasonId || undefined,
                    type: tType,
                    maxPlacements: tMaxPlacements,
                }),
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || "Failed");
            }
            return res.json();
        },
        onSuccess: async (data) => {
            toast.success("Tournament created!");
            queryClient.removeQueries({ queryKey: ["admin-tournaments", seasonId] });
            await queryClient.invalidateQueries({ queryKey: ["admin-tournaments"] });
            createModal.onClose();
            setTName(""); setTDescription(""); setTFee(String(settings?.defaultEntryFee ?? 30));
            if (data?.data?.id) setSelectedId(data.data.id);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const createSeason = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/seasons", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: sName.trim() }),
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error || "Failed");
            }
            return json;
        },
        onSuccess: async (result: any) => {
            toast.success("Season created!");
            // Immediately set the new season as selected so next tournament creation uses it
            const newId = result?.data?.id;
            if (newId) {
                setSeasonId(newId);
            }
            queryClient.removeQueries({ queryKey: ["seasons"] });
            await queryClient.invalidateQueries({ queryKey: ["seasons"] });
            seasonModal.onClose();
            setSName("");
        },
        onError: (err: Error) => toast.error(err.message),
    });



    return (
        <div className="mx-auto max-w-xl space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">Operations</h1>
                    <p className="text-sm text-foreground/50">
                        Tournaments, seasons & configuration
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant="flat"
                        startContent={<Calendar className="h-3.5 w-3.5" />}
                        onPress={seasonModal.onOpen}
                    >
                        Season
                    </Button>
                    <Button
                        size="sm"
                        color="primary"
                        startContent={<Plus className="h-3.5 w-3.5" />}
                        onPress={openCreateModal}
                    >
                        New
                    </Button>
                </div>
            </div>

            {/* Season Selector */}
            {seasons.length > 0 && (
                <Select
                    label="Season"
                    placeholder="Select season..."
                    selectedKeys={seasonId ? [seasonId] : []}
                    onSelectionChange={(keys) => {
                        const id = Array.from(keys)[0] as string;
                        if (id) { setSeasonId(id); setSelectedId(""); }
                    }}
                    startContent={<Calendar className="h-4 w-4 text-foreground/30" />}
                    size="sm"
                >
                    {seasons.map((s) => (
                        <SelectItem key={s.id} textValue={s.name}>
                            <div className="flex items-center gap-2">
                                <span>{s.name}</span>
                                {s.isCurrent && <Chip size="sm" color="success" variant="flat">Current</Chip>}
                            </div>
                        </SelectItem>
                    ))}
                </Select>
            )}

            {/* Tournament Selector */}
            {isLoading ? (
                <Skeleton className="h-14 w-full rounded-xl" />
            ) : (
                <Select
                    label="Tournament"
                    placeholder="Select tournament..."
                    selectedKeys={selectedId ? [selectedId] : []}
                    onSelectionChange={(keys) => {
                        const id = Array.from(keys)[0] as string;
                        if (id) { setSelectedId(id); }
                    }}
                    startContent={<Gamepad2 className="h-4 w-4 text-foreground/30" />}
                >
                    {tournaments.map((t) => (
                        <SelectItem key={t.id} textValue={t.name}>
                            <div className="flex items-center gap-2">
                                <span>{t.name}</span>
                                <Chip size="sm" variant="dot" color={
                                    t.status === "ACTIVE" ? "success" :
                                        t.status === "INACTIVE" ? "warning" : "danger"
                                }>
                                    {t.status}
                                </Chip>
                            </div>
                        </SelectItem>
                    ))}
                </Select>
            )}

            {/* Selected Tournament Details — super admin only */}
            {selected && (
                <motion.div
                    key={selected.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className="border border-divider">
                        <CardBody className="space-y-4 p-4">
                            {/* Stats */}
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { icon: Users, label: "Teams", value: selected.teamCount },
                                    { icon: Gamepad2, label: "Matches", value: selected.matchCount },
                                    { icon: Vote, label: "Votes", value: selected.poll?.voteCount ?? 0 },
                                    { icon: Trophy, label: "Winners", value: selected.winnerCount },
                                ].map((s) => (
                                    <div key={s.label} className="flex flex-col items-center gap-1 rounded-lg bg-default-50 p-2.5">
                                        <s.icon className="h-3.5 w-3.5 text-foreground/30" />
                                        <span className="text-sm font-bold">{s.value}</span>
                                        <span className="text-[10px] text-foreground/40">{s.label}</span>
                                    </div>
                                ))}
                            </div>

                            <Divider />

                            {/* Config — always show static view */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-foreground/40">Entry Fee</p>
                                        <p className="text-sm font-semibold">
                                            {selected.fee ?? 0} {GAME.currency}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-foreground/40">Status</p>
                                        <div className="flex items-center gap-1.5">
                                            <Chip
                                                size="sm"
                                                variant="flat"
                                                color={
                                                    selected.status === "ACTIVE" ? "success" :
                                                        selected.status === "INACTIVE" ? "warning" : "danger"
                                                }
                                            >
                                                {selected.status}
                                            </Chip>
                                            {selected.isWinnerDeclared && (
                                                <Medal className="h-3.5 w-3.5 text-warning" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {selected.description && (
                                    <p className="text-xs text-foreground/50">{selected.description}</p>
                                )}
                            </div>

                            <Divider />

                            {/* Actions */}
                            <div className="flex flex-wrap gap-2 justify-end">
                                <Button
                                    size="sm"
                                    variant="flat"
                                    startContent={<Pencil className="h-3 w-3" />}
                                    onPress={() => {
                                        setEditName(selected.name);
                                        setEditDesc(selected.description || "");
                                        setEditFee(selected.fee?.toString() || "0");
                                        setEditMaxPlacements(selected.maxPlacements ?? 3);
                                        editModal.onOpen();
                                    }}
                                >
                                    Edit
                                </Button>
                                <Button
                                    isIconOnly
                                    size="sm"
                                    color="secondary"
                                    variant="flat"
                                    onPress={donationModal.onOpen}
                                >
                                    <Heart className="h-3.5 w-3.5" />
                                </Button>
                                {isSuperAdmin && (
                                    <Button
                                        size="sm"
                                        color="warning"
                                        variant="flat"
                                        startContent={<Trophy className="h-3 w-3" />}
                                        onPress={winnersModal.onOpen}
                                    >
                                        {selected.isWinnerDeclared ? "View Results" : "View Winners"}
                                    </Button>
                                )}
                            </div>
                        </CardBody>
                    </Card>
                </motion.div>
            )}

            {/* Match Management — for 1v1 tournament types (Knockout, League, Group+KO) */}
            {selected && selected.type !== "BR" && (
                <BracketManagement
                    tournamentId={selected.id}
                    tournamentName={selected.name}
                    tournamentType={selected.type}
                    hasVotes={(selected.poll?.voteCount ?? 0) >= 2}
                />
            )}

            {/* Donation Modal */}
            {selected && (
                <DonationModal
                    tournamentId={selected.id}
                    isOpen={donationModal.isOpen}
                    onClose={donationModal.onClose}
                />
            )}

            {/* Create Tournament Modal */}
            <Modal isOpen={createModal.isOpen} onClose={createModal.onClose} placement="center">
                <ModalContent>
                    <ModalHeader>Create Tournament</ModalHeader>
                    <ModalBody className="gap-3">
                        <Input
                            label="Name"
                            placeholder="e.g. Lehkai sngewtynnad 11"
                            value={tName}
                            onValueChange={setTName}
                            isRequired
                        />
                        <Input
                            label={`Entry Fee (${GAME.currency})`}
                            placeholder="0"
                            value={tFee}
                            onValueChange={setTFee}
                            type="number"
                        />
                        {/* Podium placements — only for bracket types */}
                        {["BRACKET_1V1", "LEAGUE", "GROUP_KNOCKOUT"].includes(tType) && (
                            <div className="space-y-1.5">
                                <p className="text-xs text-foreground/50 font-medium">Podium</p>
                                <div className="flex gap-2">
                                    {[
                                        { val: 1, label: "🏆 Winner" },
                                        { val: 2, label: "🥈 Top 2" },
                                        { val: 3, label: "🥉 Top 3" },
                                    ].map((opt) => (
                                        <Button
                                            key={opt.val}
                                            size="sm"
                                            variant={tMaxPlacements === opt.val ? "solid" : "flat"}
                                            color={tMaxPlacements === opt.val ? "primary" : "default"}
                                            onPress={() => setTMaxPlacements(opt.val)}
                                            className="flex-1"
                                        >
                                            {opt.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {showDesc ? (
                            <Textarea
                                label="Description"
                                placeholder="Optional description"
                                value={tDescription}
                                onValueChange={setTDescription}
                                minRows={2}
                                endContent={
                                    <button onClick={() => setShowDesc(false)} className="text-foreground/40 hover:text-foreground">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                }
                            />
                        ) : (
                            <Button
                                size="sm"
                                variant="light"
                                className="self-start text-foreground/40"
                                onPress={() => setShowDesc(true)}
                            >
                                + Add description
                            </Button>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={createModal.onClose}>Cancel</Button>
                        <Button
                            color="primary"
                            isLoading={createTournament.isPending}
                            isDisabled={!tName.trim()}
                            onPress={() => createTournament.mutate()}
                        >
                            Create
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Create Season Modal */}
            <Modal isOpen={seasonModal.isOpen} onClose={seasonModal.onClose} placement="center">
                <ModalContent>
                    <ModalHeader>Create Season</ModalHeader>
                    <ModalBody>
                        <Input
                            label="Season Name"
                            placeholder="e.g. Season 5"
                            value={sName}
                            onValueChange={setSName}
                            isRequired
                        />
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={seasonModal.onClose}>Cancel</Button>
                        <Button
                            color="primary"
                            isLoading={createSeason.isPending}
                            isDisabled={!sName.trim()}
                            onPress={() => createSeason.mutate()}
                        >
                            Create
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Edit Tournament Modal */}
            {selected && (
                <Modal isOpen={editModal.isOpen} onClose={editModal.onClose} size="md" placement="center">
                    <ModalContent>
                        <ModalHeader className="flex items-center gap-2 text-base">
                            <Pencil className="h-4 w-4" />
                            Edit Tournament
                        </ModalHeader>
                        <ModalBody className="space-y-3">
                            <Input
                                label="Name"
                                value={editName}
                                onValueChange={setEditName}
                                size="sm"
                            />
                            <Textarea
                                label="Description"
                                value={editDesc}
                                onValueChange={setEditDesc}
                                size="sm"
                                minRows={2}
                            />
                            <Input
                                label={`Entry Fee (${GAME.currency})`}
                                value={editFee}
                                onValueChange={setEditFee}
                                type="number"
                                size="sm"
                            />
                            {/* Podium placements — only for bracket types */}
                            {["BRACKET_1V1", "LEAGUE", "GROUP_KNOCKOUT"].includes(selected.type) && (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-foreground/50 font-medium">Podium</p>
                                    <div className="flex gap-2">
                                        {[
                                            { val: 1, label: "🏆 Winner", desc: "1st only" },
                                            { val: 2, label: "🥈 Top 2", desc: "1st & 2nd" },
                                            { val: 3, label: "🥉 Top 3", desc: "1st, 2nd & 3rd" },
                                        ].map((opt) => (
                                            <Button
                                                key={opt.val}
                                                size="sm"
                                                variant={editMaxPlacements === opt.val ? "solid" : "flat"}
                                                color={editMaxPlacements === opt.val ? "primary" : "default"}
                                                onPress={() => setEditMaxPlacements(opt.val)}
                                                className="flex-1"
                                            >
                                                {opt.label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </ModalBody>
                        <ModalFooter>
                            <Button size="sm" variant="flat" onPress={editModal.onClose}>
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                color="primary"
                                isLoading={updateTournament.isPending}
                                startContent={<Save className="h-3 w-3" />}
                                onPress={() => {
                                    updateTournament.mutate(undefined, {
                                        onSuccess: () => editModal.onClose(),
                                    });
                                }}
                            >
                                Save
                            </Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>
            )}

            {/* Declare Winners Modal */}
            {selected && (
                <DeclareWinnersModal
                    isOpen={winnersModal.isOpen}
                    onClose={winnersModal.onClose}
                    tournamentId={selected.id}
                    tournamentName={selected.name}
                    isWinnerDeclared={selected.isWinnerDeclared}
                    seasonId={seasonId}
                    tournamentType={selected.type}
                    maxPlacements={selected.maxPlacements}
                    isChampionship={selected.isChampionship}
                />
            )}
        </div>
    );
}

// ─── Prize Pool Donation Modal ──────────────────────────────

interface DonationDTO {
    id: string;
    amount: number;
    playerName: string | null;
    isAnonymous: boolean;
    createdAt: string;
}

function DonationModal({ tournamentId, isOpen, onClose }: { tournamentId: string; isOpen: boolean; onClose: () => void }) {
    const queryClient = useQueryClient();
    const [amount, setAmount] = useState("");
    const [isAnonymous, setIsAnonymous] = useState(true);
    const [playerSearch, setPlayerSearch] = useState("");
    const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; name: string } | null>(null);

    const { data: donationData } = useQuery<{ donations: DonationDTO[]; total: number }>({
        queryKey: ["donations", tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/tournaments/${tournamentId}/donations`);
            if (!res.ok) throw new Error("Failed");
            const json = await res.json();
            return json.data;
        },
        enabled: isOpen,
    });

    const { data: players } = useQuery<{ id: string; displayName: string; user: { username: string } }[]>({
        queryKey: ["player-search", playerSearch],
        queryFn: async () => {
            const res = await fetch(`/api/players?search=${encodeURIComponent(playerSearch)}&limit=5`);
            if (!res.ok) return [];
            const json = await res.json();
            return json.data ?? [];
        },
        enabled: playerSearch.length >= 2 && !isAnonymous && isOpen,
    });

    const addDonation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/tournaments/${tournamentId}/donations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: Number(amount),
                    playerId: isAnonymous ? null : selectedPlayer?.id,
                    isAnonymous,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed");
            return json;
        },
        onSuccess: (data) => {
            toast.success(data.message);
            setAmount("");
            setSelectedPlayer(null);
            setPlayerSearch("");
            queryClient.invalidateQueries({ queryKey: ["donations", tournamentId] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const deleteDonation = useMutation({
        mutationFn: async (donationId: string) => {
            const res = await fetch(`/api/tournaments/${tournamentId}/donations`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ donationId }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed");
            return json;
        },
        onSuccess: (data) => {
            toast.success(data.message);
            queryClient.invalidateQueries({ queryKey: ["donations", tournamentId] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const canAdd = Number(amount) > 0 && (isAnonymous || selectedPlayer);

    return (
        <Modal isOpen={isOpen} onClose={onClose} placement="center" scrollBehavior="inside">
            <ModalContent>
                <ModalHeader className="flex items-center gap-2 pb-2">
                    <Heart className="h-4 w-4 text-pink-500" />
                    Prize Pool Donations
                    {(donationData?.total ?? 0) > 0 && (
                        <Chip size="sm" color="success" variant="flat" className="text-[10px]">
                            +{donationData?.total} {GAME.currency}
                        </Chip>
                    )}
                </ModalHeader>
                <ModalBody className="space-y-3 pb-4">
                    {/* Add donation form */}
                    <Input
                        size="sm"
                        type="number"
                        label={`Amount (${GAME.currency})`}
                        placeholder="e.g. 10"
                        value={amount}
                        onValueChange={setAmount}
                        endContent={<span className="text-foreground/40 text-xs">{GAME.currency}</span>}
                    />

                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant={isAnonymous ? "solid" : "flat"}
                            color={isAnonymous ? "secondary" : "default"}
                            className="flex-1 text-xs"
                            onPress={() => { setIsAnonymous(true); setSelectedPlayer(null); setPlayerSearch(""); }}
                            startContent={<UserCircle className="h-3 w-3" />}
                        >
                            Anonymous
                        </Button>
                        <Button
                            size="sm"
                            variant={!isAnonymous ? "solid" : "flat"}
                            color={!isAnonymous ? "primary" : "default"}
                            className="flex-1 text-xs"
                            onPress={() => setIsAnonymous(false)}
                            startContent={<Users className="h-3 w-3" />}
                        >
                            From Player
                        </Button>
                    </div>

                    {!isAnonymous && (
                        <div className="space-y-1">
                            {selectedPlayer ? (
                                <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
                                    <span className="text-xs font-medium">{selectedPlayer.name}</span>
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        onPress={() => { setSelectedPlayer(null); setPlayerSearch(""); }}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <Input
                                        size="sm"
                                        placeholder="Search player..."
                                        value={playerSearch}
                                        onValueChange={setPlayerSearch}
                                    />
                                    {players && players.length > 0 && (
                                        <div className="rounded-lg border border-divider bg-content1 max-h-32 overflow-y-auto">
                                            {players.map((p) => (
                                                <button
                                                    key={p.id}
                                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-default-100 transition-colors"
                                                    onClick={() => {
                                                        setSelectedPlayer({
                                                            id: p.id,
                                                            name: p.displayName || p.user.username,
                                                        });
                                                        setPlayerSearch("");
                                                    }}
                                                >
                                                    {p.displayName || p.user.username}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    <Button
                        size="sm"
                        color="success"
                        variant="flat"
                        fullWidth
                        isDisabled={!canAdd}
                        isLoading={addDonation.isPending}
                        startContent={<Plus className="h-3 w-3" />}
                        onPress={() => addDonation.mutate()}
                    >
                        Add Donation
                    </Button>

                    {/* Existing donations list */}
                    {donationData?.donations && donationData.donations.length > 0 && (
                        <div className="space-y-1 pt-2 border-t border-divider">
                            <p className="text-[10px] text-foreground/40 uppercase tracking-wider">
                                Donations ({donationData.donations.length})
                            </p>
                            {donationData.donations.map((d) => (
                                <div key={d.id} className="flex items-center justify-between rounded-lg bg-default-50 px-3 py-1.5">
                                    <div>
                                        <span className="text-xs font-semibold text-success">+{d.amount} {GAME.currency}</span>
                                        <span className="text-[10px] text-foreground/40 ml-1.5">
                                            {d.isAnonymous ? "Anonymous" : d.playerName}
                                        </span>
                                    </div>
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        color="danger"
                                        isLoading={deleteDonation.isPending}
                                        onPress={() => deleteDonation.mutate(d.id)}
                                    >
                                        <Trash2 className="h-3 w-3" />
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

// ─── Admin Match Row (editable scores) ──────────────────────

function AdminMatchRow({
    match,
    bg,
    onResolve,
    onRandomPick,
    isLoading,
}: {
    match: BracketMatch;
    bg: string;
    onResolve: (winnerId: string, score1: number, score2: number) => void;
    onRandomPick: () => void;
    isLoading: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);

    const p1Name = match.player1?.displayName ?? "TBD";
    const p2Name = match.player2?.displayName ?? "TBD";
    const statusLabel = match.status === "SUBMITTED" && match.score1 !== null
        ? `${match.score1} - ${match.score2}`
        : match.status;

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className={`w-full p-3 rounded-xl border ${bg} text-left hover:opacity-80 
                    transition-all cursor-pointer flex items-center justify-between`}
            >
                <div>
                    <p className="text-sm font-medium">{p1Name} vs {p2Name}</p>
                    <p className="text-xs text-foreground/40">Round {match.round} • Pos {match.position + 1}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Chip size="sm" variant="flat" color={
                        match.status === "DISPUTED" ? "danger"
                            : match.status === "SUBMITTED" ? "warning"
                                : "default"
                    }>
                        {statusLabel}
                    </Chip>
                    <Pencil className="h-3 w-3 text-foreground/30" />
                </div>
            </button>

            <AdminResolveModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                match={match}
                onResolve={(winnerId, s1, s2) => {
                    onResolve(winnerId, s1, s2);
                    setIsOpen(false);
                }}
                onRandomPick={() => {
                    onRandomPick();
                    setIsOpen(false);
                }}
                isLoading={isLoading}
            />
        </>
    );
}

function AdminResolveModal({
    isOpen,
    onClose,
    match,
    onResolve,
    onRandomPick,
    isLoading,
}: {
    isOpen: boolean;
    onClose: () => void;
    match: BracketMatch;
    onResolve: (winnerId: string, score1: number, score2: number) => void;
    onRandomPick: () => void;
    isLoading: boolean;
}) {
    const [s1, setS1] = useState(String(match.score1 ?? 0));
    const [s2, setS2] = useState(String(match.score2 ?? 0));
    const [screenshot, setScreenshot] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const p1Name = match.player1?.displayName ?? "TBD";
    const p2Name = match.player2?.displayName ?? "TBD";
    const score1Num = parseInt(s1) || 0;
    const score2Num = parseInt(s2) || 0;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !file.type.startsWith("image/")) return;
        if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
        setScreenshot(file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    const handleResolve = async (winnerId: string) => {
        let screenshotUrl: string | undefined;

        // Upload screenshot if selected
        if (screenshot) {
            setUploading(true);
            try {
                const formData = new FormData();
                formData.append("file", screenshot);
                formData.append("folder", `bracket-results/${match.id}`);
                const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
                const uploadData = await uploadRes.json();
                if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed");
                screenshotUrl = uploadData.url;
            } catch (err: any) {
                toast.error(err.message);
                setUploading(false);
                return;
            }
            setUploading(false);
        }

        onResolve(winnerId, score1Num, score2Num);
    };

    // Grab screenshot URL from bracket results if available
    const existingScreenshot = (match as any).screenshotUrl || (match as any).results?.find((r: any) => r.screenshotUrl)?.screenshotUrl;

    return (
        <Modal isOpen={isOpen} onClose={onClose} placement="center" size="md">
            <ModalContent>
                <ModalHeader className="flex items-center gap-2 pb-1">
                    <Swords className="h-4 w-4 text-primary" />
                    Resolve Match
                </ModalHeader>
                <ModalBody className="gap-4">
                    {/* Round info */}
                    <p className="text-xs text-foreground/40">
                        Round {match.round} • Position {match.position + 1}
                        {match.status === "DISPUTED" && (
                            <span className="text-danger ml-2 font-semibold">⚠️ DISPUTED</span>
                        )}
                        {match.status === "SUBMITTED" && (
                            <span className="text-warning ml-2 font-semibold">⏳ Awaiting confirmation</span>
                        )}
                    </p>

                    {/* Score inputs */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 text-center space-y-1.5">
                            <p className="text-xs font-medium text-foreground/60 truncate">{p1Name}</p>
                            <Input
                                type="number"
                                min="0"
                                value={s1}
                                onValueChange={setS1}
                                size="lg"
                                classNames={{ input: "text-center text-3xl font-bold" }}
                            />
                        </div>
                        <span className="text-foreground/20 font-bold text-2xl mt-5">—</span>
                        <div className="flex-1 text-center space-y-1.5">
                            <p className="text-xs font-medium text-foreground/60 truncate">{p2Name}</p>
                            <Input
                                type="number"
                                min="0"
                                value={s2}
                                onValueChange={setS2}
                                size="lg"
                                classNames={{ input: "text-center text-3xl font-bold" }}
                            />
                        </div>
                    </div>

                    {/* Existing screenshot preview */}
                    {existingScreenshot && (
                        <div className="space-y-1">
                            <p className="text-xs text-foreground/40 flex items-center gap-1"><Camera className="h-3 w-3" /> Submitted screenshot</p>
                            <div className="rounded-xl overflow-hidden border border-divider">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={existingScreenshot} alt="Submitted proof" className="w-full max-h-40 object-contain bg-black/30" />
                            </div>
                        </div>
                    )}

                    {/* Screenshot upload (optional for admin) */}
                    <div className="space-y-1">
                        <p className="text-xs text-foreground/40 flex items-center gap-1">
                            <Camera className="h-3 w-3" /> Upload screenshot (optional)
                        </p>
                        {previewUrl ? (
                            <div className="relative rounded-xl overflow-hidden border border-divider">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={previewUrl} alt="Screenshot" className="w-full max-h-32 object-contain bg-black/30" />
                                <button onClick={() => { setScreenshot(null); setPreviewUrl(null); }}
                                    className="absolute top-1.5 right-1.5 p-0.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors">
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ) : (
                            <button onClick={() => fileInputRef.current?.click()}
                                className="w-full flex items-center gap-2 rounded-lg border border-dashed border-foreground/15 hover:border-primary/40 p-3 transition-colors text-xs text-foreground/40 hover:text-foreground/60">
                                <ImageIcon className="h-4 w-4" /> Tap to upload
                            </button>
                        )}
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                    </div>

                    {/* Winner selection */}
                    <div className="space-y-2">
                        <p className="text-xs font-medium text-foreground/50">Pick Winner</p>
                        <div className="grid grid-cols-2 gap-2">
                            {match.player1Id && (
                                <Button
                                    color={score1Num > score2Num ? "success" : "default"}
                                    variant={score1Num > score2Num ? "solid" : "flat"}
                                    className="h-12"
                                    onPress={() => handleResolve(match.player1Id!)}
                                    isLoading={isLoading || uploading}
                                >
                                    <div className="text-center">
                                        <p className="text-sm font-bold truncate">{p1Name}</p>
                                        <p className="text-[10px] opacity-70">wins</p>
                                    </div>
                                </Button>
                            )}
                            {match.player2Id && (
                                <Button
                                    color={score2Num > score1Num ? "success" : "default"}
                                    variant={score2Num > score1Num ? "solid" : "flat"}
                                    className="h-12"
                                    onPress={() => handleResolve(match.player2Id!)}
                                    isLoading={isLoading || uploading}
                                >
                                    <div className="text-center">
                                        <p className="text-sm font-bold truncate">{p2Name}</p>
                                        <p className="text-[10px] opacity-70">wins</p>
                                    </div>
                                </Button>
                            )}
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter className="justify-between">
                    <Button
                        size="sm"
                        variant="flat"
                        color="warning"
                        startContent={<Dice5 className="h-3 w-3" />}
                        onPress={onRandomPick}
                        isLoading={isLoading}
                    >
                        Random Pick
                    </Button>
                    <Button variant="flat" onPress={onClose}>Cancel</Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

// ─── Bracket Management ─────────────────────────────────────

interface BracketMatch {
    id: string;
    round: number;
    position: number;
    player1Id: string | null;
    player2Id: string | null;
    winnerId: string | null;
    score1: number | null;
    score2: number | null;
    status: string;
    player1: { displayName: string } | null;
    player2: { displayName: string } | null;
}

function BracketManagement({
    tournamentId,
    tournamentName,
    tournamentType,
    hasVotes,
}: {
    tournamentId: string;
    tournamentName: string;
    tournamentType: string;
    hasVotes: boolean;
}) {
    const formatLabel = tournamentType === "LEAGUE" ? "League"
        : tournamentType === "GROUP_KNOCKOUT" ? "Group + Knockout"
            : "Bracket";
    const formatEmoji = tournamentType === "LEAGUE" ? "🏟️"
        : tournamentType === "GROUP_KNOCKOUT" ? "🌍"
            : "⚔️";
    const queryClient = useQueryClient();

    // Fetch bracket matches
    const { data: bracketData, isLoading } = useQuery<{
        rounds: { round: number; name: string; matches: BracketMatch[] }[];
        totalRounds: number;
        totalPlayers: number;
    } | null>({
        queryKey: ["admin-bracket", tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/tournaments/${tournamentId}/bracket`);
            if (!res.ok) return null;
            const json = await res.json();
            return json.data ?? null;
        },
    });

    const hasMatches = bracketData?.rounds && bracketData.rounds.length > 0;
    const allMatches = bracketData?.rounds?.flatMap((r) => r.matches) ?? [];
    const pendingMatches = allMatches.filter((m) => m.status === "PENDING" && m.player1Id && m.player2Id);
    const disputedMatches = allMatches.filter((m) => m.status === "DISPUTED");
    const confirmedMatches = allMatches.filter((m) => m.status === "CONFIRMED");

    // Generate bracket
    const generateBracket = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/tournaments/${tournamentId}/generate-bracket`, {
                method: "POST",
            });
            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Failed");
            }
            return res.json();
        },
        onSuccess: (data) => {
            toast.success(data.message || "Bracket generated!");
            queryClient.invalidateQueries({ queryKey: ["admin-bracket", tournamentId] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // Resolve dispute
    const resolveMatch = useMutation({
        mutationFn: async ({ matchId, winnerId, score1, score2 }: {
            matchId: string; winnerId: string; score1: number; score2: number;
        }) => {
            const res = await fetch(`/api/bracket-matches/${matchId}/resolve`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ winnerId, score1, score2 }),
            });
            if (!res.ok) throw new Error("Failed to resolve");
        },
        onSuccess: () => {
            toast.success("Match resolved!");
            queryClient.invalidateQueries({ queryKey: ["admin-bracket", tournamentId] });
        },
        onError: () => toast.error("Failed to resolve match"),
    });

    // Random pick
    const randomPick = useMutation({
        mutationFn: async (matchId: string) => {
            const res = await fetch(`/api/bracket-matches/${matchId}/random-pick`, {
                method: "POST",
            });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        onSuccess: (data) => {
            toast.success(data.message || "Winner randomly selected!");
            queryClient.invalidateQueries({ queryKey: ["admin-bracket", tournamentId] });
        },
        onError: () => toast.error("Failed to random pick"),
    });

    // Deadline check — auto-resolves all expired PENDING matches (all tournaments)
    const deadlineCheck = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/bracket-matches/deadline-check", { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed");
            return data;
        },
        onSuccess: (data) => {
            const { resolved } = data.data ?? {};
            toast.success(resolved > 0
                ? `Auto-resolved ${resolved} expired match${resolved > 1 ? "es" : ""} (1–0 random winner)`
                : "No expired matches found."
            );
            queryClient.invalidateQueries({ queryKey: ["admin-bracket", tournamentId] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const statusColor = (s: string) => {
        switch (s) {
            case "CONFIRMED": return "success";
            case "SUBMITTED": return "warning";
            case "DISPUTED": return "danger";
            case "BYE": return "secondary";
            default: return "default";
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
        >
            <Card className="border border-divider">
                <CardBody className="p-4 space-y-4">
                    {/* Header */}
                    <div className="flex items-center gap-2">
                        <Swords className="h-4 w-4 text-primary" />
                        <div>
                            <p className="text-sm font-semibold">{formatEmoji} {formatLabel} Overview</p>
                            <p className="text-xs text-foreground/40">
                                {hasMatches
                                    ? `${allMatches.length} matches · ${confirmedMatches.length} confirmed · ${disputedMatches.length} disputed`
                                    : "No bracket generated yet — go to the Bracket page to generate"
                                }
                            </p>
                        </div>
                    </div>

                    {isLoading && (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin text-foreground/30" />
                        </div>
                    )}

                    {/* Match status summary grid */}
                    {hasMatches && (
                        <div className="grid grid-cols-5 gap-1.5 text-center">
                            {[
                                { label: "Pending", count: allMatches.filter((m) => m.status === "PENDING").length, color: "text-foreground/40" },
                                { label: "Submit", count: allMatches.filter((m) => m.status === "SUBMITTED").length, color: "text-warning" },
                                { label: "Dispute", count: disputedMatches.length, color: "text-danger" },
                                { label: "Done", count: confirmedMatches.length, color: "text-success" },
                                { label: "BYE", count: allMatches.filter((m) => m.status === "BYE").length, color: "text-secondary" },
                            ].map((s) => (
                                <div key={s.label} className="rounded-lg bg-foreground/5 p-2">
                                    <p className={`text-lg font-bold ${s.color}`}>{s.count}</p>
                                    <p className="text-[9px] text-foreground/40 whitespace-nowrap">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Actions */}
                    {hasMatches && (
                        <div className="flex flex-col gap-2">
                            {/* Deadline Check */}
                            <Button
                                size="sm"
                                color="warning"
                                variant="flat"
                                className="w-full"
                                isLoading={deadlineCheck.isPending}
                                startContent={<Clock className="h-3 w-3" />}
                                onPress={() => {
                                    if (confirm("Auto-resolve all expired PENDING matches with a random 1–0 winner?\n\nThis affects matches where the deadline passed and neither player submitted a result."))
                                        deadlineCheck.mutate();
                                }}
                            >
                                ⏰ Auto-resolve Expired Matches
                            </Button>

                            {/* Advance Groups → Knockout (GROUP_KNOCKOUT only) */}
                            {tournamentType === "GROUP_KNOCKOUT" && (
                                <Button
                                    size="sm"
                                    color="primary"
                                    variant="flat"
                                    className="w-full"
                                    startContent={<Swords className="h-3 w-3" />}
                                    onPress={async () => {
                                        if (!confirm("Advance top 2 from each group to the knockout stage?")) return;
                                        try {
                                            const res = await fetch(`/api/tournaments/${tournamentId}/advance-groups`, { method: "POST" });
                                            const json = await res.json();
                                            if (!res.ok) throw new Error(json.error || "Failed");
                                            toast.success(json.message || "Groups advanced to knockout!");
                                            queryClient.invalidateQueries({ queryKey: ["admin-bracket", tournamentId] });
                                        } catch (err: unknown) {
                                            toast.error(err instanceof Error ? err.message : "Failed to advance groups");
                                        }
                                    }}
                                >
                                    🌍 Advance Groups → Knockout
                                </Button>
                            )}
                        </div>
                    )}

                    {!hasMatches && !isLoading && (
                        <p className="text-xs text-foreground/30 text-center py-2">
                            Visit the <strong className="text-foreground/50">Bracket</strong> page to generate and manage matches.
                        </p>
                    )}
                </CardBody>
            </Card>
        </motion.div>
    );
}

