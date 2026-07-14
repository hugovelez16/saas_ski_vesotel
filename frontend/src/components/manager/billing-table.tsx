"use client";

import { DataTable } from "@/components/ui/data-table";
import { WorkLog, DynamicBillingRow } from "@/lib/types";
import { useState, useMemo } from "react";
import { BillingBreakdownDialog } from "./billing-breakdown-dialog";
import { ColumnDef } from "@tanstack/react-table";

/** @deprecated Use DynamicBillingRow from @/lib/types instead */
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
    data: DynamicBillingRow[];
    worklogDefs: Record<string, { unit: string; label: string }>;
    isLoading?: boolean;
}

export function BillingTable({ data, worklogDefs, isLoading }: BillingTableProps) {
    const [selectedRow, setSelectedRow] = useState<DynamicBillingRow | null>(null);

    const columns = useMemo<ColumnDef<DynamicBillingRow>[]>(() => {
        const cols: ColumnDef<DynamicBillingRow>[] = [
            {
                accessorKey: 'userName',
                header: 'Nombre del usuario',
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {row.original.userName}
                        </span>
                        <span className="text-xs text-muted-foreground">{row.original.userEmail}</span>
                    </div>
                ),
            },
            // Una columna por tipo definido en worklogDefs
            ...Object.entries(worklogDefs).map(([typeKey, def]) => ({
                id: typeKey,
                header: def.label ?? typeKey,
                cell: ({ row }: { row: { original: DynamicBillingRow } }) => {
                    const summary = row.original.byType[typeKey];
                    if (!summary || summary.quantity === 0) {
                        return <div className="text-right text-muted-foreground">—</div>;
                    }
                    const qty = def.unit === 'hours'
                        ? `${summary.quantity.toFixed(2)} h`
                        : `${summary.quantity} días`;
                    return <div className="text-right">{qty}</div>;
                },
            } as ColumnDef<DynamicBillingRow>)),
            // Columna fija Total Bruto (siempre última)
            {
                id: 'totalGross',
                header: 'Total Bruto',
                cell: ({ row }) => (
                    <div className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
                            .format(row.original.totalGross || row.original.totalNet)}
                    </div>
                ),
            },
        ];
        return cols;
    }, [worklogDefs]);

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

            {/* @ts-ignore — BillingBreakdownDialog row/worklogDefs types updated in Task 4 */}
            <BillingBreakdownDialog
                open={!!selectedRow}
                onOpenChange={(open) => !open && setSelectedRow(null)}
                row={selectedRow}
                worklogDefs={worklogDefs}
            />
        </div>
    );
}
