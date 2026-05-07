"use client";

import { useState, useMemo } from "react";
import { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth, format, eachDayOfInterval, parseISO, addMonths, subMonths } from "date-fns";
import { DateRangeFilter } from "@/components/manager/date-range-filter";
import { BillingTable, BillingRow } from "@/components/manager/billing-table";
import { getWorkLogs } from "@/lib/api/work-logs";
import { getCompanyMembers, getCompanyRates } from "@/lib/api/companies";
import { useQuery } from "@tanstack/react-query";
import { WorkLog, UserCompanyRate } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function ManagerBillingPage() {
    const searchParams = useSearchParams();
    const selectedCompanyId = searchParams.get("companyId");

    // Default to current month
    const [date, setDate] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });

    // 1. Fetch Work Logs for selected company and date range
    const { data: workLogs = [], isLoading: isLoadingLogs } = useQuery({
        queryFn: () => getWorkLogs({
            companyId: selectedCompanyId!,
            startDate: date?.from ? format(date.from, 'yyyy-MM-dd') : undefined,
            endDate: date?.to ? format(date.to, 'yyyy-MM-dd') : undefined,
            limit: 1000
        }),
        queryKey: ["companyWorkLogs", selectedCompanyId, date?.from, date?.to],
        enabled: !!selectedCompanyId && !!date?.from,
    });

    // 2. Fetch Company Members
    const { data: members = [], isLoading: isLoadingMembers } = useQuery({
        queryFn: () => getCompanyMembers(selectedCompanyId!, 'active'),
        queryKey: ["companyMembers", selectedCompanyId],
        enabled: !!selectedCompanyId,
    });

    // 2b. Fetch Company Details for Settings
    const { data: company } = useQuery({
        queryFn: async () => (await import("@/lib/api").then(m => m.default.get(`/companies/${selectedCompanyId}`))).data,
        queryKey: ["company", selectedCompanyId],
        enabled: !!selectedCompanyId,
    });

    // 3. Aggregate Data
    const billingData: BillingRow[] = useMemo(() => {
        if (!workLogs || workLogs.length === 0) return [];

        // Helper interface for intermediate aggregation
        interface UserAgg {
            row: BillingRow;
            tutorialDates: Set<string>;
            coordinatedDates: Set<string>;
            nightDates: Set<string>;
        }

        const userMap = new Map<string, UserAgg>();

        // Initialize with active members
        members.forEach((member: any) => {
            if (member.user) {
                userMap.set(member.user_id, {
                    row: {
                        userId: member.user_id,
                        userName: `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim() || member.user.email,
                        userEmail: member.user.email,
                        particularHours: 0,
                        particularAmount: 0,
                        particularGrossAmount: 0, // NEW
                        tutorialDays: 0,
                        tutorialAmount: 0,
                        tutorialGrossAmount: 0, // NEW
                        coordinatedDays: 0,
                        coordinatedAmount: 0,
                        coordinatedGrossAmount: 0, // NEW
                        nightShifts: 0,
                        nightAmount: 0,
                        nightGrossAmount: 0, // NEW
                        totalAmount: 0,
                        totalGrossAmount: 0, // NEW
                        logs: []
                    },
                    tutorialDates: new Set(),
                    coordinatedDates: new Set(),
                    nightDates: new Set(),
                });
            }
        });

        // Process logs
        workLogs.forEach((log: WorkLog) => {
            let agg = userMap.get(log.userId);

            // If user not in members list
            if (!agg) {
                agg = {
                    row: {
                        userId: log.userId,
                        userName: "Unknown User",
                        userEmail: "",
                        particularHours: 0,
                        particularAmount: 0,
                        particularGrossAmount: 0, // NEW
                        tutorialDays: 0,
                        tutorialAmount: 0,
                        tutorialGrossAmount: 0, // NEW
                        coordinatedDays: 0,
                        coordinatedAmount: 0,
                        coordinatedGrossAmount: 0, // NEW
                        nightShifts: 0,
                        nightAmount: 0,
                        nightGrossAmount: 0, // NEW
                        totalAmount: 0,
                        totalGrossAmount: 0, // NEW
                        logs: []
                    },
                    tutorialDates: new Set(),
                    coordinatedDates: new Set(),
                    nightDates: new Set(),
                };
                userMap.set(log.userId, agg);
            }

            const logDate = log.date || log.startDate;

            agg.row.logs.push(log);

            // Calculations
            const amount = Number(log.amount) || 0;

            if (log.type === 'particular') {
                agg.row.particularHours += Number(log.durationHours) || 0;
                agg.row.particularAmount += amount;
                agg.row.particularGrossAmount += Number(log.grossAmount) || 0;
            } else if (log.type === 'tutorial') {
                agg.row.tutorialAmount += amount; // Attribute total amount to tutorial
                agg.row.tutorialGrossAmount += Number(log.grossAmount) || 0;
                if (log.startDate && log.endDate) {
                    try {
                        const range = eachDayOfInterval({
                            start: parseISO(log.startDate),
                            end: parseISO(log.endDate)
                        });
                        range.forEach(d => agg.tutorialDates.add(format(d, 'yyyy-MM-dd')));
                    } catch (e) {
                        console.error("Error parsing dates for tutorial log", log);
                    }
                }
            }

            if (log.hasCoordination) {
                if (logDate) {
                    agg.coordinatedDates.add(logDate);
                }
                // We don't have separate coord amount
            }

            if (log.hasNight) {
                if (log.type === 'tutorial' && log.startDate && log.endDate) {
                    // For tutorials: count all days except the last one (days - 1)
                    try {
                        const range = eachDayOfInterval({
                            start: parseISO(log.startDate),
                            end: parseISO(log.endDate)
                        });
                        // Add all days except the last one
                        range.slice(0, -1).forEach(d => agg.nightDates.add(format(d, 'yyyy-MM-dd')));
                    } catch (e) {
                        console.error("Error parsing dates for night calculation", log);
                    }
                } else if (log.type === 'particular' && logDate) {
                    // For particular shifts: count the single day
                    agg.nightDates.add(logDate);
                }
            }

            agg.row.totalAmount += amount;
            agg.row.totalGrossAmount += Number(log.grossAmount) || 0;
        });

        // Convert back to rows
        return Array.from(userMap.values()).map(agg => ({
            ...agg.row,
            tutorialDays: agg.tutorialDates.size,
            coordinatedDays: agg.coordinatedDates.size,
            nightShifts: agg.nightDates.size,
        }));
    }, [workLogs, members]);

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <h1 className="text-3xl font-bold tracking-tight">Billing Summary</h1>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div className="flex items-center gap-2">
                        <div className="flex border rounded-md shadow-sm">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-r-none h-8 w-8 px-0"
                                onClick={() => {
                                    if (date?.from) {
                                        const newDate = subMonths(date.from, 1);
                                        setDate({ from: startOfMonth(newDate), to: endOfMonth(newDate) });
                                    }
                                }}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="h-8 flex items-center px-4 border-x text-sm font-medium bg-muted/20">
                                {date?.from ? format(date.from, 'MMMM yyyy') : 'Select Month'}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-l-none h-8 w-8 px-0"
                                onClick={() => {
                                    if (date?.from) {
                                        const newDate = addMonths(date.from, 1);
                                        setDate({ from: startOfMonth(newDate), to: endOfMonth(newDate) });
                                    }
                                }}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    {/* Existing DateRangeFilter can remain or be removed if strict month mode is preferred. User said "option to change month by month", implying this is an addition or replacement. Usually replacing the complex range picker with this simple one is cleaner for billing. Or keep both? Keeping both might conflict visually. 
                    Let's hide the range picker IF we are using month mode? Or just place it next to it?
                    "change month by month" -> Usually means strict monthly view.
                    I will keep the DateRangeFilter but prioritize the month switcher visually. */}
                    <DateRangeFilter date={date} setDate={setDate} />
                </div>
            </div>

            {!selectedCompanyId && (
                <Card className="bg-yellow-50 border-yellow-200">
                    <CardContent className="pt-6 text-yellow-800">
                        No company selected. Please select a company from the sidebar.
                    </CardContent>
                </Card>
            )}

            {selectedCompanyId && (
                <BillingTable
                    data={billingData}
                    isLoading={isLoadingLogs || isLoadingMembers}
                    settings={company?.settings}
                />
            )}
        </div>
    );
}
