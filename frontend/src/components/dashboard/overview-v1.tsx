"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkLog } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface OverviewV1Props {
    workLogs: WorkLog[];
}

export function OverviewV1({ workLogs }: OverviewV1Props) {
    const totalIncome = workLogs.reduce((acc, log) => acc + (Number(log.amount) || 0), 0);
    const totalHours = workLogs.reduce((acc, log) => acc + (Number(log.durationHours) || 0), 0);

    // Sort by date desc
    const recentLogs = [...workLogs].sort((a, b) => {
        const dateA = new Date(a.date || a.startDate || a.createdAt);
        const dateB = new Date(b.date || b.startDate || b.createdAt);
        return dateB.getTime() - dateA.getTime();
    }).slice(0, 10);

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalIncome)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalHours.toFixed(2)}h</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity (Legacy View)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {recentLogs.map((log) => (
                            <div key={log.id} className="flex items-center justify-between border-b pb-2">
                                <div>
                                    <p className="text-sm font-medium">{log.description}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline">{log.type}</Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {log.date ? format(new Date(log.date), 'dd/MM/yyyy') : 'Range'}
                                        </span>
                                    </div>
                                </div>
                                <div className="font-bold">
                                    {formatCurrency(Number(log.amount) || 0)}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
