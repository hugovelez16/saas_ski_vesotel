"use client";

import { useState, useMemo } from "react";
import { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth, format, eachDayOfInterval, parseISO, addMonths, subMonths } from "date-fns";
import { DateRangeFilter } from "@/components/manager/date-range-filter";
import { BillingTable } from "@/components/manager/billing-table";
import { getWorkLogs } from "@/lib/api/work-logs";
import { getCompanyMembers } from "@/lib/api/companies";
import { useQuery } from "@tanstack/react-query";
import { WorkLog, DynamicBillingRow } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, Coins, Wallet, FileText } from "lucide-react";
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

    const worklogDefs: Record<string, { unit: string; label: string }> =
        company?.worklogDefinitions ?? {};

    // 3. Aggregate Data — dynamic grouping by log.type
    const billingData: DynamicBillingRow[] = useMemo(() => {
        if (!workLogs.length) return [];

        type DateSetMap = Record<string, Set<string>>;
        const userMap = new Map<string, { row: DynamicBillingRow; dateSets: DateSetMap }>();

        // Inicializar con miembros activos
        members.forEach((member: any) => {
            if (!member.user) return;
            userMap.set(member.user_id, {
                row: {
                    userId: member.user_id,
                    userName: `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim() || member.user.email,
                    userEmail: member.user.email,
                    byType: {},
                    totalNet: 0,
                    totalGross: 0,
                    logs: [],
                },
                dateSets: {},
            });
        });

        workLogs.forEach((log: WorkLog) => {
            let agg = userMap.get(log.userId);
            if (!agg) {
                agg = {
                    row: {
                        userId: log.userId,
                        userName: 'Unknown',
                        userEmail: '',
                        byType: {},
                        totalNet: 0,
                        totalGross: 0,
                        logs: [],
                    },
                    dateSets: {},
                };
                userMap.set(log.userId, agg);
            }

            agg.row.logs.push(log);

            const def = worklogDefs[log.type];
            const unit = def?.unit ?? 'hours';
            const label = def?.label ?? log.type;

            if (!agg.row.byType[log.type]) {
                agg.row.byType[log.type] = { typeKey: log.type, label, unit, quantity: 0, netAmount: 0, grossAmount: 0 };
            }
            if (unit === 'days' && !agg.dateSets[log.type]) {
                agg.dateSets[log.type] = new Set<string>();
            }

            const summary = agg.row.byType[log.type];

            if (unit === 'hours') {
                summary.quantity += Number(log.duration ?? 0);
            } else {
                // Acumular días únicos en el intervalo
                try {
                    eachDayOfInterval({ start: parseISO(log.startDate), end: parseISO(log.endDate) })
                        .forEach(d => agg!.dateSets[log.type].add(format(d, 'yyyy-MM-dd')));
                } catch {}
            }

            summary.netAmount += Number(log.netAmount ?? 0);
            summary.grossAmount += Number(log.grossAmount ?? 0);
            agg.row.totalNet += Number(log.netAmount ?? 0);
            agg.row.totalGross += Number(log.grossAmount ?? 0);
        });

        // Resolver cantidades para tipos "days"
        return Array.from(userMap.values()).map(({ row, dateSets }) => {
            Object.keys(dateSets).forEach(typeKey => {
                if (row.byType[typeKey]) {
                    row.byType[typeKey].quantity = dateSets[typeKey].size;
                }
            });
            return row;
        });
    }, [workLogs, members, worklogDefs]);

    const summaryStats = useMemo(() => {
        let totalGross = 0;
        let totalNet = 0;

        billingData.forEach(row => {
            totalGross += row.totalGross;
            totalNet += row.totalNet;
        });

        return { totalGross, totalNet, totalLogs: workLogs.length };
    }, [billingData, workLogs.length]);

    const handleExportCsv = () => {
        if (billingData.length === 0) return;
        const csvConfig = mkConfig({
            fieldSeparator: ',',
            decimalSeparator: '.',
            useKeysAsHeaders: true,
            filename: `Facturacion_Mensual_${date?.from ? format(date.from, 'MM-yyyy') : 'report'}`
        });

        const exportData = billingData.map(row => {
            const base: Record<string, any> = {
                Nombre: row.userName,
                Email: row.userEmail,
            };
            Object.entries(worklogDefs).forEach(([typeKey, def]) => {
                const summary = row.byType[typeKey];
                const unitLabel = def.unit === 'hours' ? 'h' : 'días';
                base[`${def.label} (${unitLabel})`] = summary
                    ? summary.quantity.toFixed(def.unit === 'hours' ? 2 : 0)
                    : '0';
            });
            base['Total Bruto (€)'] = (row.totalGross || row.totalNet).toFixed(2);
            base['Total Neto (€)'] = row.totalNet.toFixed(2);
            return base;
        });

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
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                                <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Registros</CardTitle>
                                <FileText className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                    {summaryStats.totalLogs}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Registros en el período</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* @ts-ignore — BillingTable types updated in Task 3 */}
                    <BillingTable
                        data={billingData}
                        worklogDefs={worklogDefs}
                        isLoading={isLoadingLogs || isLoadingMembers}
                    />
                </>
            )}
        </div>
    );
}
