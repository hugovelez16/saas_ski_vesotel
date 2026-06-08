"use client";
export const dynamic = "force-dynamic";


import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getCompaniesDetailed } from "@/lib/api/companies";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { useState, useMemo } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, parseISO } from "date-fns";
import { Loader2, ArrowUp, ArrowDown, ArrowUpDown, User as UserIcon, Calendar, Sparkles, Moon } from "lucide-react";
import { WorkLog } from "@/lib/types";
import { FilterBar, FilterConfig } from "@/components/ui/filter-bar";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

export default function ManagerShiftsPage() {
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const [filters, setFilters] = useState<Record<string, any>>({});

    // Fetch companies
    const { data: companies = [], isLoading: loadingCompanies } = useQuery({
        queryFn: getCompaniesDetailed,
        queryKey: ["companiesDetailed"],
    });

    const companyIdFromUrl = searchParams.get("companyId");
    const selectedCompanyId = companyIdFromUrl || (companies.length > 0 ? companies[0].id : null);

    const { data: workLogs = [], isLoading: loadingLogs } = useQuery({
        queryFn: async () => {
            if (!selectedCompanyId) return [];
            const res = await api.get<WorkLog[]>(`/work-logs?company_id=${selectedCompanyId}`);
            return res.data;
        },
        queryKey: ["companyWorkLogs", selectedCompanyId],
        enabled: !!selectedCompanyId
    });

    const selectedCompany = useMemo(() => companies.find(c => c.id === selectedCompanyId), [companies, selectedCompanyId]);

    const memberOptions = useMemo(() => {
        if (!selectedCompany) return [];
        return selectedCompany.members
            .filter(m => m.user)
            .map(m => ({
                label: `${m.user!.firstName} ${m.user!.lastName}`,
                value: m.userId
            }));
    }, [selectedCompany]);

    const logsWithMeta = useMemo(() => {
        return workLogs.map(log => {
            const member = selectedCompany?.members.find(m => m.userId === log.userId);
            return {
                ...log,
                userName: member ? `${member.user?.firstName} ${member.user?.lastName}` : 'Desconocido',
                userEmail: member?.user?.email
            };
        }).filter(log => {
            if (filters.userId && filters.userId.length > 0 && !filters.userId.includes(log.userId)) return false;
            if (filters.type && filters.type.length > 0 && !filters.type.includes(log.type)) return false;
            if (filters.date) {
                const { from, to } = filters.date;
                const d = new Date(log.startDate);
                if (from && d < from) return false;
                if (to && d > to) return false;
            }
            return true;
        });
    }, [workLogs, selectedCompany, filters]);

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "userName",
            header: "Usuario",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{row.original.userName}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[150px]">{row.original.userEmail}</span>
                </div>
            )
        },
        {
            accessorKey: "date",
            header: "Fecha",
            cell: ({ row }) => {
                const log = row.original;
                return (
                    <div className="flex items-center gap-2">
                        <span className="font-medium whitespace-nowrap">
                            {log.type === 'tutorial' && log.startDate && log.endDate
                                ? `${format(parseISO(log.startDate), "dd/MM/yyyy")} - ${format(parseISO(log.endDate), "dd/MM/yyyy")}`
                                : (log.date ? format(parseISO(log.date), "dd/MM/yyyy") : "-")}
                        </span>
                        {log.type === 'particular' && log.startTime && log.endTime && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {log.startTime} - {log.endTime}
                            </span>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: "type",
            header: "Tipo",
            cell: ({ row }) => (
                <Badge
                    variant={row.original.type === 'tutorial' ? 'secondary' : 'default'}
                    className={row.original.type === 'tutorial' ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100' : 'bg-blue-100 text-blue-700 hover:bg-blue-100'}
                >
                    {row.original.type}
                </Badge>
            )
        },

        {
            id: "flags",
            header: "Extras",
            cell: ({ row }) => (
                <div className="flex gap-1">
                    {row.original.hasCoordination && (
                        <div className="p-1 bg-yellow-50 text-yellow-700 rounded border border-yellow-100" title="Coordinación">
                            <Sparkles className="h-3 w-3" />
                        </div>
                    )}
                    {row.original.hasNight && (
                        <div className="p-1 bg-indigo-50 text-indigo-700 rounded border border-indigo-100" title="Nocturnidad">
                            <Moon className="h-3 w-3" />
                        </div>
                    )}
                </div>
            )
        },
        {
            accessorKey: "amount",
            header: () => <div className="text-right">Importe</div>,
            cell: ({ row }) => (
                <div className="text-right font-medium">
                    {row.original.amount ? `€${Number(row.original.amount).toFixed(2)}` : '-'}
                </div>
            )
        }
    ];

    if (loadingCompanies) {
        return <div className="p-8 flex items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando empresas...</div>;
    }

    const filterConfig: FilterConfig[] = [
        { id: "date", label: "Rango de fechas", type: "date-range" },
        { id: "userId", label: "Usuario", type: "select", options: memberOptions },
        { id: "type", label: "Tipo", type: "select", options: [{ label: "Particular", value: "particular" }, { label: "Tutorial", value: "tutorial" }] },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Turnos y Partes</h1>
                <p className="text-muted-foreground">Visualiza y gestiona los partes de trabajo de tus empresas.</p>
            </div>

            <div className="space-y-4">
                <FilterBar config={filterConfig} onFilterChange={setFilters} />

                <DataTable
                    columns={columns}
                    data={logsWithMeta}
                    isLoading={loadingLogs}
                    searchKey="userName"
                    searchPlaceholder="Buscar por usuario..."
                />

                <div className="text-xs text-muted-foreground text-right">
                    Mostrando {logsWithMeta.length} registros
                </div>
            </div>
        </div>
    );
}
