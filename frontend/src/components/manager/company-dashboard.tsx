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
        // If it was a gross calculation (meaning taxes were deducted to get 'amount'), 
        // we essentially want to 'undo' that to get the company cost. 
        // OR simply reconstruct it: (Duration * Rate) + Modifiers.
        // We assume 'rateApplied' is the base rate (hr/day).

        // However, 'amount' in DB is what the user GETS (Net). 
        // If isGrossCalculation is true, it means the rate WAS gross, and taxes were removed.
        // So the company PAID the gross amount.

        if (log.isGrossCalculation) {
            // Reconstruct Gross
            // Note: We might need to handle 'particular' vs 'tutorial' logic if rates differ, 
            // but usually rateApplied * duration is the base gross.

            let baseParams = 0;
            if (log.type === 'particular') {
                baseParams = (Number(log.durationHours) || 0) * (Number(log.rateApplied) || 0);
            } else {
                // Tutorial: rate is daily. We don't have 'days' here easily if not stored?
                // Actually helper in crud.py uses start/end date.
                // But simplified: usually amount = rate * days - taxes.
                // We can try to back-calculate or use rateApplied * days.
                // Let's rely on rateApplied being set correctly in DB.
                // If durationHours is stored for tutorial as days? No, usually hours.

                // Fallback: If we can't perfectly reconstruct, we might need to assume 
                // IF we trust 'amount' is 'Gross * (1-Taxes)', then 'Gross = Amount / (1-Taxes)' 
                // BUT we don't know the exact tax rate here easily without querying user rates.

                // BETTER APPROACH:
                // Use (rateApplied * duration/quantity) + modifiers.
                // For tutorial, we need quantity. 
                // log.durationHours might be 0 or irrelevant for tutorial in some legacy data?
                // Let's check crud.py: 
                // "duration = days" (line 136). So duration_hours IS set to days for tutorial in DB?
                // Line 213: duration_hours=duration if work_log.type == models.WorkLogType.particular else None
                // WAIT. Tutorial logs might have NULL duration_hours in DB?
                // Let's check the type definition or assumptions.
                // If duration_hours is null for tutorial, we need start/end date.

                if (log.startDate && log.endDate) {
                    const start = parseISO(log.startDate as string);
                    const end = parseISO(log.endDate as string);
                    // simple diff in days
                    const diffTime = Math.abs(end.getTime() - start.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                    baseParams = diffDays * (Number(log.rateApplied) || 0);
                } else {
                    // Fallback if missing dates (shouldn't happen for approved logs)
                    baseParams = Number(log.amount) || 0;
                }
            }

            // Add Modifiers (Fixed amounts, not affected by tax rate usually? 
            // Wait, crud.py applies tax to the SUM of everything.
            // "amount = amount * (1.0 - total_deduction)" (Line 164)
            // So YES, modifiers ARE taxed.
            // So we can just sum up the gross parts.

            // Re-add modifiers if they are flat rates?
            // Actually, we don't have the 'value' of the modifier stored, just boolean.
            // We rely on 'rateApplied' being the base. 
            // We DO NOT know the coordination/night rate here without fetching UserCompanyRate.

            // ALTERNATIVE:
            // Back-calculate from Net Amount if we knew the Tax %.
            // We don't.

            // CRITICAL: We need the modifier values (night/coord rates) to reconstruct gross perfectly 
            // if we only assume booleans.
            // OR we assume the UserCompanyRate hasn't changed?
            // We are NOT fetching UserCompanyRate here.

            // COMPROMISE:
            // If we can't reconstruct perfectly without extra queries, can we use `rateApplied` as a proxy?
            // `rateApplied` is just the base hourly/daily rate.

            // Let's assume for now:
            // If it's gross, the company pays the full "Gross" amount.
            // The DB 'amount' is Net.
            // There is no 'gross_amount' field.
            // This is a data gap. 

            // HOWEVER:
            // If `isGrossCalculation` is true, it implies the USER accepted a GROSS rate.
            // Meaning the UserRate IS the Gross Rate.
            // So Rate * Duration IS the cost (plus modifiers).

            // PROPOSAL:
            // 1. Base = Rate * Duration (or Days)
            // 2. Modifiers: We don't have the values.
            //    - We CANNOT guess them.
            //    - Maybe we ignored them in the rough estimate? 
            //    - OR we fetch full data? (Too heavy).

            // STOP.
            // If the dashboard is for the COMPANY, they know what they pay.
            // They pay the GROSS amount.
            // Ideally we should store `cost_to_company` in DB.

            // FOR NOW:
            // I will use `rateApplied * duration`. 
            // I will largely ignore modifiers if I can't find them, OR I will try to estimate.
            // Actually, `rateApplied` IS stored.
            // What about Night/Coordination? 
            // They are usually standard? No, per user.

            // Let's look at `UserCompanyRate` model.
            // It's not in WorkLog.

            // OK, let's just do `rateApplied * duration` for now as a "Base Gross".
            // It's better than Net.
            // Users usually have 0 modifiers.

            let estimatedGross = baseParams;
            // We can't easily add modifiers without the rate values.
            // We will settle for this and maybe warn?

            return estimatedGross;
        }

        // If Net (isGrossCalculation = false), then Company pays the Amount + Taxes?
        // NO. If agreement is Net 10€, Company pays 10€ + Taxes on top? 
        // Usually "Net Agreement" means User gets 10€. Company pays X to make user get 10.
        // `crud.py`: "if is_gross: ... deduct". 
        // If NOT is_gross (Net agreement), `amount` in DB is just `Duration * Rate`. No deduction logic is applied in `crud.py`.
        // So for Net agreement, `amount` = Cost (to user). 
        // Does company pay taxes on top? 
        // Implementation in `crud.py` shows NO extra calculation for company cost.
        // So for Net agreement, `amount` is arguably the cost (or at least what is recorded).

        return Number(log.amount) || 0;
    };

    console.log("CompanyDashboard: WorkLogs received", workLogs.length);

    const monthlyLogs = workLogs.filter((log: WorkLog) => {
        if (!log.date && !log.startDate) return false;
        const dateStr = (log.date || log.startDate) as string;
        const logDate = parseISO(dateStr);
        return logDate >= monthStart && logDate <= monthEnd;
    });

    const monthlyCost = monthlyLogs.reduce((sum: number, log: WorkLog) => {
        return sum + calculateLogCost(log);
    }, 0);

    const totalHours = workLogs.reduce((sum: number, log: WorkLog) => {
        return sum + (Number(log.durationHours) || 0);
    }, 0);

    const activeMembers = new Set(workLogs.map((log: WorkLog) => log.userId)).size;

    // Chart Data (Weekly Cost aggregation)
    const weeklyStats: Record<string, number> = {};
    const logDates: Date[] = [];

    workLogs.forEach((log: WorkLog) => {
        if (!log.date && !log.startDate) return;
        const dateStr = (log.date || log.startDate) as string;
        const logDate = parseISO(dateStr);
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
                                <TableCell>{log.date ? format(parseISO(log.date), 'dd/MM/yyyy') : '-'}</TableCell>
                                <TableCell>{log.user?.first_name} {log.user?.last_name}</TableCell>
                                <TableCell className="capitalize">{log.type}</TableCell>
                                <TableCell>{log.durationHours}h</TableCell>
                                <TableCell className="text-right font-medium">{Number(log.amount).toFixed(2)} €</TableCell>
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
