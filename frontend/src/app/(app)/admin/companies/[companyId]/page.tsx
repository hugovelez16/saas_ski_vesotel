"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCompaniesDetailed, updateMemberStatus, updateCompanyMember, notifyCompanyMember, getCompanyRates, updateCompany } from "@/lib/api/companies";
import { useParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Check, X, Shield, Mail, Loader2, Settings, Database, Pencil, FileJson, FileCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddMemberDialog } from "@/components/admin/add-member-dialog";
import { CompanyConfigurationTab } from "@/components/admin/company-configuration-tab";
import { MemberSettingsDialog } from "@/components/admin/member-settings-dialog";
import { useAuth } from "@/context/AuthContext";
import { CompanyMember, UserCompanyRate } from "@/lib/types";
import { DailyReportView } from "@/components/admin/daily-report-view";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { JsonEditor } from "@/components/admin/json-editor";
import { TaxConfigBuilder } from "@/components/admin/tax-config-builder";
import { WorklogDefinitionBuilder } from "@/components/admin/worklog-definition-builder";
import { UserRatesEditDialog } from "@/components/admin/user-rates-edit-dialog";

export default function CompanyDetailsPage() {
    const { user } = useAuth();
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
                    {user?.role === 'admin' && (
                        <AddMemberDialog companyId={companyId as string} companyName={company.name} existingMembers={company.members} />
                    )}
                </div>
            </div>

            <Tabs defaultValue="workers" className="w-full">
                <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                    <TabsTrigger value="workers">Trabajadores ({workers.length})</TabsTrigger>
                    <TabsTrigger value="supervisors">Supervisores ({supervisors.length})</TabsTrigger>
                    <TabsTrigger value="taxes">Tasas & IRPF</TabsTrigger>
                    <TabsTrigger value="settings">Ajustes UI</TabsTrigger>
                    {user?.role === 'admin' && (
                        <TabsTrigger value="master" className="text-indigo-600 font-bold border-l-2 border-indigo-200 ml-2">
                            <Database className="h-4 w-4 mr-2" />
                            Master Config
                        </TabsTrigger>
                    )}
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
                            <TaxOverview company={company} isAdmin={user?.role === 'admin'} />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* MASTER CONFIG TAB */}
                {user?.role === 'admin' && (
                    <TabsContent value="master" className="pt-4">
                        <MasterConfigPanel company={company} onSave={(data) => updateCompanyMutation.mutate(data)} />
                    </TabsContent>
                )}

                {/* UI SETTINGS TAB */}
                <TabsContent value="settings" className="pt-4">
                    <CompanyConfigurationTab company={company} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function MasterConfigPanel({ company, onSave }: { company: any, onSave: (data: any) => void }) {
    const [activeTab, setActiveTab] = React.useState<'tax' | 'worklog' | 'settings'>('settings');

    const tabs = [
        { id: 'settings', label: 'settings.json', icon: <FileJson className="h-4 w-4" />, description: 'Ajustes y Módulos' },
        { id: 'worklog', label: 'worklog_definitions.json', icon: <FileCode className="h-4 w-4" />, description: 'Definiciones de Jornada' },
        { id: 'tax', label: 'tax_config.json', icon: <Database className="h-4 w-4" />, description: 'Esquema de Impuestos' },
    ];

    const activeConfig = tabs.find(t => t.id === activeTab);

    return (
        <Card className="border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden bg-slate-950">
            <div className="flex flex-col lg:flex-row min-h-[600px]">
                {/* SIDEBAR */}
                <div className="w-full lg:w-64 bg-slate-900 border-r border-slate-800 p-2 flex flex-col gap-1">
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Explorer</div>
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-all ${
                                activeTab === tab.id 
                                ? "bg-slate-800 text-indigo-400 border-l-2 border-indigo-500" 
                                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* EDITOR AREA */}
                <div className="flex-1 flex flex-col bg-slate-950">
                    {/* BREADCRUMB / TAB HEADER */}
                    <div className="bg-slate-900/50 border-b border-slate-800 px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="opacity-50">companies</span>
                            <span>/</span>
                            <span className="opacity-50">{company.name.toLowerCase().replace(/\s+/g, '_')}</span>
                            <span>/</span>
                            <span className="text-slate-200 font-medium">{activeConfig?.label}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-500">
                            JSON Editor
                        </Badge>
                    </div>

                    <div className="p-6 flex-1 flex flex-col">
                        <div className="mb-6">
                            <h2 className="text-slate-100 font-bold flex items-center gap-2">
                                {activeConfig?.icon}
                                {activeConfig?.description}
                            </h2>
                            <p className="text-slate-500 text-xs mt-1">
                                Edición directa del campo <code className="text-indigo-400">{activeConfig?.id}</code> en la base de datos.
                            </p>
                        </div>

                        <div className="flex-1">
                            {activeTab === 'tax' && (
                                <JsonEditor 
                                    initialValue={company.taxConfig} 
                                    onSave={(val) => onSave({ taxConfig: val })}
                                    rows={20}
                                />
                            )}
                            {activeTab === 'worklog' && (
                                <JsonEditor 
                                    initialValue={company.worklogDefinitions} 
                                    onSave={(val) => onSave({ worklogDefinitions: val })}
                                    rows={20}
                                />
                            )}
                            {activeTab === 'settings' && (
                                <JsonEditor 
                                    initialValue={company.settings} 
                                    onSave={(val) => onSave({ settings: val })}
                                    rows={20}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}

function TaxOverview({ company, isAdmin }: { company: any, isAdmin?: boolean }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [editingMember, setEditingMember] = React.useState<UserCompanyRate | null>(null);

    const { data: members = [], isLoading } = useQuery({
        queryKey: ["companyRates", company.id],
        queryFn: () => getCompanyRates(company.id),
    });

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    const columns: ColumnDef<UserCompanyRate>[] = [
        {
            accessorKey: "user",
            header: "Miembro",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{row.original.user?.first_name} {row.original.user?.last_name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase font-mono">{row.original.user?.email}</span>
                </div>
            )
        },
        {
            id: "rates",
            header: "Tarifas (€)",
            cell: ({ row }) => {
                const r = row.original;
                return (
                    <div className="flex flex-wrap gap-2 text-[11px]">
                        {r.hourlyRate > 0 && <span className="flex items-center bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">H: <b className="ml-1">{r.hourlyRate}€</b></span>}
                        {r.dailyRate > 0 && <span className="flex items-center bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">D: <b className="ml-1">{r.dailyRate}€</b></span>}
                        {r.nightRate > 0 && <span className="flex items-center bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 px-2 py-0.5 rounded border border-sky-200/50 dark:border-sky-800/50">N: <b className="ml-1">{r.nightRate}€</b></span>}
                        {r.coordinationRate > 0 && <span className="flex items-center bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-200/50 dark:border-indigo-800/50">C: <b className="ml-1">{r.coordinationRate}€</b></span>}
                        {r.hourlyRate === 0 && r.dailyRate === 0 && r.nightRate === 0 && r.coordinationRate === 0 && (
                            <span className="text-muted-foreground italic">Sin tarifas</span>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: "isGross",
            header: "Tipo",
            cell: ({ row }) => (
                <Badge variant={row.original.isGross ? "default" : "outline"} className={row.original.isGross ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20" : "text-slate-500"}>
                    {row.original.isGross ? "Sobre Bruto" : "Sobre Neto"}
                </Badge>
            )
        },
        {
            id: "deductions",
            header: "Deducciones (%)",
            cell: ({ row }) => {
                const r = row.original;
                return (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
                        <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">SS</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1 rounded">{(r.deductionSs ?? 0) * 100}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">IRPF</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1 rounded">{(r.deductionIrpf ?? 0) * 100}%</span>
                        </div>
                        {(r.deductionExtra || 0) !== 0 && (
                            <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">EXTRA</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300 bg-amber-100 dark:bg-amber-900/30 px-1 rounded">{(r.deductionExtra ?? 0) * 100}%</span>
                            </div>
                        )}
                    </div>
                );
            }
        }
    ];

    return (
        <div className="relative">
            <DataTable 
                columns={columns} 
                data={members} 
                onRowClick={isAdmin ? (row) => setEditingMember(row) : undefined}
            />
            {editingMember && (
                <UserRatesEditDialog
                    open={!!editingMember}
                    onOpenChange={(open) => !open && setEditingMember(null)}
                    userId={editingMember.userId}
                    company={company}
                    rate={editingMember}
                    userName={`${editingMember.user?.first_name} ${editingMember.user?.last_name}`}
                />
            )}
        </div>
    );
}
