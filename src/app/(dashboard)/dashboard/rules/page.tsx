"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Card,
    CardBody,
    Button,
    Skeleton,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Input,
    Textarea,
    useDisclosure,
    Chip,
} from "@heroui/react";
import {
    BookOpen,
    Plus,
    Pencil,
    Trash2,
    GripVertical,
} from "lucide-react";
import { Reorder, useDragControls, motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

interface Rule {
    id: string;
    title: string;
    content: string;
    category: string; // CASUAL, RANKED, or BOTH
    order: number;
    createdAt: string;
    updatedAt: string;
}

/* ─── Draggable Rule Item ─────────────────────────────────── */
function RuleItem({
    rule,
    index,
    onEdit,
    onDelete,
    onDragEnd,
}: {
    rule: Rule;
    index: number;
    onEdit: (rule: Rule) => void;
    onDelete: (id: string) => void;
    onDragEnd: () => void;
}) {
    const controls = useDragControls();

    return (
        <Reorder.Item
            value={rule}
            dragListener={false}
            dragControls={controls}
            onDragEnd={onDragEnd}
            className="list-none"
            style={{ touchAction: "none" }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, x: -16 }}
            transition={{ duration: 0.2 }}
        >
            <Card className="border border-divider">
                <CardBody className="flex flex-row items-start gap-2 p-3">
                    {/* Drag handle */}
                    <button
                        className="flex h-7 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-foreground/25 hover:text-foreground/50 active:cursor-grabbing touch-none"
                        onPointerDown={(e) => controls.start(e)}
                    >
                        <GripVertical className="h-4 w-4" />
                    </button>

                    {/* Number badge */}
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                        {index + 1}
                    </span>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{rule.title}</p>
                            <Chip size="sm" variant="flat" className="text-[10px]" color={
                                rule.category === "RANKED" ? "warning" : rule.category === "CASUAL" ? "primary" : "default"
                            }>
                                {rule.category === "BOTH" ? "All" : rule.category === "RANKED" ? "🏆" : "🎮"}
                            </Chip>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-foreground/50 whitespace-pre-wrap">
                            {rule.content}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 gap-1">
                        <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            onPress={() => onEdit(rule)}
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={() => {
                                if (confirm(`Delete "${rule.title}"?`))
                                    onDelete(rule.id);
                            }}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </CardBody>
            </Card>
        </Reorder.Item>
    );
}

