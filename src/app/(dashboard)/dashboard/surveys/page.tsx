"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardBody, Skeleton } from "@heroui/react";
import { BarChart3, MapPin, Clock, Smartphone, Users } from "lucide-react";
import axios from "axios";

interface ResultItem {
    name: string;
    count: number;
}

interface SurveyResults {
    totalResponses: number;
    maps: ResultItem[];
    timings: ResultItem[];
    devices: ResultItem[];
}

function BarChart({ items, color }: { items: ResultItem[]; color: string }) {
    const max = Math.max(...items.map((i) => i.count), 1);
    return (
        <div className="space-y-2">
            {items.map(({ name, count }) => (
                <div key={name} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-32 truncate text-right">{name}</span>
                    <div className="flex-1 h-7 bg-default-100 rounded-lg overflow-hidden relative">
                        <div
                            className={`h-full rounded-lg transition-all duration-500 ${color}`}
                            style={{ width: `${(count / max) * 100}%` }}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-foreground/60">
                            {count}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function SurveysPage() {
    const { data, isLoading } = useQuery<SurveyResults>({
        queryKey: ["survey-results"],
        queryFn: async () => {
            const res = await axios.get("/api/survey/results");
            return res.data.data;
        },
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                    <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-bold">Survey Results</h1>
                    <p className="text-sm text-foreground/50">Player preferences for maps, timing & devices</p>
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-40 w-full rounded-xl" />
                    ))}
                </div>
            ) : !data ? (
                <p className="text-sm text-foreground/40">No data available</p>
            ) : (
                <>
                    {/* Total responses */}
                    <Card className="border border-divider">
                        <CardBody className="flex-row items-center gap-3 py-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Users className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{data.totalResponses}</p>
                                <p className="text-xs text-foreground/40">Total Responses</p>
                            </div>
                        </CardBody>
                    </Card>

                    {/* Map preferences */}
                    <Card className="border border-divider">
                        <CardBody className="space-y-3">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-emerald-500" />
                                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/60">
                                    Map Preferences
                                </h2>
                            </div>
                            {data.maps.length > 0 ? (
                                <BarChart items={data.maps} color="bg-gradient-to-r from-emerald-500 to-teal-500" />
                            ) : (
                                <p className="text-sm text-foreground/30">No data yet</p>
                            )}
                        </CardBody>
                    </Card>

                    {/* Timing preferences */}
                    <Card className="border border-divider">
                        <CardBody className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-amber-500" />
                                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/60">
                                    Timing Preferences
                                </h2>
                            </div>
                            {data.timings.length > 0 ? (
                                <BarChart items={data.timings} color="bg-gradient-to-r from-amber-500 to-orange-500" />
                            ) : (
                                <p className="text-sm text-foreground/30">No data yet</p>
                            )}
                        </CardBody>
                    </Card>

                    {/* Device breakdown */}
                    <Card className="border border-divider">
                        <CardBody className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Smartphone className="w-4 h-4 text-blue-500" />
                                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/60">
                                    Device Breakdown
                                </h2>
                            </div>
                            {data.devices.length > 0 ? (
                                <BarChart items={data.devices} color="bg-gradient-to-r from-blue-500 to-indigo-500" />
                            ) : (
                                <p className="text-sm text-foreground/30">No data yet</p>
                            )}
                        </CardBody>
                    </Card>
                </>
            )}
        </div>
    );
}
