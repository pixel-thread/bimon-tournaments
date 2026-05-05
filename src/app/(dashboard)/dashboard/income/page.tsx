"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
    Card,
    CardBody,
    CardHeader,
    Select,
    SelectItem,
    Skeleton,
    Input,
    Button,
    Chip,
} from "@heroui/react";
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    Plus,
    Trash2,
    Receipt,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

interface Income {
    id: string;
    amount: number;
    description: string;
    tournamentName: string | null;
    isSubIncome: boolean;
    createdAt: string;
    children: { id: string; amount: number; description: string }[];
}

interface Expense {
    id: string;
    amount: number;
    description: string;
    createdAt: string;
}

interface Deduction {
    category: string;
    total: number;
    count: number;
}

interface IncomeData {
    records: Income[];
    expenses: Expense[];
    summary: {
        totalOrgIncome: number;
        rpIncome: number;
        rpPurchaseCount: number;
        nameChangeIncome: number;
        nameChangeCount: number;
        totalDeductions: number;
        totalExpenses: number;
        netProfit: number;
        deductions: Deduction[];
    };
}

interface Season {
    id: string;
    name: string;
}


export default function IncomePage() {
    const queryClient = useQueryClient();
    const [selectedSeason, setSelectedSeason] = useState<string>("all");
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [expenseAmount, setExpenseAmount] = useState("");
    const [expenseDesc, setExpenseDesc] = useState("");

    // Fetch seasons
    const { data: seasons } = useQuery<Season[]>({
        queryKey: ["seasons"],
        queryFn: async () => {
            const res = await fetch("/api/seasons");
            if (!res.ok) throw new Error("Failed");
            const json = await res.json();
            return json.data;
        },
    });

    // Set default to "all"
    useEffect(() => {
        if (seasons && seasons.length > 0 && !selectedSeason) {
            setSelectedSeason("all");
        }
    }, [seasons, selectedSeason]);

    // Fetch income data
    const { data, isLoading, error } = useQuery<IncomeData>({
        queryKey: ["income", selectedSeason],
        queryFn: async () => {
            const res = await fetch(`/api/income?seasonId=${selectedSeason}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            return json.data;
        },
        enabled: !!selectedSeason,
        staleTime: 60 * 1000,
    });

    // Add expense mutation
    const addExpense = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/income", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: parseInt(expenseAmount),
                    description: expenseDesc.trim(),
                }),
            });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["income"] });
            setExpenseAmount("");
            setExpenseDesc("");
            setShowExpenseForm(false);
            toast.success("Expense added");
        },
        onError: () => toast.error("Failed to add expense"),
    });

    // Delete expense mutation
    const deleteExpense = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/income?id=${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["income"] });
            toast.success("Expense removed");
        },
        onError: () => toast.error("Failed to delete expense"),
    });

    // Build season options — prepend "All Seasons"
    const seasonOptions = [
        { id: "all", name: "All Seasons" },
        ...(seasons ?? []),
    ];

    return (
        <div className="space-y-4 p-4">
            {/* Header + Season Selector */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg font-bold">Income Tracking</h1>
                    <p className="text-xs text-foreground/40">
                        {selectedSeason === "all" ? "Revenue & expenses across all seasons" : "Revenue & expenses per season"}
                    </p>
                </div>
                {seasonOptions.length > 0 && (
                    <Select
                        size="sm"
                        selectedKeys={selectedSeason ? [selectedSeason] : []}
                        onSelectionChange={(keys) => {
                            const val = Array.from(keys)[0] as string;
                            if (val) setSelectedSeason(val);
                        }}
                        className="w-44"
                        aria-label="Select season"
                    >
                        {seasonOptions.map((s) => (
                            <SelectItem key={s.id}>{s.name}</SelectItem>
                        ))}
                    </Select>
                )}
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-lg bg-danger-50 p-4 text-sm text-danger dark:bg-danger-50/10">
                    <AlertCircle className="h-4 w-4" />
                    Failed to load income data.
                </div>
            )}

            {isLoading ? (
                <div className="space-y-4">
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-48 w-full rounded-xl" />
                </div>
            ) : data ? (
                <>
                    {/* Net Profit/Loss */}
                    <motion.div
                        key={`profit-${selectedSeason}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <Card className="overflow-hidden border border-divider">
                            <CardBody className="items-center gap-1 py-6">
                                {data.summary.netProfit >= 0 ? (
                                    <TrendingUp className="h-6 w-6 text-success" />
                                ) : (
                                    <TrendingDown className="h-6 w-6 text-danger" />
                                )}
                                <span className="text-xs font-medium uppercase tracking-wider text-foreground/50">
                                    {data.summary.netProfit >= 0 ? "Org Profit" : "Org Loss"}
                                </span>
                                <p className={`text-3xl font-bold ${data.summary.netProfit >= 0 ? "text-success" : "text-danger"}`}>
                                    {data.summary.netProfit >= 0 ? "+" : "-"}₹{Math.abs(data.summary.netProfit).toLocaleString()}
                                </p>
                            </CardBody>
                        </Card>
                    </motion.div>

                    {/* Formula Breakdown */}
                    <motion.div
                        key={`breakdown-${selectedSeason}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                    >
                        <Card className="border border-divider">
                            <CardHeader className="pb-2">
                                <h2 className="text-sm font-bold">Breakdown</h2>
                            </CardHeader>
                            <CardBody className="pt-0">
                                <div className="space-y-1.5 text-sm font-mono">
                                    <div className="flex justify-between">
                                        <span className="text-foreground/50">Org Income</span>
                                        <span className="text-success">+₹{data.summary.totalOrgIncome.toLocaleString()}</span>
                                    </div>
                                    {data.summary.rpIncome > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-foreground/50">RP Purchases <span className="text-foreground/30">({data.summary.rpPurchaseCount})</span></span>
                                            <span className="text-success">+₹{data.summary.rpIncome.toLocaleString()}</span>
                                        </div>
                                    )}
                                    {data.summary.nameChangeIncome > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-foreground/50">Name Changes <span className="text-foreground/30">({data.summary.nameChangeCount})</span></span>
                                            <span className="text-success">+₹{data.summary.nameChangeIncome.toLocaleString()}</span>
                                        </div>
                                    )}
                                    {data.summary.deductions.map((d) => (
                                        <div key={d.category} className="flex justify-between">
                                            <span className="text-foreground/50">{d.category} <span className="text-foreground/30">({d.count})</span></span>
                                            <span className="text-danger">-₹{d.total.toLocaleString()}</span>
                                        </div>
                                    ))}
                                    {data.summary.totalExpenses > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-foreground/50">Manual Expenses <span className="text-foreground/30">({data.expenses.length})</span></span>
                                            <span className="text-danger">-₹{data.summary.totalExpenses.toLocaleString()}</span>
                                        </div>
                                    )}
                                    <div className="border-t border-divider pt-1.5 flex justify-between font-bold">
                                        <span className="text-foreground/70">Net</span>
                                        <span className={data.summary.netProfit >= 0 ? "text-success" : "text-danger"}>
                                            {data.summary.netProfit >= 0 ? "+" : "-"}₹{Math.abs(data.summary.netProfit).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </motion.div>

                    {/* Expenses Section */}
                    <motion.div
                        key={`expenses-${selectedSeason}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08 }}
                    >
                        <Card className="border border-divider">
                            <CardHeader className="pb-2 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <Receipt className="h-4 w-4 text-foreground/50" />
                                    <h2 className="text-sm font-bold">Manual Expenses</h2>
                                </div>
                                <Button
                                    size="sm"
                                    variant="flat"
                                    color="danger"
                                    startContent={<Plus className="h-3 w-3" />}
                                    onPress={() => setShowExpenseForm(!showExpenseForm)}
                                >
                                    Add
                                </Button>
                            </CardHeader>
                            <CardBody className="pt-0">
                                {/* Add Expense Form */}
                                <AnimatePresence>
                                    {showExpenseForm && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="flex flex-col gap-2 mb-3 p-3 rounded-lg bg-default-100/50 border border-divider">
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="number"
                                                        placeholder="Amount"
                                                        value={expenseAmount}
                                                        onValueChange={setExpenseAmount}
                                                        startContent={<span className="text-foreground/40">₹</span>}
                                                        className="w-36"
                                                        classNames={{ inputWrapper: "border border-divider" }}
                                                    />
                                                    <Input
                                                        placeholder="e.g. Room Card, UC Top-up"
                                                        value={expenseDesc}
                                                        onValueChange={setExpenseDesc}
                                                        className="flex-1"
                                                        classNames={{ inputWrapper: "border border-divider" }}
                                                    />
                                                </div>
                                                <Button
                                                    color="danger"
                                                    variant="flat"
                                                    isLoading={addExpense.isPending}
                                                    isDisabled={!expenseAmount || !expenseDesc.trim()}
                                                    onPress={() => addExpense.mutate()}
                                                    className="w-full"
                                                >
                                                    Add Expense
                                                </Button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Expense List */}
                                <div className="divide-y divide-divider/50">
                                    {(!data.expenses || data.expenses.length === 0) ? (
                                        <div className="flex flex-col items-center gap-2 py-8 text-center">
                                            <Receipt className="h-8 w-8 text-foreground/20" />
                                            <p className="text-xs text-foreground/40">No manual expenses recorded</p>
                                        </div>
                                    ) : (
                                        data.expenses.map((exp) => (
                                            <div
                                                key={exp.id}
                                                className="flex items-center justify-between py-2.5 group"
                                            >
                                                <div>
                                                    <p className="text-sm font-medium">{exp.description}</p>
                                                    <p className="text-xs text-foreground/30">
                                                        {new Date(exp.createdAt).toLocaleDateString("en-US", {
                                                            month: "short",
                                                            day: "numeric",
                                                            year: "numeric",
                                                        })}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-danger">
                                                        -₹{exp.amount.toLocaleString()}
                                                    </span>
                                                    <Button
                                                        size="sm"
                                                        isIconOnly
                                                        variant="light"
                                                        color="danger"
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 min-w-6"
                                                        onPress={() => deleteExpense.mutate(exp.id)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardBody>
                        </Card>
                    </motion.div>

                    {/* Income Records */}
                    <motion.div
                        key={`records-${selectedSeason}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <Card className="border border-divider">
                            <CardHeader className="pb-2">
                                <h2 className="text-sm font-bold">Income Records</h2>
                                <span className="ml-auto text-xs text-foreground/40">
                                    {data.records.length} entries · ₹{data.records.reduce((s, r) => s + r.amount, 0).toLocaleString()} total
                                </span>
                            </CardHeader>
                            <CardBody className="p-0">
                                <div className="divide-y divide-divider/50">
                                    {data.records.length === 0 ? (
                                        <div className="flex flex-col items-center gap-3 py-12 text-center">
                                            <DollarSign className="h-10 w-10 text-foreground/20" />
                                            <p className="text-sm text-foreground/50">
                                                No income records {selectedSeason === "all" ? "" : "for this season"}
                                            </p>
                                        </div>
                                    ) : (
                                        data.records.map((income) => (
                                            <div
                                                key={income.id}
                                                className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-default-100/50"
                                            >
                                                <div>
                                                    <p className="text-sm font-medium">
                                                        {income.description}
                                                    </p>
                                                    {income.tournamentName && (
                                                        <p className="text-xs text-foreground/40">
                                                            {income.tournamentName}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-foreground/30">
                                                        {new Date(income.createdAt).toLocaleDateString("en-US", {
                                                            month: "short",
                                                            day: "numeric",
                                                            year: "numeric",
                                                        })}
                                                    </p>
                                                </div>
                                                <span className="text-lg font-bold text-success">
                                                    ₹{income.amount.toLocaleString()}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardBody>
                        </Card>
                    </motion.div>
                </>
            ) : null}
        </div>
    );
}