/* ─── Main Page ───────────────────────────────────────────── */
export default function AdminRulesPage() {
    const queryClient = useQueryClient();
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [editingRule, setEditingRule] = useState<Rule | null>(null);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [category, setCategory] = useState<"CASUAL" | "RANKED" | "BOTH">("BOTH");
    // Local reorder state — drives the Reorder.Group
    const [localRules, setLocalRules] = useState<Rule[]>([]);
    const orderBeforeDrag = useRef<string[]>([]);

    const { data: rules = [], isLoading } = useQuery<Rule[]>({
        queryKey: ["rules"],
        queryFn: async () => {
            const res = await fetch("/api/rules");
            if (!res.ok) throw new Error("Failed");
            const json = await res.json();
            return json.data;
        },
    });

    // Sync server data → local state (only when not dragging)
    const displayRules = localRules.length > 0 ? localRules : rules;

    // Keep local state in sync when server data changes
    // (use a ref-check to avoid infinite loops)
    const lastServerIds = useRef("");
    const serverIds = rules.map((r) => r.id).join(",");
    if (serverIds !== lastServerIds.current && serverIds) {
        lastServerIds.current = serverIds;
        setLocalRules(rules);
    }

    /* ─── Reorder mutation ──────────────────────────────────── */
    const reorderRules = useMutation({
        mutationFn: async (orderedIds: string[]) => {
            const res = await fetch("/api/rules/reorder", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderedIds }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to reorder");
            }
        },
        onError: (err) => {
            // Revert to order before drag
            if (orderBeforeDrag.current.length > 0) {
                const prevOrder = orderBeforeDrag.current;
                setLocalRules((curr) => {
                    const map = new Map(curr.map((r) => [r.id, r]));
                    return prevOrder.map((id) => map.get(id)!).filter(Boolean);
                });
            }
            toast.error(err.message || "Failed to reorder");
        },
        onSuccess: () => {
            toast.success("Order saved");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["rules"] });
        },
    });

    const handleReorder = (newOrder: Rule[]) => {
        setLocalRules(newOrder);
    };

    const handleDragEnd = () => {
        const newIds = localRules.map((r) => r.id);
        const oldIds = rules.map((r) => r.id);
        // Only save if order actually changed
        if (newIds.join(",") !== oldIds.join(",")) {
            orderBeforeDrag.current = oldIds;
            reorderRules.mutate(newIds);
        }
    };

    /* ─── Save mutation ─────────────────────────────────────── */
    const saveRule = useMutation({
        mutationFn: async (vars: { title: string; content: string; category: string; editing: Rule | null }) => {
            const url = vars.editing ? `/api/rules/${vars.editing.id}` : "/api/rules";
            const method = vars.editing ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: vars.title,
                    content: vars.content,
                    category: vars.category,
                    order: vars.editing ? vars.editing.order : rules.length + 1,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to save rule");
            }
            const json = await res.json();
            return json.data as Rule;
        },
        onMutate: async (vars) => {
            await queryClient.cancelQueries({ queryKey: ["rules"] });
            const previous = queryClient.getQueryData<Rule[]>(["rules"]);

            if (vars.editing) {
                const update = (list: Rule[]) =>
                    list.map((r) =>
                        r.id === vars.editing!.id
                            ? { ...r, title: vars.title.trim(), content: vars.content.trim() }
                            : r
                    );
                queryClient.setQueryData<Rule[]>(["rules"], (old = []) => update(old));
                setLocalRules((prev) => update(prev));
            } else {
                const tempRule: Rule = {
                    id: `temp-${Date.now()}`,
                    title: vars.title.trim(),
                    content: vars.content.trim(),
                    category: vars.category,
                    order: rules.length + 1,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                queryClient.setQueryData<Rule[]>(["rules"], (old = []) => [...old, tempRule]);
                setLocalRules((prev) => [...prev, tempRule]);
            }

            handleClose();
            return { previous };
        },
        onSuccess: (_data, vars) => {
            toast.success(vars.editing ? "Rule updated" : "Rule created");
        },
        onError: (err, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(["rules"], context.previous);
                setLocalRules(context.previous);
            }
            toast.error(err.message || "Failed to save rule");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["rules"] });
        },
    });

    /* ─── Delete mutation ───────────────────────────────────── */
    const deleteRule = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/rules/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to delete");
            }
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ["rules"] });
            const previous = queryClient.getQueryData<Rule[]>(["rules"]);
            queryClient.setQueryData<Rule[]>(["rules"], (old = []) =>
                old.filter((r) => r.id !== id)
            );
            setLocalRules((prev) => prev.filter((r) => r.id !== id));
            return { previous };
        },
        onSuccess: () => {
            toast.success("Rule deleted");
        },
        onError: (err, _id, context) => {
            if (context?.previous) {
                queryClient.setQueryData(["rules"], context.previous);
                setLocalRules(context.previous);
            }
            toast.error(err.message || "Failed to delete rule");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["rules"] });
        },
    });

    /* ─── Delete all mutation ───────────────────────────────── */
    const deleteAll = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/rules", { method: "DELETE" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to clear rules");
            }
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ["rules"] });
            const previous = queryClient.getQueryData<Rule[]>(["rules"]);
            queryClient.setQueryData<Rule[]>(["rules"], []);
            setLocalRules([]);
            return { previous };
        },
        onSuccess: () => {
            toast.success("All rules cleared");
        },
        onError: (err, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(["rules"], context.previous);
                setLocalRules(context.previous);
            }
            toast.error(err.message || "Failed to clear rules");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["rules"] });
        },
    });

    /* ─── Modal helpers ─────────────────────────────────────── */
    const handleOpen = (rule?: Rule) => {
        if (rule) {
            setEditingRule(rule);
            setTitle(rule.title);
            setContent(rule.content);
            setCategory((rule.category as "CASUAL" | "RANKED" | "BOTH") || "BOTH");
        } else {
            setEditingRule(null);
            setTitle("");
            setContent("");
            setCategory("BOTH");
        }
        onOpen();
    };

    const handleClose = () => {
        setEditingRule(null);
        setTitle("");
        setContent("");
        setCategory("BOTH");
        onClose();
    };

    /* ─── Render ────────────────────────────────────────────── */
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">Rules</h1>
                    <p className="text-sm text-foreground/50">
                        Manage tournament rules and guidelines
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {displayRules.length > 0 && (
                        <>
                            <Chip size="sm" variant="flat" color="primary">
                                {displayRules.length} rule{displayRules.length !== 1 ? "s" : ""}
                            </Chip>
                            <Button
                                size="sm"
                                variant="flat"
                                color="danger"
                                startContent={<Trash2 className="h-3.5 w-3.5" />}
                                onPress={() => {
                                    if (confirm("Delete ALL rules? This cannot be undone."))
                                        deleteAll.mutate();
                                }}
                                isLoading={deleteAll.isPending}
                            >
                                Clear All
                            </Button>
                        </>
                    )}
                    <Button
                        size="sm"
                        color="primary"
                        startContent={<Plus className="h-3.5 w-3.5" />}
                        onPress={() => handleOpen()}
                    >
                        Add Rule
                    </Button>
                </div>
            </div>

            {isLoading && (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-20 w-full rounded-xl" />
                    ))}
                </div>
            )}

            {!isLoading && displayRules.length === 0 && (
                <Card className="border border-divider">
                    <CardBody className="flex flex-col items-center gap-3 py-12">
                        <BookOpen className="h-10 w-10 text-foreground/15" />
                        <p className="text-sm text-foreground/40">No rules yet</p>
                        <Button
                            size="sm"
                            color="primary"
                            startContent={<Plus className="h-3.5 w-3.5" />}
                            onPress={() => handleOpen()}
                        >
                            Create First Rule
                        </Button>
                    </CardBody>
                </Card>
            )}

            {displayRules.length > 0 && (
                <Reorder.Group
                    axis="y"
                    values={displayRules}
                    onReorder={handleReorder}
                    className="space-y-2"
                    style={{ listStyle: "none", padding: 0, margin: 0 }}
                >
                    <AnimatePresence mode="popLayout">
                        {displayRules.map((rule, i) => (
                            <RuleItem
                                key={rule.id}
                                rule={rule}
                                index={i}
                                onEdit={handleOpen}
                                onDelete={(id) => deleteRule.mutate(id)}
                                onDragEnd={handleDragEnd}
                            />
                        ))}
                    </AnimatePresence>
                </Reorder.Group>
            )}

            {reorderRules.isPending && (
                <p className="text-xs text-foreground/40 text-center">Saving order…</p>
            )}

            {/* Add/Edit Rule Modal */}
            <Modal isOpen={isOpen} onClose={handleClose} placement="center" size="lg">
                <ModalContent>
                    <ModalHeader>
                        {editingRule ? "Edit Rule" : "Add Rule"}
                    </ModalHeader>
                    <ModalBody className="gap-4">
                        <Input
                            label="Title"
                            placeholder="e.g. Tournament Rules"
                            value={title}
                            onValueChange={setTitle}
                        />
                        <Textarea
                            label="Content"
                            placeholder="Enter the rule details..."
                            value={content}
                            onValueChange={setContent}
                            minRows={4}
                            maxRows={10}
                        />
                        <div>
                            <p className="text-sm font-medium mb-2">Applies to</p>
                            <div className="flex gap-2">
                                {(["BOTH", "RANKED", "CASUAL"] as const).map((cat) => (
                                    <Chip
                                        key={cat}
                                        variant={category === cat ? "solid" : "bordered"}
                                        color={cat === "RANKED" ? "warning" : cat === "CASUAL" ? "primary" : "default"}
                                        className="cursor-pointer"
                                        onClick={() => setCategory(cat)}
                                    >
                                        {cat === "BOTH" ? "Both" : cat === "RANKED" ? "🏆 Ranked" : "🎮 Casual"}
                                    </Chip>
                                ))}
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={handleClose}>
                            Cancel
                        </Button>
                        <Button
                            color="primary"
                            isLoading={saveRule.isPending}
                            isDisabled={!title.trim() || !content.trim()}
                            onPress={() => saveRule.mutate({ title, content, category, editing: editingRule })}
                        >
                            {editingRule ? "Save" : "Create"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}
