"use client";

import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ColumnDef } from "@tanstack/react-table";
import { UserDevice } from "@/lib/types";

interface UserDevicesTableProps {
    devices: UserDevice[];
    onRevoke: (deviceId: string) => void;
    isLoading?: boolean;
}

export function UserDevicesTable({ devices, onRevoke, isLoading }: UserDevicesTableProps) {
    const columns: ColumnDef<UserDevice>[] = [
        {
            accessorKey: "name",
            header: "Nombre",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium">{row.original.name || "Desconocido"}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                        {row.original.deviceIdentifier.substring(0, 8)}...
                    </span>
                </div>
            )
        },
        {
            accessorKey: "lastUsed",
            header: "Último Uso",
            cell: ({ row }) => format(new Date(row.original.lastUsed), "Pp", { locale: es })
        },
        {
            accessorKey: "expiresAt",
            header: "Expira",
            cell: ({ row }) => format(new Date(row.original.expiresAt), "P", { locale: es })
        },
        {
            id: "actions",
            header: "Acciones",
            cell: ({ row }) => (
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onRevoke(row.original.id)}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            )
        }
    ];

    return (
        <DataTable
            columns={columns}
            data={devices}
            isLoading={isLoading}
            searchKey="name"
            searchPlaceholder="Buscar dispositivo..."
        />
    );
}
