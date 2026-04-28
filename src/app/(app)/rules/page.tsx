"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardBody, CardHeader, Skeleton } from "@heroui/react";
import { BookOpen, ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

interface Rule {
    id: string;
    title: string;
    content: string;
    category: string; // CASUAL, RANKED, or BOTH
    order: number;
    createdAt: string;
    updatedAt: string;
}

export default function RulesPage() {
    const [expandedRule, setExpandedRule] = useState<string | null>(null);
    const [tab, setTab] = useState<"ranked" | "casual" | "general">("general");

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
        return cat === "CASUAL";
    });

    // Count for badges
    const rankedCount = rules.filter((r) => (r.category || "BOTH") === "RANKED").length;
    const casualCount = rules.filter((r) => (r.category || "BOTH") === "CASUAL").length;
    const generalCount = rules.filter((r) => (r.category || "BOTH") === "BOTH").length;
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

            {/* ── Casual / Ranked / General Tabs ── */}
            {showTabs && (
                <div className="flex items-center justify-center gap-1 p-1 rounded-xl bg-default-100 mb-4">
                    {([
                        { key: "casual" as const, label: "Casual", icon: "🎮", count: casualCount },
                        { key: "ranked" as const, label: "Ranked", icon: "🏆", count: rankedCount },
                        { key: "general" as const, label: "General", icon: "📋", count: generalCount },
                    ]).map(({ key, label, icon, count }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            className={`
                                flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium
                                transition-all duration-200 cursor-pointer
                                ${tab === key
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-foreground/50 hover:text-foreground/70"
                                }
                            `}
                        >
                            <span>{icon}</span>
                            <span>{label}</span>
                            {count > 0 && (
                                <span className={`
                                    text-[10px] font-bold px-1.5 py-0.5 rounded-full
                                    ${tab === key ? "bg-primary/10 text-primary" : "bg-foreground/10 text-foreground/40"}
                                `}>
                                    {count}
                                </span>
                            )}
                        </button>
                    ))}
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
