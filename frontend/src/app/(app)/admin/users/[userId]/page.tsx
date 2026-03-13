"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUser, getUserCompanies } from "@/lib/api/users";
import { getWorkLogs, deleteWorkLog } from "@/lib/api/work-logs";
import { updateCompanyMember } from "@/lib/api/companies";
import { useParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Building2, Wallet, Database, ArrowLeft, Loader2, Sparkles, Moon, Trash2, Pencil } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { useToast } from "@/hooks/use-toast";
import { JsonEditor } from "@/components/admin/json-editor";
import { UserEditDialog } from "@/components/admin/user-edit-dialog";
import { UserCreateWorkLogDialog } from "@/components/work-log/user-dialog";

export default function UserDetailPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const userId = params.userId as string;

    const [selectedLog, setSelectedLog] = useState<any | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const { data: user, isLoading: loadingUser } = useQuery({
        queryFn: () => getUser(userId),
        queryKey: ["user", userId],
    });

    const { data: companies = [], isLoading: loadingCompanies } = useQuery({
        queryFn: () => getUserCompanies(userId),
        queryKey: ["user-companies", userId],
        enabled: !!userId,
    });

    const { data: workLogs = [], isLoading: loadingLogs } = useQuery({
        queryFn: () => getWorkLogs({ userId: userId }),
        queryKey: ["work-logs", userId],
        enabled: !!userId,
    });

    const updateMemberMutation = useMutation({
        mutationFn: ({ companyId, data }: { companyId: string, data: any }) =>
            updateCompanyMember(companyId, userId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["user-companies", userId] });
            toast({ title: "Configuración de miembro actualizada" });
        },
        onError: () => toast({ title: "Error al actualizar", variant: "destructive" })
    });

    const handleDeleteLog = async (logId: string) => {
        if (!confirm("¿Eliminar este parte de trabajo?")) return;
        try {
            await deleteWorkLog(logId);
            toast({ title: "Parte eliminado" });
            queryClient.invalidateQueries({ queryKey: ["work-logs", userId] });
        } catch (error) {
            toast({ title: "Error al eliminar", variant: "destructive" });
        }
    };

    if (loadingUser) return <div className="p-8 text-center"><Loader2 className="animate-spin" /> Cargando...</div>;
    if (!user) return <div className="p-8 text-center text-red-600">Usuario no encontrado</div>;

    const logColumns: ColumnDef<any>[] = [
        {
            accessorKey: "date",
            header: "Fecha",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium">
                        {row.original.startDate ? format(new Date(row.original.startDate), "dd/MM/yyyy") : row.original.date ? format(new Date(row.original.date), "dd/MM/yyyy") : "-"}
                    </span>
                    {row.original.startTime && (
                        <span className="text-xs text-muted-foreground">{row.original.startTime} - {row.original.endTime}</span>
                    )}
                </div>
            )
        },
        {
            accessorKey: "type",
            header: "Tipo",
            cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.original.type}</Badge>
        },
        {
            accessorKey: "companyId",
            header: "Empresa",
            cell: ({ row }) => companies.find(c => c.id === row.original.companyId)?.name || "N/A"
        },
        {
            accessorKey: "client",
            header: "Cliente / Local",
            cell: ({ row }) => row.original.client || "-"
        },
        {
            id: "flags",
            header: "Extras",
            cell: ({ row }) => (
                <div className="flex gap-1">
                    {row.original.extraData?.has_coordination && <Sparkles className="h-4 w-4 text-blue-500" />}
                    {row.original.extraData?.has_night && <Moon className="h-4 w-4 text-indigo-500" />}
                </div>
            )
        },
        {
            accessorKey: "amount",
            header: "Importe",
            cell: ({ row }) => <span className="font-bold text-slate-900">€{Number(row.original.amount || 0).toFixed(2)}</span>
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => (
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDeleteLog(row.original.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">{user.first_name} {user.last_name}</h1>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <p>{user.email}</p>
                        <span>•</span>
                        <Badge variant={user.is_active ? "default" : "destructive"}>{user.is_active ? "Activo" : "Inactivo"}</Badge>
                        <Badge variant="outline">{user.role}</Badge>
                    </div>
                </div>
                <div className="flex gap-2">
                    <UserCreateWorkLogDialog user={user} companies={companies} onLogUpdate={() => queryClient.invalidateQueries({ queryKey: ["work-logs", userId] })}>
                        <Button>Añadir Parte</Button>
                    </UserCreateWorkLogDialog>
                    <UserEditDialog user={user} />
                </div>
            </div>

            <Tabs defaultValue="worklogs" className="w-full">
                <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                    <TabsTrigger value="worklogs">Historial de Partes</TabsTrigger>
                    <TabsTrigger value="companies">Empresas & Tasas</TabsTrigger>
                    <TabsTrigger value="master" className="text-indigo-600 font-bold border-l-2 border-indigo-200 ml-2">
                        <Database className="h-4 w-4 mr-2" />
                        Master Rates
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="worklogs" className="pt-4">
                    <Card className="border-none shadow-none bg-transparent">
                        <CardHeader className="px-0">
                            <CardTitle>Partes Realizados</CardTitle>
                            <CardDescription>Visualización completa de la actividad registrada.</CardDescription>
                        </CardHeader>
                        <CardContent className="px-0">
                            <DataTable
                                columns={logColumns}
                                data={workLogs}
                                searchKey="client"
                                searchPlaceholder="Buscar por cliente/local..."
                                onRowClick={(log) => {
                                    setSelectedLog(log);
                                    setIsEditDialogOpen(true);
                                }}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="companies" className="pt-4">
                    <div className="grid gap-6">
                        {companies.map((company) => (
                            <Card key={company.id}>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-5 w-5 text-indigo-600" />
                                        <CardTitle>{company.name}</CardTitle>
                                    </div>
                                    <Badge variant="secondary" className="capitalize">{company.role}</Badge>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-sm text-muted-foreground">
                                        Estado en empresa: <Badge variant={company.is_active_member ? 'default' : 'secondary'}>{company.is_active_member ? 'Activo' : 'Inactivo'}</Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="master" className="pt-4">
                    <div className="space-y-6">
                        {companies.map((company) => (
                            <Card key={company.id} className="border-indigo-100 dark:border-indigo-900 shadow-sm">
                                <CardHeader className="bg-indigo-50/30 dark:bg-indigo-950/10">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Wallet className="h-4 w-4 text-indigo-600" />
                                        Configuración Económica en {company.name}
                                    </CardTitle>
                                    <CardDescription className="text-xs text-[10px]">Edición directa de rates_config (Precios, IRPF, etc.)</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <JsonEditor
                                        initialValue={company.rates_config || {}}
                                        onSave={(val) => updateMemberMutation.mutate({
                                            companyId: company.id,
                                            data: { rates_config: val }
                                        })}
                                        label="Rates JSON"
                                        description="Valores de hourly_rate, daily_rate, deduction_irpf, etc."
                                    />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Dialog de Edición de Log */}
            {selectedLog && (
                <UserCreateWorkLogDialog
                    user={user}
                    companies={companies}
                    logToEdit={selectedLog}
                    open={isEditDialogOpen}
                    onOpenChange={setIsEditDialogOpen}
                    onLogUpdate={() => queryClient.invalidateQueries({ queryKey: ["work-logs", userId] })}
                />
            )}
        </div>
    );
}
