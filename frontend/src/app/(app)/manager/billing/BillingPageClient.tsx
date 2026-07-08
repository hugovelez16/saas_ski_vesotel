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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, Coins, Wallet, Clock, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { mkConfig, generateCsv, download } from "export-to-csv";

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

            const logDate = log.startDate;

            agg.row.logs.push(log);

            // Calculations
            const amount = log.netAmount !== undefined ? Number(log.netAmount) : (Number(log.amount) || 0);

            if (log.type === 'particular') {
                agg.row.particularHours += log.duration !== undefined ? Number(log.duration) : (Number(log.durationHours) || 0);
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

            const hasCoordination = log.hasCoordination || log.extraData?.opciones?.has_coordination || log.extraData?.opciones?.coordination;
            if (hasCoordination) {
                if (logDate) {
                    agg.coordinatedDates.add(logDate);
                }
                // We don't have separate coord amount
            }

            const hasNight = log.hasNight || log.extraData?.opciones?.has_night || log.extraData?.opciones?.night;
            if (hasNight) {
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

    const summaryStats = useMemo(() => {
        let totalGross = 0;
        let totalNet = 0;
        let totalHours = 0;
        let totalTutorials = 0;

        billingData.forEach(row => {
            totalGross += row.totalGrossAmount || row.totalAmount;
            totalNet += row.totalAmount;
            totalHours += row.particularHours;
            totalTutorials += row.tutorialDays;
        });

        return {
            totalGross,
            totalNet,
            totalHours,
            totalTutorials
        };
    }, [billingData]);

    const handleExportCsv = () => {
        if (billingData.length === 0) return;
        const csvConfig = mkConfig({
            fieldSeparator: ',',
            decimalSeparator: '.',
            useKeysAsHeaders: false,
            headers: ['Nombre', 'Email', 'Horas Particulares', 'Días Tutoriales', 'Días Coordinados', 'Nocturnidades', 'Total Bruto (€)', 'Total Neto (€)'],
            filename: `Facturacion_Mensual_${date?.from ? format(date.from, 'MM-yyyy') : 'report'}`
        });

        const exportData = billingData.map(row => ({
            Nombre: row.userName,
            Email: row.userEmail,
            'Horas Particulares': row.particularHours.toFixed(2),
            'Días Tutoriales': row.tutorialDays,
            'Días Coordinados': row.coordinatedDays,
            Nocturnidades: row.nightShifts,
            'Total Bruto (€)': (row.totalGrossAmount || row.totalAmount).toFixed(2),
            'Total Neto (€)': row.totalAmount.toFixed(2)
        }));

        const csv = generateCsv(csvConfig)(exportData);
        download(csvConfig)(csv);
    };

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Resumen y Facturación</h1>
                    <p className="text-muted-foreground text-sm">Resumen mensual de actividad y cálculo de costes del equipo.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 items-center w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <div className="flex border rounded-md shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
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
                    
                    <DateRangeFilter date={date} setDate={setDate} />
                    
                    {billingData.length > 0 && (
                        <Button onClick={handleExportCsv} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2 h-9">
                            <Download className="h-4 w-4" />
                            Exportar CSV
                        </Button>
                    )}
                </div>
            </div>

            {!selectedCompanyId && (
                <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900/50">
                    <CardContent className="pt-6 text-yellow-800 dark:text-yellow-200">
                        No company selected. Please select a company from the sidebar.
                    </CardContent>
                </Card>
            )}

            {selectedCompanyId && (
                <>
                    {/* KPI Cards Grid */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Card className="border-emerald-100 dark:border-emerald-950 shadow-sm hover:shadow-md transition-all duration-300">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Coste Bruto (Empresa)</CardTitle>
                                <Coins className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                    {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(summaryStats.totalGross)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Coste real consolidado</p>
                            </CardContent>
                        </Card>

                        <Card className="border-indigo-100 dark:border-indigo-950 shadow-sm hover:shadow-md transition-all duration-300">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Coste Neto (Personal)</CardTitle>
                                <Wallet className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                    {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(summaryStats.totalNet)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Suma líquida percibida</p>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Horas Particulares</CardTitle>
                                <Clock className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                    {summaryStats.totalHours.toFixed(2)} h
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Tiempo de servicio regular</p>
                            </CardContent>
                        </Card>

                        <Card className="border-amber-100 dark:border-amber-950 shadow-sm hover:shadow-md transition-all duration-300">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Días Tutoriales</CardTitle>
                                <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                    {summaryStats.totalTutorials} días
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Días de formación/tutoriales</p>
                            </CardContent>
                        </Card>
                    </div>

                    <BillingTable
                        data={billingData}
                        isLoading={isLoadingLogs || isLoadingMembers}
                        settings={company?.settings}
                    />
                </>
            )}
        </div>
    );
}
