"use client";

import { useQuery } from "@tanstack/react-query";
import { getWorkLogs } from "@/lib/api/work-logs";
import { WorkLog } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Euro, Users, Calendar, Clock } from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from "recharts";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, eachWeekOfInterval } from "date-fns";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

interface CompanyDashboardProps {
    companyId: string;
    companyName: string;
}

export function CompanyDashboard({ companyId, companyName }: CompanyDashboardProps) {
    const { data: workLogs = [], isLoading } = useQuery({
        queryFn: () => getWorkLogs({ companyId, limit: 10000 }),
        queryKey: ["workLogs", companyId],
    });

    if (isLoading) {
        return <div className="p-8">Loading company data...</div>;
    }

    // Calculate Stats
    // Monthly Cost Filter (Current Month)
    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    // Helper: Calculate Real Company Cost (Gross)
    const calculateLogCost = (log: WorkLog) => {
        return Number(log.grossAmount) || 0;
    };

    const monthlyLogs = workLogs.filter((log: WorkLog) => {
        if (!log.startDate) return false;
        const logDate = parseISO(log.startDate);
        return logDate >= monthStart && logDate <= monthEnd;
    });

    const monthlyCost = monthlyLogs.reduce((sum: number, log: WorkLog) => {
        return sum + calculateLogCost(log);
    }, 0);

    const totalHours = workLogs.reduce((sum: number, log: WorkLog) => {
        return sum + (log.type === 'particular' ? (Number(log.duration) || 0) : 0);
    }, 0);

    const activeMembers = new Set(workLogs.map((log: WorkLog) => log.userId)).size;

    // Chart Data (Weekly Cost aggregation)
    const weeklyStats: Record<string, number> = {};
    const logDates: Date[] = [];

    workLogs.forEach((log: WorkLog) => {
        if (!log.startDate) return;
        const logDate = parseISO(log.startDate);
        logDates.push(logDate);

        // Key by Start of Week (Monday)
        const weekKey = format(startOfWeek(logDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        weeklyStats[weekKey] = (weeklyStats[weekKey] || 0) + calculateLogCost(log);
    });

    let chartData: { date: string; amount: number }[] = [];
    if (logDates.length > 0) {
        const minDate = new Date(Math.min(...logDates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...logDates.map(d => d.getTime())));

        // Generate all weeks in interval
        const weeks = eachWeekOfInterval({
            start: minDate,
            end: maxDate
        }, { weekStartsOn: 1 });

        chartData = weeks.map(weekDate => {
            const weekKey = format(weekDate, 'yyyy-MM-dd');
            return {
                date: weekKey,
                amount: weeklyStats[weekKey] || 0
            };
        });
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{companyName} Dashboard</h1>
                <p className="text-muted-foreground">Detailed overview and statistics.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Monthly Cost (Est)</CardTitle>
                        <Euro className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{monthlyCost.toFixed(2)} €</div>
                        <p className="text-xs text-muted-foreground">
                            {format(monthStart, "d MMM")} - {format(monthEnd, "d MMM")}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalHours.toFixed(1)} h</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Members</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeMembers}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Recent Logs</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{workLogs.length}</div>
                        <p className="text-xs text-muted-foreground">Total entries</p>
                    </CardContent>
                </Card>
            </div>

            {/* Chart */}
            <Card className="col-span-4">
                <CardHeader>
                    <CardTitle>Weekly Cost Trend</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(val) => format(parseISO(val), 'd MMM')}
                                    tickLine={false}
                                    axisLine={false}
                                    minTickGap={30}
                                />
                                <YAxis
                                    tickFormatter={(value) => `${value}€`}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    formatter={(value: number) => [`${value.toFixed(2)} €`, 'Cost']}
                                    labelFormatter={(label) => `Week of ${format(parseISO(label), 'PPP')}`}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="var(--primary)"
                                    fillOpacity={1}
                                    fill="url(#colorAmount)"
                                    strokeWidth={3}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Recent Activity Table */}
            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {workLogs.slice(0, 5).map((log: any) => ( // Show last 5
                            <TableRow key={log.id}>
                                <TableCell>{log.startDate ? format(parseISO(log.startDate), 'dd/MM/yyyy') : '-'}</TableCell>
                                <TableCell>{log.user?.firstName} {log.user?.lastName}</TableCell>
                                <TableCell className="capitalize">{log.type}</TableCell>
                                <TableCell>{log.duration}{log.type === 'particular' ? 'h' : 'd'}</TableCell>
                                <TableCell className="text-right font-medium">{Number(log.grossAmount).toFixed(2)} €</TableCell>
                            </TableRow>
                        ))}
                        {workLogs.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    No recent activity.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
