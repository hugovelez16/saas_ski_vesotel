"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCompaniesDetailed, updateMemberStatus, updateCompanyMember, notifyCompanyMember, getCompanyRates, updateCompany } from "@/lib/api/companies";
import { useParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Check, X, Shield, Mail, Loader2, Settings, Database, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddMemberDialog } from "@/components/admin/add-member-dialog";
import { CompanyConfigurationTab } from "@/components/admin/company-configuration-tab";
import { MemberSettingsDialog } from "@/components/admin/member-settings-dialog";
import { CompanyMember, UserCompanyRate } from "@/lib/types";
import { DailyReportView } from "@/components/admin/daily-report-view";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { JsonEditor } from "@/components/admin/json-editor";
import { TaxConfigBuilder } from "@/components/admin/tax-config-builder";
import { WorklogDefinitionBuilder } from "@/components/admin/worklog-definition-builder";

export default function CompanyDetailsPage() {
    const { companyId } = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: companies = [], isLoading } = useQuery({
        queryFn: getCompaniesDetailed,
        queryKey: ["companiesDetailed"],
    });

    const company = companies.find(c => c.id === companyId);

    const updateCompanyMutation = useMutation({
        mutationFn: (data: any) => updateCompany(companyId as string, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["companiesDetailed"] });
            toast({ title: "Configuración guardada" });
        },
        onError: () => toast({ title: "Error al guardar", variant: "destructive" })
    });

    const statusMutation = useMutation({
        mutationFn: ({ userId, status }: { userId: string, status: string }) =>
            updateMemberStatus(companyId as string, userId, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["companiesDetailed"] });
            toast({ title: "Estado membresía actualizado" });
        },
        onError: () => toast({ title: "Error al actualizar estado", variant: "destructive" })
    });

    const roleMutation = useMutation({
        mutationFn: ({ userId, role }: { userId: string, role: string }) =>
            updateCompanyMember(companyId as string, userId, { role }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["companiesDetailed"] });
            toast({ title: "Rol actualizado" });
        },
        onError: () => toast({ title: "Error al actualizar rol", variant: "destructive" })
    });

    const notifyMutation = useMutation({
        mutationFn: ({ userId }: { userId: string }) =>
            notifyCompanyMember(companyId as string, userId),
        onSuccess: () => {
            toast({ title: "Notificación enviada", description: "El usuario ha recibido un correo." });
        },
        onError: () => toast({ title: "Error al enviar notificación", variant: "destructive" })
    });

    if (isLoading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;
    if (!company) return <div className="p-8">Empresa no encontrada</div>;

    const workers = company.members.filter(m => m.role === 'worker');
    const supervisors = company.members.filter(m => m.role === 'manager');

    const memberColumns: ColumnDef<CompanyMember>[] = [
        {
            accessorKey: "user",
            header: "Usuario",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium">{row.original.user?.first_name} {row.original.user?.last_name}</span>
                    <span className="text-xs text-muted-foreground">{row.original.user?.email}</span>
                </div>
            )
        },
        {
            accessorKey: "status",
            header: "Estado",
            cell: ({ row }) => (
                <Badge variant={row.original.is_active ? 'default' : 'destructive'}>
                    {row.original.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
            )
        },
        {
            id: "actions",
            header: "Acciones",
            cell: ({ row }) => {
                const member = row.original;
                return (
                    <div className="flex items-center gap-2">
                        {member.role === 'worker' ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => roleMutation.mutate({ userId: member.userId, role: 'manager' })}
                                title="Promover a Supervisor"
                            >
                                <Shield className="h-4 w-4 mr-1 text-indigo-600" />
                                Promover
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => roleMutation.mutate({ userId: member.userId, role: 'worker' })}
                                title="Degradar a Trabajador"
                            >
                                Degradar
                            </Button>
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            className={member.is_active ? "text-red-600" : "text-green-600"}
                            onClick={() => statusMutation.mutate({
                                userId: member.userId,
                                status: member.is_active ? 'rejected' : 'active'
                            })}
                        >
                            {member.is_active ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                        </Button>

                        <Button variant="ghost" size="icon" onClick={() => notifyMutation.mutate({ userId: member.userId })} title="Enviar Notificación">
                            <Mail className="h-4 w-4" />
                        </Button>

                        <MemberSettingsDialog
                            companyId={company.id}
                            userId={member.userId}
                            memberName={(member.user?.first_name || '') + ' ' + (member.user?.last_name || '')}
                            initialSettings={member.settings}
                        />
                    </div>
                );
            }
        }
    ];

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink onClick={() => router.push('/admin/companies')} className="cursor-pointer text-indigo-600">Empresas</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>{company.name}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{company.name}</h1>
                    <p className="text-muted-foreground">Panel avanzado de gestión para administradores.</p>
                </div>
                <div className="flex gap-2">
                    <AddMemberDialog companyId={company.id} companyName={company.name} existingMembers={company.members} />
                </div>
            </div>

            <Tabs defaultValue="workers" className="w-full">
                <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                    <TabsTrigger value="workers">Trabajadores ({workers.length})</TabsTrigger>
                    <TabsTrigger value="supervisors">Supervisores ({supervisors.length})</TabsTrigger>
                    <TabsTrigger value="taxes">Tasas & IRPF</TabsTrigger>
                    <TabsTrigger value="settings">Ajustes UI</TabsTrigger>
                    <TabsTrigger value="master" className="text-indigo-600 font-bold border-l-2 border-indigo-200 ml-2">
                        <Database className="h-4 w-4 mr-2" />
                        Master Config
                    </TabsTrigger>
                </TabsList>

                {/* WORKERS TAB */}
                <TabsContent value="workers" className="pt-4">
                    <Card className="border-none shadow-none bg-transparent">
                        <CardHeader className="px-0">
                            <CardTitle>Trabajadores</CardTitle>
                            <CardDescription>Gestión de personal de campo y sus permisos.</CardDescription>
                        </CardHeader>
                        <CardContent className="px-0">
                            <DataTable columns={memberColumns} data={workers} searchKey="user" searchPlaceholder="Buscar trabajador..." />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* SUPERVISORS TAB */}
                <TabsContent value="supervisors" className="pt-4">
                    <Card className="border-none shadow-none bg-transparent">
                        <CardHeader className="px-0">
                            <CardTitle>Supervisores</CardTitle>
                            <CardDescription>Usuarios con privilegios de gestión en esta empresa.</CardDescription>
                        </CardHeader>
                        <CardContent className="px-0">
                            <DataTable columns={memberColumns} data={supervisors} searchKey="user" searchPlaceholder="Buscar supervisor..." />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAXES TAB */}
                <TabsContent value="taxes" className="pt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Resumen de Tasas</CardTitle>
                            <CardDescription>Vista consolidada de los costes por miembro.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TaxOverview companyId={company.id} />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* MASTER CONFIG TAB */}
                <TabsContent value="master" className="pt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="border-indigo-100 dark:border-indigo-900 shadow-lg">
                            <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/20">
                                <CardTitle className="flex items-center gap-2">
                                    <Database className="h-5 w-5 text-indigo-600" />
                                    Esquema de Impuestos (taxConfig)
                                </CardTitle>
                                <CardDescription>Define retenciones de SS, IRPF base y otros parámetros globales.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <JsonEditor
                                    initialValue={company.taxConfig}
                                    onSave={(val) => updateCompanyMutation.mutate({ taxConfig: val })}
                                    description="Cuidado: Cambiar esto afecta a todos los cálculos nuevos."
                                />
                            </CardContent>
                        </Card>

                        <Card className="border-indigo-100 dark:border-indigo-900 shadow-lg">
                            <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/20">
                                <CardTitle className="flex items-center gap-2">
                                    <Settings className="h-5 w-5 text-indigo-600" />
                                    Definiciones de Jornada (worklogDefinitions)
                                </CardTitle>
                                <CardDescription>Configura tipos de parte (Particular, Tutorial, etc.) y sus campos.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <JsonEditor
                                    initialValue={company.worklogDefinitions}
                                    onSave={(val) => updateCompanyMutation.mutate({ worklogDefinitions: val })}
                                    description="Determina qué formularios y unidades de medida están disponibles."
                                />
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* UI SETTINGS TAB */}
                <TabsContent value="settings" className="pt-4">
                    <CompanyConfigurationTab company={company} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function TaxOverview({ companyId }: { companyId: string }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: members = [], isLoading } = useQuery({
        queryKey: ["companyRates", companyId],
        queryFn: () => getCompanyRates(companyId),
    });

    const mutation = useMutation({
        mutationFn: ({ userId, ratesConfig }: { userId: string, ratesConfig: any }) =>
            updateCompanyMember(companyId, userId, { ratesConfig }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["companyRates", companyId] });
            toast({ title: "Tarifas actualizadas" });
        },
        onError: () => toast({ title: "Error al actualizar", variant: "destructive" })
    });

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "user",
            header: "Miembro",
            cell: ({ row }) => `${row.original.user?.first_name} ${row.original.user?.last_name}`
        },
        {
            id: "particularRate",
            header: "Tarifa Particular",
            cell: ({ row }) => {
                const config = row.original.ratesConfig || {};
                const particular = config.particular;
                if (!particular) return <span className="text-muted-foreground text-xs">No conf.</span>;
                return (
                    <div className="flex flex-col text-xs">
                        <span>{particular.base_rate}€ / {particular.unit || 'h'}</span>
                        <span className="text-muted-foreground">{particular.is_gross !== false ? 'Bruto' : 'Neto'}</span>
                    </div>
                );
            }
        },
        {
            id: "tutorialRate",
            header: "Tarifa Tutorial",
            cell: ({ row }) => {
                const config = row.original.ratesConfig || {};
                const tutorial = config.tutorial;
                if (!tutorial) return <span className="text-muted-foreground text-xs">No conf.</span>;
                return (
                    <div className="flex flex-col text-xs">
                        <span>{tutorial.base_rate}€ / d</span>
                    </div>
                );
            }
        },
        {
            id: "taxOverrides",
            header: "Impuestos",
            cell: ({ row }) => {
                const config = row.original.ratesConfig || {};
                const keys = Object.keys(config);
                return (
                    <Badge variant={keys.length > 0 ? "default" : "secondary"}>
                        {keys.length > 0 ? "Configurado" : "Por defecto"}
                    </Badge>
                );
            }
        },
        {
            id: "actions",
            header: "Acciones",
            cell: ({ row }) => {
                const member = row.original;
                return (
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar Tarifas
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Tarifas Dinámicas ({member.user?.first_name} {member.user?.last_name})</DialogTitle>
                            </DialogHeader>
                            <div className="py-4">
                                <JsonEditor
                                    initialValue={member.ratesConfig || {}}
                                    onSave={(val) => mutation.mutate({ userId: member.userId, ratesConfig: val })}
                                    description="Estructura JSON. (ej: { particular: { base_rate: 15, is_gross: true, tax_overrides: { irpf: 0.15 } } })"
                                />
                            </div>
                        </DialogContent>
                    </Dialog>
                );
            }
        }
    ];

    return (
        <DataTable columns={columns} data={members} />
    );
}
