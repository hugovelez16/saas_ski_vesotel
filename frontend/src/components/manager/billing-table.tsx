"use client";

import { DataTable } from "@/components/ui/data-table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CompanySettings, WorkLog } from "@/lib/types";
import { useState, useMemo } from "react";
import { BillingBreakdownDialog } from "./billing-breakdown-dialog";
import { ColumnDef } from "@tanstack/react-table";

export interface BillingRow {
    userId: string;
    userName: string;
    userEmail: string;
    particularHours: number;
    particularAmount: number;
    particularGrossAmount: number;
    tutorialDays: number;
    tutorialAmount: number;
    tutorialGrossAmount: number;
    coordinatedDays: number;
    coordinatedAmount: number;
    coordinatedGrossAmount: number;
    nightShifts: number;
    nightAmount: number;
    nightGrossAmount: number;
    totalAmount: number;
    totalGrossAmount: number;
    rates?: any;
    logs: WorkLog[];
}

interface BillingTableProps {
    data: BillingRow[];
    isLoading?: boolean;
    settings?: CompanySettings;
}

export function BillingTable({ data, isLoading, settings }: BillingTableProps) {
    const [selectedRow, setSelectedRow] = useState<BillingRow | null>(null);

    const showTutorials = settings?.features?.tutorials !== false;
    const showCoordination = settings?.features?.coordination !== false;
    const showNights = settings?.features?.night_shifts !== false;

    const columns = useMemo<ColumnDef<BillingRow>[]>(() => {
        const cols: ColumnDef<BillingRow>[] = [
            {
                accessorKey: "userName",
                header: "Nombre del usuario",
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.original.userName}</span>
                        <span className="text-xs text-muted-foreground">{row.original.userEmail}</span>
                    </div>
                )
            },
            {
                accessorKey: "particularHours",
                header: "Horas Particulares",
                cell: ({ row }) => <div className="text-right">{row.original.particularHours.toFixed(2)} h</div>
            }
        ];

        if (showTutorials) {
            cols.push({
                accessorKey: "tutorialDays",
                header: "Días Tutoriales",
                cell: ({ row }) => <div className="text-right">{row.original.tutorialDays}</div>
            });
        }

        if (showCoordination) {
            cols.push({
                accessorKey: "coordinatedDays",
                header: "Días Coordinados",
                cell: ({ row }) => <div className="text-right">{row.original.coordinatedDays}</div>
            });
        }

        if (showNights) {
            cols.push({
                accessorKey: "nightShifts",
                header: "Nocturnidades",
                cell: ({ row }) => <div className="text-right">{row.original.nightShifts}</div>
            });
        }

        cols.push({
            accessorKey: "totalGrossAmount",
            header: "Total Bruto",
            cell: ({ row }) => (
                <div className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                    {new Intl.NumberFormat("es-ES", {
                        style: "currency",
                        currency: "EUR",
                    }).format(row.original.totalGrossAmount || row.original.totalAmount)}
                </div>
            )
        });

        return cols;
    }, [showTutorials, showCoordination, showNights]);

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">Cargando facturación...</div>;
    }

    return (
        <div className="space-y-4">
            <DataTable
                columns={columns}
                data={data}
                onRowClick={(row) => setSelectedRow(row)}
                searchKey="userName"
                searchPlaceholder="Buscar por nombre..."
            />

            <BillingBreakdownDialog
                open={!!selectedRow}
                onOpenChange={(open) => !open && setSelectedRow(null)}
                row={selectedRow}
            />
        </div>
    );
}
