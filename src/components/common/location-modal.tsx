"use client";

import { useState, useEffect } from "react";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Input,
    Listbox,
    ListboxItem,
    Skeleton,
} from "@heroui/react";
import { MapPin, Search, Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface LocationItem {
    id: string;
    name: string;
}

/**
 * One-time blocking modal for players to set their location.
 * Shows when player has no state/district/town set.
 * States & districts are selectable from DB. Users can add new entries.
 * Towns are selectable + free-text.
 */
export function LocationModal({
    isOpen,
    onComplete,
    blocking = true,
}: {
    isOpen: boolean;
    onComplete: () => void;
    /** When true (default), modal cannot be dismissed. Set false for profile edit. */
    blocking?: boolean;
}) {
    const queryClient = useQueryClient();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [state, setState] = useState("");
    const [stateId, setStateId] = useState("");
    const [district, setDistrict] = useState("");
    const [districtId, setDistrictId] = useState("");
    const [town, setTown] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [saving, setSaving] = useState(false);

    // Fetch states from DB
    const { data: states = [], isLoading: statesLoading } = useQuery<LocationItem[]>({
        queryKey: ["locations", "states"],
        queryFn: async () => {
            const res = await fetch("/api/locations?level=states");
            if (!res.ok) return [];
            return (await res.json()).data ?? [];
        },
        enabled: isOpen,
        staleTime: 60_000,
    });

    // Fetch districts for selected state
    const { data: districts = [], isLoading: districtsLoading } = useQuery<LocationItem[]>({
        queryKey: ["locations", "districts", stateId],
        queryFn: async () => {
            const res = await fetch(`/api/locations?level=districts&stateId=${stateId}`);
            if (!res.ok) return [];
            return (await res.json()).data ?? [];
        },
        enabled: isOpen && step >= 2 && !!stateId,
        staleTime: 60_000,
    });

    // Fetch towns for selected district
    const { data: towns = [], isLoading: townsLoading } = useQuery<LocationItem[]>({
        queryKey: ["locations", "towns", districtId],
        queryFn: async () => {
            const res = await fetch(`/api/locations?level=towns&districtId=${districtId}`);
            if (!res.ok) return [];
            return (await res.json()).data ?? [];
        },
        enabled: isOpen && step >= 3 && !!districtId,
        staleTime: 60_000,
    });

    // Loading state for current step
    const isLoadingOptions =
        (step === 1 && statesLoading) ||
        (step === 2 && districtsLoading) ||
        (step === 3 && townsLoading);

    // Filter options by search query
    const currentOptions =
        step === 1 ? states : step === 2 ? districts : towns;
    const filtered = searchQuery.trim()
        ? currentOptions.filter((o) =>
              o.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : currentOptions;

    // Check if search query is a new entry (not in existing list)
    // Only allow adding new entries for towns — states and districts are admin-managed
    const isNewEntry =
        step === 3 &&
        searchQuery.trim() &&
        !currentOptions.some(
            (o) => o.name.toLowerCase() === searchQuery.trim().toLowerCase()
        );

    function selectItem(item: LocationItem) {
        if (step === 1) {
            setState(item.name);
            setStateId(item.id);
            setDistrict("");
            setDistrictId("");
            setTown("");
            setSearchQuery("");
            setStep(2);
        } else if (step === 2) {
            setDistrict(item.name);
            setDistrictId(item.id);
            setTown("");
            setSearchQuery("");
            setStep(3);
        } else {
            setTown(item.name);
            setSearchQuery("");
        }
    }

    function addNewEntry() {
        const val = searchQuery.trim();
        if (!val || step !== 3) return;
        setTown(val);
        setSearchQuery("");
    }

    async function handleSave() {
        if (!state.trim() || !district.trim() || !town.trim()) {
            toast.error("All fields are required");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/profile/location", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    state: state.trim(),
                    district: district.trim(),
                    town: town.trim(),
                }),
            });
            if (res.ok) {
                toast.success("Location saved!");
                queryClient.invalidateQueries({ queryKey: ["profile"] });
                queryClient.invalidateQueries({ queryKey: ["locations"] });
                onComplete();
            } else {
                const json = await res.json();
                toast.error(json.message || "Failed to save");
            }
        } catch {
            toast.error("Network error");
        } finally {
            setSaving(false);
        }
    }

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setState("");
            setStateId("");
            setDistrict("");
            setDistrictId("");
            setTown("");
            setSearchQuery("");
        }
    }, [isOpen]);

    const stepLabels = ["State", "District", "Town/Village"];

    return (
        <Modal
            isOpen={isOpen}
            isDismissable={!blocking}
            hideCloseButton={blocking}
            onClose={!blocking ? onComplete : undefined}
            size="sm"
            placement="center"
        >
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        Set Your Location
                    </div>
                    <p className="text-xs text-foreground/50 font-normal">
                        This helps us show regional rankings
                    </p>
                </ModalHeader>
                <ModalBody>
                    {/* Step indicator */}
                    <div className="flex items-center gap-2 mb-2">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className="flex items-center gap-1.5 flex-1">
                                <div
                                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                                        s <= step ? "bg-primary" : "bg-default-200"
                                    }`}
                                />
                                <span
                                    className={`text-[10px] font-medium ${
                                        s === step
                                            ? "text-primary"
                                            : s < step
                                              ? "text-foreground/50"
                                              : "text-foreground/30"
                                    }`}
                                >
                                    {stepLabels[s - 1]}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Selected breadcrumbs */}
                    {step > 1 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            <button
                                onClick={() => {
                                    setStep(1);
                                    setDistrict("");
                                    setDistrictId("");
                                    setTown("");
                                    setSearchQuery("");
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                            >
                                {state} ✕
                            </button>
                            {step > 2 && (
                                <button
                                    onClick={() => {
                                        setStep(2);
                                        setTown("");
                                        setSearchQuery("");
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                                >
                                    {district} ✕
                                </button>
                            )}
                        </div>
                    )}

                    {/* Search + list */}
                    <div className="space-y-2">
                        <Input
                            placeholder={`${step === 3 && town ? town : `Search ${stepLabels[step - 1].toLowerCase()}...`}`}
                            value={searchQuery}
                            onValueChange={setSearchQuery}
                            startContent={<Search className="h-4 w-4 text-default-400" />}
                            size="sm"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && isNewEntry) {
                                    addNewEntry();
                                }
                            }}
                        />

                        {/* Loading skeleton */}
                        {isLoadingOptions && (
                            <div className="space-y-2">
                                {[...Array(5)].map((_, i) => (
                                    <Skeleton key={i} className="h-9 w-full rounded-lg" />
                                ))}
                            </div>
                        )}

                        {/* Existing options */}
                        {!isLoadingOptions && filtered.length > 0 && (
                            <Listbox
                                aria-label={`${stepLabels[step - 1]} options`}
                                className="max-h-48 overflow-y-auto rounded-lg border border-divider"
                                onAction={(key) => {
                                    const item = currentOptions.find(
                                        (o) => o.id === key
                                    );
                                    if (item) selectItem(item);
                                }}
                            >
                                {filtered.map((item) => (
                                    <ListboxItem key={item.id}>
                                        {item.name}
                                    </ListboxItem>
                                ))}
                            </Listbox>
                        )}

                        {/* Add new town button — always visible on step 3 */}
                        {step === 3 && !town && (
                            <button
                                onClick={() => {
                                    if (searchQuery.trim() && isNewEntry) {
                                        addNewEntry();
                                    } else {
                                        // Focus the search input
                                        const input = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
                                        input?.focus();
                                    }
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/5 border border-dashed border-primary/30 text-sm text-primary hover:bg-primary/10 transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                                {searchQuery.trim() && isNewEntry
                                    ? <>Add &ldquo;{searchQuery.trim()}&rdquo;</>
                                    : "Add new town/village"
                                }
                            </button>
                        )}

                        {/* Selected town display */}
                        {step === 3 && town && !searchQuery && (
                            <div className="px-3 py-2 rounded-lg bg-success/10 border border-success/20 text-sm text-success flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                <span className="flex-1">{town}</span>
                                <button
                                    type="button"
                                    onClick={() => setTown("")}
                                    className="w-5 h-5 rounded-full bg-success/20 hover:bg-success/30 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                                >
                                    <span className="text-xs font-bold">✕</span>
                                </button>
                            </div>
                        )}
                    </div>
                </ModalBody>
                <ModalFooter>
                    {step > 1 && (
                        <Button
                            variant="flat"
                            size="sm"
                            onPress={() => {
                                if (step === 3) {
                                    setStep(2);
                                    setTown("");
                                    setSearchQuery("");
                                } else {
                                    setStep(1);
                                    setDistrict("");
                                    setDistrictId("");
                                    setSearchQuery("");
                                }
                            }}
                        >
                            Back
                        </Button>
                    )}
                    {step === 3 && town ? (
                        <Button
                            color="primary"
                            size="sm"
                            isLoading={saving}
                            isDisabled={!!searchQuery.trim()}
                            onPress={handleSave}
                        >
                            Save Location
                        </Button>
                    ) : (
                        step < 3 && (
                            <Button
                                color="primary"
                                size="sm"
                                isDisabled
                            >
                                Select {stepLabels[step - 1]}
                            </Button>
                        )
                    )}
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
