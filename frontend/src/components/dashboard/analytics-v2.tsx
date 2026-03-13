"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { WorkLog } from "@/lib/types";
import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-table";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, eachDayOfInterval, eachWeekOfInterval, isSameDay, endOfWeek, startOfWeek } from "date-fns";
import { formatCurrency } from "@/lib/utils";

interface AnalyticsV3Props {
    workLogs: WorkLog[];
    selectedDate: Date;
}

export function AnalyticsV2({ workLogs, selectedDate }: AnalyticsV3Props) {

    // 1. Monthly Income Data (Table Side)
    const monthlyData = useMemo(() => {
        const end = selectedDate;
        const start = subMonths(end, 5); // Last 6 months inclusive (0-5)
        const months = eachMonthOfInterval({ start, end });

        return months.map(month => {
            const monthStart = startOfMonth(month);
            const monthEnd = endOfMonth(month);

            const income = workLogs
                .filter(log => {
                    const d = new Date(log.date || log.startDate || log.created_at);
                    return d >= monthStart && d <= monthEnd;
                })
                .reduce((acc, log) => acc + (Number(log.amount) || 0), 0);

            return {
                name: format(month, 'MMMM yyyy'),
                shortName: format(month, 'MMM'),
                income
            };
        }).reverse(); // Most recent first for table
    }, [workLogs, selectedDate]);

    // 2. Weekly Income (Last 5 Months)
    const weeklyData = useMemo(() => {
        const now = selectedDate;
        const start = subMonths(now, 5); // Last 5 months
        // Align start to start of week to avoid partial first week weirdness?
        // Or just take the raw interval.
        const intervalStart = startOfWeek(start, { weekStartsOn: 1 });
        const end = endOfWeek(now, { weekStartsOn: 1 });

        const weeks = eachWeekOfInterval({ start: intervalStart, end }, { weekStartsOn: 1 });

        return weeks.map((weekStart) => {
            const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

            const income = workLogs
                .filter(log => {
                    const d = new Date(log.date || log.startDate || log.created_at);
                    return d >= weekStart && d <= weekEnd;
                })
                .reduce((acc, log) => acc + (Number(log.amount) || 0), 0);

            // Format label logic
            // If it's the first week of a month, or every 4th week, show Month name?
            // Recharts XAxis tick formatter is better for this. We just pass enough info.
            return {
                name: format(weekStart, 'MMM d'), // "Dec 4"
                fullName: `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`,
                income,
                month: format(weekStart, 'MMM')
            };
        });
    }, [workLogs, selectedDate]);


    // 3. Daily Hours (Current Month)
    const dailyHoursData = useMemo(() => {
        const now = selectedDate;
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        const days = eachDayOfInterval({ start, end });

        return days.map(day => {
            const dayHours = workLogs
                .filter(log => {
                    if (log.type === 'particular') {
                        // For particular: check if log.date matches this day
                        const d = new Date(log.date || log.created_at);
                        return isSameDay(d, day);
                    } else if (log.type === 'tutorial') {
                        // For tutorial: check if this day falls within startDate-endDate range
                        if (!log.startDate || !log.endDate) return false;
                        const tutorialStart = new Date(log.startDate);
                        const tutorialEnd = new Date(log.endDate);
                        // Set to start of day for accurate comparison
                        tutorialStart.setHours(0, 0, 0, 0);
                        tutorialEnd.setHours(23, 59, 59, 999);
                        const dayTime = new Date(day);
                        dayTime.setHours(12, 0, 0, 0); // Noon to avoid timezone issues
                        return dayTime >= tutorialStart && dayTime <= tutorialEnd;
                    }
                    return false;
                })
                .reduce((acc, log) => {
                    if (log.type === 'particular') return acc + (Number(log.durationHours) || 0);
                    if (log.type === 'tutorial') return acc + 6; // Fixed 6h for tutorial
                    return acc;
                }, 0);

            return {
                day: format(day, 'dd'),
                fullDate: format(day, 'MMM dd'),
                hours: dayHours
            };
        });
    }, [workLogs, selectedDate]);


    return (
        <div className="space-y-6">

            {/* Combined View: Weekly Chart + Monthly Table */}
            <Card className="shadow-sm border-none bg-slate-50/50">
                <CardHeader>
                    <CardTitle>Income Overview</CardTitle>
                    <CardDescription>Weekly progression over the last 5 months vs Monthly Totals</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Weekly Chart (70%) */}
                        <div className="w-full lg:flex-1 h-[250px] min-w-0">
                            <h4 className="text-sm font-semibold mb-4 text-muted-foreground">Weekly Revenue Trend</h4>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                    <defs>
                                        <linearGradient id="colorIncomeLong" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="name"
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        interval={3} // Show fewer ticks to avoid crowding
                                    />
                                    <YAxis
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(v) => `€${v}`}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: number) => [formatCurrency(value), "Income"]}
                                        labelFormatter={(label, payload) => {
                                            if (payload && payload.length > 0) return payload[0].payload.fullName;
                                            return label;
                                        }}
                                    />
                                    <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={3} fill="url(#colorIncomeLong)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Monthly Separation Line (Mobile: Horizontal, Desktop: Vertical) */}
                        <div className="w-full h-px lg:w-px lg:h-auto bg-slate-200" />

                        {/* Monthly Table (30%) */}
                        <div className="lg:w-[300px]">
                            <h4 className="text-sm font-semibold mb-4 text-muted-foreground">Monthly Totals</h4>
                            <div className="border rounded-md bg-white overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead>Month</TableHead>
                                            <TableHead className="text-right">Income</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {monthlyData.map((data) => (
                                            <TableRow key={data.name}>
                                                <TableCell className="font-medium text-xs">{data.name}</TableCell>
                                                <TableCell className="text-right font-bold text-slate-700 text-xs">
                                                    {formatCurrency(data.income)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Daily Hours (Bottom) */}
            <Card className="shadow-sm border-none bg-slate-50/50">
                <CardHeader>
                    <CardTitle>Daily Effort</CardTitle>
                    <CardDescription>Hours worked per day ({format(selectedDate, 'MMMM')} - Tutorial = 6h)</CardDescription>
                </CardHeader>
                <CardContent className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dailyHoursData}>
                            <defs>
                                <linearGradient id="colorHoursDaily" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="day"
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                                formatter={(value: number) => [`${value}h`, "Hours"]}
                                labelFormatter={(label) => `Day ${label}`}
                            />
                            <Area
                                type="monotone"
                                dataKey="hours"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorHoursDaily)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
