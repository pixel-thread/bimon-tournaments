"use client";

import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Input,
    Avatar,
    Chip,
    Checkbox,
    Spinner,
    Switch,
} from "@heroui/react";
import { Search, Plus, X, Pencil, Trash2, Ban, MinusCircle, Ghost, UserPlus } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GAME } from "@/lib/game-config";

interface Player {
    id: string;
    displayName: string | null;
    username: string;
    imageUrl: string | null;
    category: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    teamId: string;
    teamName: string;
    teamNumber: number;
    initialPlayers: Player[];
    isChampionship?: boolean;
    tournamentId?: string;
}

export function EditTeamModal({
    isOpen,
    onClose,
    teamId,
    teamName,
    teamNumber,
    initialPlayers,
    isChampionship = false,
    tournamentId,
}: Props) {
    const [search, setSearch] = useState("");
    const [currentPlayers, setCurrentPlayers] = useState<Player[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [refundOnDelete, setRefundOnDelete] = useState(false);
    const [deductUC, setDeductUC] = useState(false);
    const [showDeductPoints, setShowDeductPoints] = useState(false);
    const [deductPointsValue, setDeductPointsValue] = useState("");
    const [refundRemoved, setRefundRemoved] = useState(false);
    const [ghostName, setGhostName] = useState("");
    const [isAddingGhost, setIsAddingGhost] = useState(false);
    const queryClient = useQueryClient();

    // Initialize on open
    useEffect(() => {
        if (isOpen) {
            setCurrentPlayers([...initialPlayers]);
        }
    }, [isOpen, initialPlayers]);

    // Track changes
    const addedIds = useMemo(
        () => currentPlayers.filter(p => !initialPlayers.some(ip => ip.id === p.id)).map(p => p.id),
        [currentPlayers, initialPlayers]
    );
    const removedIds = useMemo(
        () => initialPlayers.filter(ip => !currentPlayers.some(p => p.id === ip.id)).map(p => p.id),
        [currentPlayers, initialPlayers]
    );
    const hasChanges = addedIds.length > 0 || removedIds.length > 0;

    // Search players
    const { data: searchResults = [], isFetching } = useQuery<Player[]>({
        queryKey: ["player-search-edit", search],
        queryFn: async () => {
            if (!search || search.length < 2) return [];
            const res = await fetch(`/api/players?search=${encodeURIComponent(search)}&limit=10`);
            if (!res.ok) return [];
            const json = await res.json();
            return (json.data ?? []).map((p: Record<string, unknown>) => ({
                id: p.id,
                displayName: p.displayName,
                username: p.username,
                imageUrl: p.imageUrl,
                category: p.category,
            }));
        },
        enabled: search.length >= 2,
        staleTime: 10_000,
    });

    const currentIds = useMemo(() => new Set(currentPlayers.map(p => p.id)), [currentPlayers]);

    const availablePlayers = useMemo(
        () => searchResults.filter(p => !currentIds.has(p.id)),
        [searchResults, currentIds]
    );

    function addPlayer(player: Player) {
        setCurrentPlayers(prev => [...prev, player]);
    }

    function removePlayer(id: string) {
        setCurrentPlayers(prev => prev.filter(p => p.id !== id));
    }

    // Save mutation
    const { mutate: saveChanges, isPending } = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/teams/${teamId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    addPlayerIds: addedIds,
                    removePlayerIds: removedIds,
                    deductUC: addedIds.length > 0 ? deductUC : undefined,
                    refund: removedIds.length > 0 ? refundRemoved : undefined,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to update team");
            return json;
        },
        onSuccess: (data) => {
            toast.success(data.message || "Team updated");
            queryClient.invalidateQueries({ queryKey: ["teams"] });
            handleClose();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // Delete team mutation
    const { mutate: deleteTeam, isPending: isDeletePending } = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/teams/${teamId}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refund: refundOnDelete }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to delete team");
            return json;
        },
        onSuccess: (data) => {
            toast.success(data.message || "Team deleted");
            queryClient.invalidateQueries({ queryKey: ["teams"] });
            handleClose();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // DQ & point deduction status (works for any tournament)
    const { data: teamStatus } = useQuery<{ disqualified: boolean; pointDeduction: number } | null>({
        queryKey: ["team-status", teamId],
        queryFn: async () => {
            const res = await fetch(`/api/teams/${teamId}`);
            if (!res.ok) return null;
            const json = await res.json();
            return {
                disqualified: json.data?.disqualified ?? false,
                pointDeduction: json.data?.pointDeduction ?? 0,
            };
        },
        enabled: isOpen,
    });

    const isDQ = teamStatus?.disqualified ?? false;
    const currentDeduction = teamStatus?.pointDeduction ?? 0;

    const dqMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/teams/${teamId}/disqualify`, {
                method: "POST",
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to toggle DQ");
            return json;
        },
        onSuccess: (data) => {
            toast.success(data.message);
            queryClient.invalidateQueries({ queryKey: ["team-status", teamId] });
            queryClient.invalidateQueries({ queryKey: ["teams"] });
            if (isChampionship && tournamentId) {
                queryClient.invalidateQueries({ queryKey: ["championship-status", tournamentId] });
                queryClient.invalidateQueries({ queryKey: ["champ-entries", tournamentId] });
            }
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // Point deduction mutation
    const deductPointsMutation = useMutation({
        mutationFn: async (points: number) => {
            const res = await fetch(`/api/teams/${teamId}/deduct-points`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ points }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to set point deduction");
            return json;
        },
        onSuccess: (data) => {
            toast.success(data.message);
            queryClient.invalidateQueries({ queryKey: ["team-status", teamId] });
            queryClient.invalidateQueries({ queryKey: ["teams"] });
            setShowDeductPoints(false);
            setDeductPointsValue("");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    function handleClose() {
        setSearch("");
        setCurrentPlayers([]);
        setShowDeleteConfirm(false);
        setRefundOnDelete(false);
        setDeductUC(false);
        setRefundRemoved(false);
        setGhostName("");
        setShowDeductPoints(false);
        setDeductPointsValue("");
        onClose();
    }

    return (
        <>
            <Modal isOpen={isOpen} onClose={handleClose} size="lg" scrollBehavior="inside" hideCloseButton>
                <ModalContent>
                    <ModalHeader className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Pencil className="h-5 w-5" />
                            Edit Team {teamNumber}
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                    isIconOnly
                                    size="sm"
                                    variant={currentDeduction > 0 ? "flat" : "light"}
                                    color={currentDeduction > 0 ? "warning" : "default"}
                                    onPress={() => {
                                        setDeductPointsValue(currentDeduction > 0 ? String(currentDeduction) : "");
                                        setShowDeductPoints(true);
                                    }}
                                    title={currentDeduction > 0 ? `${currentDeduction} pts deducted` : "Deduct points"}
                                >
                                    <MinusCircle className="h-4 w-4" />
                                </Button>
                            <Button
                                    isIconOnly
                                    size="sm"
                                    variant={isDQ ? "flat" : "light"}
                                    color={isDQ ? "danger" : "default"}
                                    onPress={() => {
                                        if (window.confirm(isDQ
                                            ? `Reinstate ${teamName}?`
                                            : `Disqualify ${teamName}? Their points will be zeroed in standings.`
                                        )) {
                                            dqMutation.mutate();
                                        }
                                    }}
                                    isLoading={dqMutation.isPending}
                                    title={isDQ ? "Reinstate team" : "Disqualify team"}
                                >
                                    <Ban className="h-4 w-4" />
                                </Button>
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                color="danger"
                                onPress={() => setShowDeleteConfirm(true)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        {/* Current players */}
                        <div className="space-y-2">
                            <p className="text-xs text-foreground/50">
                                Current Players ({currentPlayers.length})
                            </p>
                            {currentPlayers.length === 0 ? (
                                <p className="py-2 text-sm text-foreground/30">No players in this team</p>
                            ) : (
                                <div className="space-y-1">
                                    {currentPlayers.map(p => {
                                        const isNew = addedIds.includes(p.id);
                                        return (
                                            <div
                                                key={p.id}
                                                className={`flex items-center gap-2 rounded-lg px-3 py-2 ${isNew ? "bg-success/10 border border-success/20" : "bg-default-50"
                                                    }`}
                                            >
                                                <Avatar
                                                    src={p.imageUrl || undefined}
                                                    name={p.displayName || p.username}
                                                    size="sm"
                                                    className="h-7 w-7"
                                                />
                                                <span className="flex-1 truncate text-sm">
                                                    {p.displayName || p.username}
                                                </span>
                                                {isNew && (
                                                    <Chip size="sm" color="success" variant="flat" className="text-[10px]">
                                                        NEW
                                                    </Chip>
                                                )}
                                                <Button
                                                    isIconOnly
                                                    size="sm"
                                                    variant="light"
                                                    color="danger"
                                                    onPress={() => removePlayer(p.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {removedIds.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-xs text-danger/70">
                                        Removing ({removedIds.length})
                                    </p>
                                    {initialPlayers.filter(p => removedIds.includes(p.id)).map(p => (
                                        <div
                                            key={p.id}
                                            className="flex items-center gap-2 rounded-lg px-3 py-2 bg-danger/5 border border-danger/10 opacity-50 line-through"
                                        >
                                            <Avatar
                                                src={p.imageUrl || undefined}
                                                name={p.displayName || p.username}
                                                size="sm"
                                                className="h-7 w-7"
                                            />
                                            <span className="flex-1 truncate text-sm">
                                                {p.displayName || p.username}
                                            </span>
                                            <Button
                                                size="sm"
                                                variant="flat"
                                                color="default"
                                                onPress={() => addPlayer(p)}
                                            >
                                                Undo
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Add player search */}
                        <div className="pt-2">
                            <p className="text-xs text-foreground/50 mb-2">Add Player</p>
                            <Input
                                placeholder="Search players by name..."
                                value={search}
                                onValueChange={setSearch}
                                startContent={<Search className="h-4 w-4 text-default-400" />}
                                size="sm"
                                isClearable
                                onClear={() => setSearch("")}
                            />
                        </div>

                        {isFetching && (
                            <div className="flex justify-center py-4">
                                <Spinner size="sm" />
                            </div>
                        )}

                        {!isFetching && availablePlayers.length > 0 && (
                            <div className="max-h-40 space-y-1 overflow-y-auto">
                                {availablePlayers.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => addPlayer(p)}
                                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-default-100"
                                    >
                                        <Avatar
                                            src={p.imageUrl || undefined}
                                            name={p.displayName || p.username}
                                            size="sm"
                                            className="h-8 w-8"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">
                                                {p.displayName || p.username}
                                            </p>
                                            <p className="text-xs text-foreground/40">@{p.username}</p>
                                        </div>
                                        <Plus className="h-4 w-4 text-foreground/30" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {search.length >= 2 && !isFetching && availablePlayers.length === 0 && (
                            <p className="py-2 text-center text-sm text-foreground/40">
                                No available players found
                            </p>
                        )}

                        {/* Add ghost player inline */}
                        <div className="pt-2 border-t border-divider">
                            <p className="text-xs text-foreground/50 mb-2 flex items-center gap-1">
                                <Ghost className="h-3 w-3" /> Add Ghost Player
                            </p>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Player name"
                                    value={ghostName}
                                    onValueChange={v => setGhostName(v.slice(0, 20))}
                                    size="sm"
                                    className="flex-1"
                                />
                                <Button
                                    size="sm"
                                    color="secondary"
                                    variant="flat"
                                    isDisabled={!ghostName.trim() || isAddingGhost}
                                    isLoading={isAddingGhost}
                                    onPress={async () => {
                                        if (!ghostName.trim()) return;
                                        setIsAddingGhost(true);
                                        try {
                                            const res = await fetch(`/api/teams/${teamId}/add-ghost`, {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ name: ghostName.trim() }),
                                            });
                                            const json = await res.json();
                                            if (!res.ok) throw new Error(json.message || "Failed");
                                            // Add the created ghost to current players list
                                            const created = json.data;
                                            if (created) {
                                                setCurrentPlayers(prev => [...prev, {
                                                    id: created.playerId,
                                                    displayName: created.displayName,
                                                    username: created.displayName || "ghost",
                                                    imageUrl: null,
                                                    category: "BOT",
                                                }]);
                                                // Re-sync initialPlayers so the new ghost doesn't show as "added"
                                                initialPlayers.push({
                                                    id: created.playerId,
                                                    displayName: created.displayName,
                                                    username: created.displayName || "ghost",
                                                    imageUrl: null,
                                                    category: "BOT",
                                                });
                                            }
                                            toast.success(json.message || "Ghost added");
                                            setGhostName("");
                                            queryClient.invalidateQueries({ queryKey: ["teams"] });
                                        } catch (err: any) {
                                            toast.error(err.message);
                                        } finally {
                                            setIsAddingGhost(false);
                                        }
                                    }}
                                    startContent={<UserPlus className="h-3.5 w-3.5" />}
                                >
                                    Add
                                </Button>
                            </div>
                        </div>

                        {/* UC toggles for add/remove */}
                        {(addedIds.length > 0 || removedIds.length > 0) && (
                            <div className="space-y-2 pt-2">
                                {addedIds.length > 0 && (
                                    <Checkbox
                                        isSelected={deductUC}
                                        onValueChange={setDeductUC}
                                        size="sm"
                                    >
                                        <span className="text-sm">Deduct {GAME.currency} entry fee from added players</span>
                                    </Checkbox>
                                )}
                                {removedIds.length > 0 && (
                                    <Checkbox
                                        isSelected={refundRemoved}
                                        onValueChange={setRefundRemoved}
                                        size="sm"
                                    >
                                        <span className="text-sm">Refund {GAME.currency} entry fee to removed players</span>
                                    </Checkbox>
                                )}
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={handleClose} size="sm">
                            Cancel
                        </Button>
                        <Button
                            color="primary"
                            onPress={() => saveChanges()}
                            isLoading={isPending}
                            isDisabled={!hasChanges}
                            size="sm"
                        >
                            Save Changes
                            {hasChanges && ` (+${addedIds.length} -${removedIds.length})`}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Delete Team Confirmation Modal */}
            <Modal
                isOpen={showDeleteConfirm}
                onClose={() => { setShowDeleteConfirm(false); setRefundOnDelete(false); }}
                size="sm"
            >
                <ModalContent>
                    <ModalHeader>Delete Team #{teamNumber}?</ModalHeader>
                    <ModalBody className="space-y-3">
                        <p className="text-sm text-foreground/60">
                            This will permanently delete the team and all associated stats, records, and winner data. This cannot be undone.
                        </p>
                        <div className="flex items-center justify-between rounded-lg bg-default-100 p-3">
                            <div>
                                <p className="text-sm font-medium">Refund {GAME.currency}</p>
                                <p className="text-xs text-foreground/50">
                                    Credit entry fee back to each player
                                </p>
                            </div>
                            <Switch
                                size="sm"
                                isSelected={refundOnDelete}
                                onValueChange={setRefundOnDelete}
                                color="success"
                            />
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="flat"
                            size="sm"
                            onPress={() => { setShowDeleteConfirm(false); setRefundOnDelete(false); }}
                        >
                            Cancel
                        </Button>
                        <Button
                            color="danger"
                            size="sm"
                            onPress={() => deleteTeam()}
                            isLoading={isDeletePending}
                        >
                            {refundOnDelete ? "Delete & Refund" : "Delete"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Point Deduction Modal */}
            <Modal
                isOpen={showDeductPoints}
                onClose={() => { setShowDeductPoints(false); setDeductPointsValue(""); }}
                size="sm"
            >
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2">
                        <MinusCircle className="h-5 w-5 text-warning" />
                        Deduct Points
                    </ModalHeader>
                    <ModalBody className="space-y-3">
                        <p className="text-sm text-foreground/60">
                            Set the total number of points to deduct from <strong>{teamName}</strong>&apos;s standings total. Set to 0 to clear.
                        </p>
                        {currentDeduction > 0 && (
                            <div className="flex items-center gap-2 rounded-lg bg-warning/10 border border-warning/20 px-3 py-2">
                                <span className="text-xs text-warning">Current deduction: <strong>{currentDeduction}</strong> pts</span>
                            </div>
                        )}
                        <Input
                            type="number"
                            min={0}
                            placeholder="Points to deduct"
                            value={deductPointsValue}
                            onValueChange={setDeductPointsValue}
                            size="sm"
                            autoFocus
                            startContent={<span className="text-foreground/30 text-sm">−</span>}
                            description="This subtracts from total points in standings"
                        />
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="flat"
                            size="sm"
                            onPress={() => { setShowDeductPoints(false); setDeductPointsValue(""); }}
                        >
                            Cancel
                        </Button>
                        {currentDeduction > 0 && (
                            <Button
                                variant="flat"
                                color="default"
                                size="sm"
                                onPress={() => deductPointsMutation.mutate(0)}
                                isLoading={deductPointsMutation.isPending}
                            >
                                Clear
                            </Button>
                        )}
                        <Button
                            color="warning"
                            size="sm"
                            onPress={() => {
                                const pts = Number(deductPointsValue);
                                if (isNaN(pts) || pts < 0) {
                                    toast.error("Enter a valid positive number");
                                    return;
                                }
                                deductPointsMutation.mutate(pts);
                            }}
                            isLoading={deductPointsMutation.isPending}
                            isDisabled={!deductPointsValue && currentDeduction === 0}
                        >
                            {Number(deductPointsValue) === 0 ? "Clear Deduction" : "Deduct"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}
