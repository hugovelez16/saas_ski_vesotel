"use client";
export const dynamic = "force-dynamic";


import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCompaniesDetailed, updateMemberStatus } from "@/lib/api/companies";
import { DataTable } from "@/components/ui/data-table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";

export default function ManagerUsersPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const companyIdParam = searchParams.get("companyId");

    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Fetch Managed Key Data
    const { data: companies = [], isLoading } = useQuery({
        queryFn: getCompaniesDetailed,
        queryKey: ["companiesDetailed"],
    });

    const memberStatusMutation = useMutation({
        mutationFn: ({ companyId, userId, status }: { companyId: string; userId: string; status: string }) =>
            updateMemberStatus(companyId, userId, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["companiesDetailed"] });
            toast({ title: "Estado membresía actualizado" });
        },
        onError: () => toast({ title: "Error al actualizar estado", variant: "destructive" })
    });

    // Deduplicate Users from Companies and Flatten with Meta
    const usersWithMeta = useMemo(() => {
        const map = new Map<string, any>();

        const filteredCompanies = companyIdParam
            ? companies.filter((c: any) => c.id === companyIdParam)
            : companies;

        filteredCompanies.forEach((company: any) => {
            if (!company.members) return;
            company.members.forEach((member: any) => {
                if (!map.has(member.userId)) {
                    map.set(member.userId, {
                        ...member.user,
                        _companyId: company.id,
                        _status: member.isActive ? 'active' : 'inactive',
                        _role: member.role
                    });
                }
            });
        });
        return Array.from(map.values());
    }, [companies, companyIdParam]);

    const handleToggle = (user: any, checked: boolean) => {
        if (!user._companyId) return;
        memberStatusMutation.mutate({
            companyId: user._companyId,
            userId: user.id,
            status: checked ? 'active' : 'rejected'
        });
    };

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "firstName",
            header: "Nombre",
            cell: ({ row }) => `${row.original.firstName} ${row.original.lastName}`,
        },
        {
            accessorKey: "email",
            header: "Email",
        },
        {
            accessorKey: "_role",
            header: "Rol",
            cell: ({ row }) => {
                const role = row.original._role;
                const roleMap: Record<string, { label: string, color: string }> = {
                    admin: { label: 'Admin Empresa', color: 'bg-red-600' },
                    manager: { label: 'Manager', color: 'bg-indigo-600' },
                    worker: { label: 'Trabajador', color: 'bg-slate-200 text-slate-700' }
                };
                
                const display = roleMap[role as string] || { label: role, color: 'bg-secondary text-secondary-foreground' };
                
                return (
                    <Badge 
                        variant={role === 'worker' ? 'secondary' : 'default'}
                        className={display.color + (role !== 'worker' ? " hover:opacity-90" : "")}
                    >
                        {display.label}
                    </Badge>
                );
            },
        },
        {
            accessorKey: "_status",
            header: "Estado en Empresa",
            cell: ({ row }) => {
                const user = row.original;
                return (
                    <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                        <Switch
                            checked={user._status === 'active'}
                            onCheckedChange={(checked) => handleToggle(user, checked)}
                        />
                        <span className={user._status === 'active' ? "text-green-600 text-xs font-semibold" : "text-red-600 text-xs font-semibold"}>
                            {user._status === 'active' ? "Activo" : "Inactivo"}
                        </span>
                    </div>
                );
            }
        }
    ];

    if (isLoading) {
        return <div className="p-8">Cargando gestión de usuarios...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Users className="h-6 w-6 text-indigo-600" />
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Panel de Supervisión</h1>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={usersWithMeta}
                searchKey="email"
                searchPlaceholder="Buscar por email..."
                onRowClick={(user) => {
                    const query = companyIdParam ? `?companyId=${companyIdParam}` : "";
                    router.push(`/manager/users/${user.id}${query}`);
                }}
            />
        </div>
    );
}
