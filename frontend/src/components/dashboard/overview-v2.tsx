"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Banknote, Clock, ArrowUpRight, ArrowDownRight, CalendarDays, Calculator, Sparkles, Moon, User as UserIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { WorkLog, Company } from "@/lib/types";
import { useMemo, useState } from "react";
import { format, isSameDay, getDaysInMonth, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, addMonths, eachMonthOfInterval, parseISO } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-table";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis } from 'recharts';

interface OverviewV3Props {
    workLogs: WorkLog[];
    companies: Company[];
    activeCompanyId?: string | null;
    onAddRecord: () => void;
    onNavigate: (tab: string) => void;
    selectedDate: Date;
    onViewLog?: (log: WorkLog) => void;
}

export function OverviewV3({ workLogs, companies, activeCompanyId, onAddRecord, onNavigate, selectedDate, onViewLog }: OverviewV3Props) {
    const currentMonthName = format(new Date(), 'MMMM');

    const stats = useMemo(() => {
        const currentMonth = selectedDate.getMonth();
        const currentYear = selectedDate.getFullYear();

        // Calculate previous month relative to selected date
        const prevDate = subMonths(selectedDate, 1);
        const lastMonth = prevDate.getMonth();
        const lastMonthYear = prevDate.getFullYear();

        // Filter logs
        const currentMonthLogs = workLogs.filter(log => {
            const d = parseISO(log.startDate || log.createdAt);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const lastMonthLogs = workLogs.filter(log => {
            const d = parseISO(log.startDate || log.createdAt);
            return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
        });
        
        console.log("Registros del mes actual:", currentMonthLogs);
        const income = currentMonthLogs.reduce((acc, log) => acc + (Number(log.netAmount || log.grossAmount) || 0), 0);
        const lastIncome = lastMonthLogs.reduce((acc, log) => acc + (Number(log.netAmount || log.grossAmount) || 0), 0);

        // Detailed Calc
        let particularHours = 0;
        let tutorialHours = 0;

        // Day Classification for Pie Chart
        const start = startOfMonth(selectedDate);
        const end = endOfMonth(selectedDate);
        const daysInMonth = eachDayOfInterval({ start, end });

        const tutorialDates = new Set<string>();
        const particularDates = new Set<string>();

        // Pre-process logs to populate date sets
        currentMonthLogs.forEach(log => {
            const logDate = log.date || log.startDate;

            if (log.type === 'tutorial' && log.startDate && log.endDate) {
                try {
                    const range = eachDayOfInterval({
                        start: parseISO(log.startDate),
                        end: parseISO(log.endDate)
                    });
                    range.forEach(d => tutorialDates.add(format(d, 'yyyy-MM-dd')));
                } catch (e) {
                    // Fallback for bad dates
                }
            } else if (log.type === 'particular' && logDate) {
                particularDates.add(format(parseISO(logDate), 'yyyy-MM-dd'));
            }
        });

        let tutorialDaysCount = 0;
        let particularDaysCount = 0;
        let freeDaysCount = 0;

        daysInMonth.forEach(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            if (tutorialDates.has(dayStr)) {
                tutorialDaysCount++;
            } else if (particularDates.has(dayStr)) {
                particularDaysCount++;
            } else {
                freeDaysCount++;
            }
        });

        // Sum Hours
        currentMonthLogs.forEach(log => {
            if (log.type === 'particular') {
                particularHours += (Number(log.durationHours) || 0);
            } else if (log.type === 'tutorial') {
                // Tutorial hours calc: 6 * days.
                const days = (log.startDate && log.endDate && log.startDate !== log.endDate) ?
                    Math.ceil((new Date(log.endDate).getTime() - new Date(log.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
                    : 1;
                tutorialHours += (days * 6);
            }
        });

        const totalHours = particularHours + tutorialHours;
        const percentChange = lastIncome > 0 ? ((income - lastIncome) / lastIncome) * 100 : 100;

        // Check if ANY company allows tutorials
        const showTutorials = companies.length === 0 || companies.some(c => c.settings?.features?.tutorials !== false);

        const pieData = [
            { name: 'Tutorials', value: tutorialDaysCount, color: '#3b82f6', show: showTutorials }, // Main Blue
            { name: 'Particulars', value: particularDaysCount, color: '#93c5fd', show: true }, // Light Blue
            { name: 'Off Days', value: freeDaysCount, color: '#e2e8f0', show: true } // Gray
        ].filter(d => d.show && d.value > 0);

        return {
            income,
            lastIncome,
            percentChange,
            particularHours,
            tutorialHours,
            totalHours,
            pieData,
            totalDaysInMonth: daysInMonth.length,
            showTutorials
        };
    }, [workLogs, companies, selectedDate]);

    // SaaS Dynamic Columns Logic
    const activeCompany = useMemo(() => {
        if (!activeCompanyId) return null;
        return companies.find(c => c.id === activeCompanyId);
    }, [companies, activeCompanyId]);

    const dynamicFields = useMemo(() => {
        if (!activeCompany?.worklogDefinitions) return [];
        const fields = new Set<string>();
        Object.values(activeCompany.worklogDefinitions).forEach((def: any) => {
            if (def.fields && Array.isArray(def.fields)) {
                def.fields.forEach((f: string) => fields.add(f));
            }
        });
        // We exclude 'description' as it's usually standard or handled separately
        return Array.from(fields).filter((f: string) => f !== 'description');
    }, [activeCompany]);

    // 3. Chart Data (Aligned with Analytics: Last 6 Months)
    const chartData = useMemo(() => {
        const end = selectedDate;
        const start = subMonths(end, 5); // Last 6 months inclusive
        const months = eachMonthOfInterval({ start, end });

        return months.map(month => {
            const monthStart = startOfMonth(month);
            const monthEnd = endOfMonth(month);

            const income = workLogs
                .filter(log => {
                    const d = parseISO(log.startDate || log.createdAt);
                    return d >= monthStart && d <= monthEnd;
                })
                .reduce((acc, log) => acc + (Number(log.netAmount || log.grossAmount) || 0), 0);

            return {
                name: format(month, 'MMM'), // Short Name for XAxis
                fullDate: format(month, 'MMMM yyyy'),
                total: income
            };
        });
    }, [workLogs, selectedDate]);

    const recentLogs = [...workLogs].sort((a, b) => {
        const dateA = parseISO(a.startDate || a.createdAt);
        const dateB = parseISO(b.startDate || b.createdAt);
        return dateB.getTime() - dateA.getTime();
    }).slice(0, 5);

    return (
        <div className="space-y-6">
            {/* Top Stats Row (4 Columns) */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* 1. Monthly Revenue Stats */}
                <Card className="bg-gradient-to-br from-white to-slate-50 border-l-4 border-l-slate-900 shadow-sm flex flex-col justify-center">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Revenue</CardTitle>
                            <Banknote className="h-4 w-4 text-slate-700" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900 mb-1">{formatCurrency(stats.income)}</div>
                        <p className="text-xs text-muted-foreground flex items-center">
                            {stats.percentChange >= 0 ? (
                                <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
                            ) : (
                                <ArrowDownRight className="h-4 w-4 text-red-500 mr-1" />
                            )}
                            <span className={stats.percentChange >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                                {Math.abs(stats.percentChange).toFixed(1)}%
                            </span>
                            <span className="ml-1">from previous month</span>
                        </p>
                    </CardContent>
                </Card>

                {/* 2. Days Worked */}
                <Card className="shadow-sm flex flex-col justify-center">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Days Worked</CardTitle>
                            <CalendarDays className="h-4 w-4 text-blue-500" />
                        </div>
                        <CardDescription className="text-xs">({currentMonthName})</CardDescription>
                    </CardHeader>
                    <CardContent className="w-full px-2">
                        <div className="text-3xl font-bold mb-4 text-center">
                            {stats.pieData.reduce((acc, curr) => curr.name !== 'Off Days' ? acc + curr.value : acc, 0)}
                            <span className="text-lg font-normal text-muted-foreground">/{stats.totalDaysInMonth}</span>
                        </div>
                        <div className="w-full space-y-3">
                            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                                {stats.pieData.map((entry, index) => {
                                    const pct = (entry.value / stats.totalDaysInMonth) * 100;
                                    if (entry.value === 0) return null;
                                    return (
                                        <div
                                            key={entry.name}
                                            style={{ width: `${pct}%`, backgroundColor: entry.color }}
                                            className="h-full transition-all duration-500"
                                            title={`${entry.name}: ${entry.value} days`}
                                        />
                                    );
                                })}
                            </div>
                            {/* Days Legend */}
                            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                                {stats.pieData.map(entry => (
                                    <div key={entry.name} className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                        <span>{entry.name} ({entry.value})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Hours (Usage) */}
                <Card className="shadow-sm flex flex-col justify-center">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Hours Worked</CardTitle>
                            <Clock className="h-4 w-4 text-violet-500" />
                        </div>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center">
                        <div className="relative w-full h-[120px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Particular', value: stats.particularHours, color: '#3b82f6' },
                                            { name: 'Tutorials', value: stats.tutorialHours, color: '#8b5cf6' }
                                        ].filter(d => (d.name === 'Tutorials' ? stats.showTutorials : true) && d.value > 0)}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={35}
                                        outerRadius={50}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                        cornerRadius={4}
                                        animationDuration={800}
                                    >
                                        {[
                                            { name: 'Particular', value: stats.particularHours, color: '#3b82f6' },
                                            { name: 'Tutorials', value: stats.tutorialHours, color: '#8b5cf6' }
                                        ].filter(d => (d.name === 'Tutorials' ? stats.showTutorials : true) && d.value > 0).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: number) => [`${value.toFixed(1)}h`, 'Hours']}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                        itemStyle={{ padding: 0, fontWeight: 'bold' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-xl font-bold text-slate-900">{stats.totalHours.toFixed(0)}h</span>
                            </div>
                        </div>
                        {/* Hours Legend */}
                        <div className="flex gap-4 mt-1 text-[10px] justify-center text-muted-foreground">
                            <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                <span>Part: {stats.particularHours.toFixed(0)}h</span>
                            </div>
                            {stats.showTutorials && (
                                <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                                    <span>Tut: {stats.tutorialHours.toFixed(0)}h</span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Revenue Trend Chart */}
                <Card className="shadow-sm border-none bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Income Trend</CardTitle>
                        <CardDescription className="text-xs">Last 6 Months</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[100px] pt-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorOverviewRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#1e293b" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#1e293b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" hide />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                    itemStyle={{ padding: 0, fontWeight: 'bold', color: '#1e293b' }}
                                    formatter={(value: number) => [formatCurrency(value), "Income"]}
                                    labelFormatter={(label, payload) => {
                                        if (payload && payload.length > 0) {
                                            return payload[0].payload.fullDate;
                                        }
                                        return label;
                                    }}
                                    labelStyle={{ color: '#64748b', marginBottom: '0.25rem', fontSize: '10px' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="total"
                                    stroke="#1e293b"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorOverviewRevenue)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content: Recent Activity (Full Width) */}
            <div className="grid grid-cols-1">
                <Card className="shadow-sm flex flex-col h-full overflow-hidden">
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                        <CardDescription>Latest transactions</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="overflow-x-auto">
                            <Table className="min-w-full">
                                <TableHeader>
                                    <TableRow className="bg-slate-900 hover:bg-slate-900 border-none">
                                        <TableHead className="text-slate-50 rounded-tl-md whitespace-nowrap">Date</TableHead>
                                        <TableHead className="text-slate-50 min-w-[100px]">Type</TableHead>
                                        <TableHead className="text-slate-50 min-w-[120px]">Client</TableHead>
                                        {dynamicFields.map(field => (
                                            <TableHead key={field} className="text-slate-50 capitalize hidden lg:table-cell">{field}</TableHead>
                                        ))}
                                        <TableHead className="text-slate-50 hidden md:table-cell">Flags</TableHead>
                                        <TableHead className="text-slate-50 rounded-tr-md">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentLogs.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5 + dynamicFields.length} className="text-center py-4 text-muted-foreground">
                                                No recent activity.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        recentLogs.map((log: any) => (
                                            <TableRow
                                                key={log.id}
                                                onClick={() => onViewLog?.(log)}
                                                className="cursor-pointer transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 even:bg-slate-100 dark:even:bg-slate-800"
                                            >
                                                <TableCell className="py-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium whitespace-nowrap">
                                                            {log.type === 'tutorial' && log.startDate && log.endDate
                                                                ? `${format(parseISO(log.startDate), "dd/MM/yyyy")} - ${format(parseISO(log.endDate), "dd/MM/yyyy")}`
                                                                : log.startDate
                                                                    ? format(parseISO(log.startDate), "dd/MM/yyyy")
                                                                    : "-"}
                                                        </span>
                                                        {log.type === 'particular' && log.startTime && log.endTime && (
                                                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                                {log.startTime} - {log.endTime}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="capitalize py-2">{log.type}</TableCell>
                                                <TableCell className="py-2">
                                                    <div className="flex items-center gap-2 max-w-[150px] md:max-w-[200px] truncate" title={log.client || ''}>
                                                        {log.client && <UserIcon className="h-3 w-3 text-muted-foreground shrink-0" />}
                                                        <span className="truncate block">{log.client || '-'}</span>
                                                    </div>
                                                </TableCell>
                                                {dynamicFields.map(field => (
                                                    <TableCell key={field} className="py-2 hidden lg:table-cell truncate max-w-[100px]" title={log.extraData?.datos?.[field] || '-'}>
                                                        {log.extraData?.datos?.[field] || '-'}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="py-2 hidden md:table-cell">
                                                    <div className="flex gap-1">
                                                        {log.hasCoordination && (
                                                            <div className="p-1 bg-blue-100 text-blue-700 rounded" title="Coordination supplement applied">
                                                                <Sparkles className="h-3 w-3" />
                                                            </div>
                                                        )}
                                                        {log.hasNight && (
                                                            <div className="p-1 bg-indigo-100 text-indigo-700 rounded" title="Night supplement applied">
                                                                <Moon className="h-3 w-3" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-2 font-medium">{(log.netAmount || log.grossAmount) ? `€${Number(log.netAmount || log.grossAmount).toFixed(2)}` : '-'}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
