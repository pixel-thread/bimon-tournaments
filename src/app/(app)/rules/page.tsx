"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardBody, CardHeader, Skeleton, Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { BookOpen, ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { GAME } from "@/lib/game-config";

interface Rule {
    id: string;
    title: string;
    content: string;
    category: string; // CASUAL, RANKED, or BOTH
    order: number;
    createdAt: string;
    updatedAt: string;
}

type TabKey = "general" | "casual" | "ranked" | "tdm" | "wow";

const MAIN_TABS: { key: TabKey; label: string }[] = [
    { key: "general", label: "General" },
    { key: "casual", label: "Casual" },
    { key: "ranked", label: "Ranked" },
];

export default function RulesPage() {
    const [expandedRule, setExpandedRule] = useState<string | null>(null);
    const [tab, setTab] = useState<TabKey>("general");
    const [moreOpen, setMoreOpen] = useState(false);

    // Build "More" dropdown items based on game features
    const moreItems: { key: TabKey; label: string }[] = [
        ...(GAME.features.hasTDM ? [{ key: "tdm" as TabKey, label: "TDM" }] : []),
        ...(GAME.features.hasWoW ? [{ key: "wow" as TabKey, label: "WoW" }] : []),
    ];

    const isMoreTab = tab === "tdm" || tab === "wow";

    const { data: rules = [], isLoading } = useQuery<Rule[]>({
        queryKey: ["rules"],
        queryFn: async () => {
            const res = await fetch("/api/rules");
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            return json.data;
        },
    });

    // Filter rules based on selected tab
    const filteredRules = rules.filter((r) => {
        const cat = r.category || "BOTH";
        if (tab === "general") return cat === "BOTH";
        if (tab === "ranked") return cat === "RANKED";
        if (tab === "tdm") return cat === "TDM";
        if (tab === "wow") return cat === "WOW";
        return cat === "CASUAL";
    });

    // Count for badges
    const showTabs = rules.length > 0;

    return (
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
            <div className="mb-6 space-y-1">
                <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <h1 className="text-lg font-bold">Rules & Guidelines</h1>
                </div>
                <p className="text-sm text-foreground/50">
                    Everything you need to know about tournaments
                </p>
            </div>

            {/* ── General / Casual / Ranked / More Tabs ── */}
            {showTabs && (
                <div className="flex items-center gap-1 p-1 rounded-xl bg-default-100 mb-4">
                    {MAIN_TABS.map(({ key, label }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            className={`
                                flex-1 py-2 rounded-lg text-sm font-medium text-center
                                transition-all duration-200 cursor-pointer
                                ${tab === key
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-foreground/40 hover:text-foreground/60"
                                }
                            `}
                        >
                            {label}
                        </button>
                    ))}

                    {/* ── "More" dropdown for TDM / WoW ── */}
                    {moreItems.length > 0 && (
                        <Popover
                            isOpen={moreOpen}
                            onOpenChange={setMoreOpen}
                            placement="bottom"
                        >
                            <PopoverTrigger>
                                <button
                                    type="button"
                                    className={`
                                        flex-1 py-2 rounded-lg text-sm font-medium text-center
                                        transition-all duration-200 cursor-pointer
                                        flex items-center justify-center gap-1
                                        ${isMoreTab
                                            ? "bg-background shadow-sm text-foreground"
                                            : "text-foreground/40 hover:text-foreground/60"
                                        }
                                    `}
                                >
                                    {isMoreTab
                                        ? moreItems.find((m) => m.key === tab)?.label ?? "More"
                                        : "More"}
                                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="p-1 min-w-[120px]">
                                <div className="flex flex-col">
                                    {moreItems.map(({ key, label }) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => {
                                                setTab(key);
                                                setMoreOpen(false);
                                            }}
                                            className={`
                                                px-3 py-2 rounded-lg text-sm text-left
                                                transition-colors cursor-pointer
                                                ${tab === key
                                                    ? "bg-primary/10 text-primary font-semibold"
                                                    : "text-foreground/70 hover:bg-default-100"
                                                }
                                            `}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                </div>
            )}

            <div className="space-y-3">
                {isLoading &&
                    [1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-24 w-full rounded-xl" />
                    ))}

                {!isLoading && filteredRules.length === 0 && (
                    <Card className="border border-divider">
                        <CardBody className="flex flex-col items-center gap-3 py-12">
                            <BookOpen className="h-10 w-10 text-foreground/15" />
                            <p className="text-sm text-foreground/40">
                                No {tab} rules yet
                            </p>
                        </CardBody>
                    </Card>
                )}

                {filteredRules.map((rule, i) => {
                    const isExpanded = expandedRule === rule.id;
                    return (
                        <motion.div
                            key={rule.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                        >
                            <Card
                                isPressable
                                fullWidth
                                onPress={() =>
                                    setExpandedRule(isExpanded ? null : rule.id)
                                }
                                className="border border-divider"
                            >
                                <CardHeader className="justify-between gap-2 pb-0">
                                    <div className="flex items-center gap-2.5">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                                            {i + 1}
                                        </span>
                                        <h2 className="text-sm font-semibold">
                                            {rule.title}
                                        </h2>
                                    </div>
                                    <ChevronDown
                                        className={`h-4 w-4 shrink-0 text-foreground/30 transition-transform ${isExpanded ? "rotate-180" : ""
                                            }`}
                                    />
                                </CardHeader>
                                <CardBody className="pt-2">
                                    <div
                                        className={`whitespace-pre-wrap text-sm leading-relaxed text-foreground/70 ${isExpanded ? "" : "line-clamp-2"
                                            }`}
                                    >
                                        {rule.content}
                                    </div>
                                </CardBody>
                            </Card>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
