"use client";
export const dynamic = "force-dynamic";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUser, getUserCompanies } from "@/lib/api/users";
import { getWorkLogs, deleteWorkLog } from "@/lib/api/work-logs";
import { updateCompanyMember } from "@/lib/api/companies";
import { useParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Building2, Wallet, Database, ArrowLeft, Loader2, Sparkles, Moon, Trash2, Pencil, Shield } from "lucide-react";
import { format } from "date-fns";
import { useState, useMemo, useEffect } from "react";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { useToast } from "@/hooks/use-toast";
import { JsonEditor } from "@/components/admin/json-editor";
import { UserEditDialog } from "@/components/admin/user-edit-dialog";
import { UserCreateWorkLogDialog } from "@/components/work-log/user-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";


const numericSchema = z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? 0 : val),
    z.coerce.number().min(0)
);

const memberConfigSchema = z.object({
    role: z.string(),
    isActive: z.boolean(),
    isGross: z.boolean(),
    rates: z.record(numericSchema),
    taxOverrides: z.object({
        ss: z.preprocess(
            (val) => (val === "" || val === undefined ? null : val),
            z.coerce.number().min(0).max(100).optional().nullable()
        ),
        irpf: z.preprocess(
            (val) => (val === "" || val === undefined || val === null ? 0 : val),
            z.coerce.number().min(0).max(100)
        ),
        extra: z.preprocess(
            (val) => (val === "" || val === undefined || val === null ? 0 : val),
            z.coerce.number().min(0).max(100)
        ),
    })
});

type MemberConfigValues = z.infer<typeof memberConfigSchema>;

function CompanyMemberConfigCard({ user, company, onUpdate }: { user: any, company: any, onUpdate: () => void }) {
    const { toast } = useToast();
    const worklogDefinitions = company.worklogDefinitions || {};
    const ratesConfig = company.ratesConfig || {};

    const form = useForm<MemberConfigValues>({
        resolver: zodResolver(memberConfigSchema),
        defaultValues: {
            role: company.role || "worker",
            isActive: company.isActiveMember ?? true,
            isGross: true,
            rates: {},
            taxOverrides: {
                ss: null,
                irpf: 0,
                extra: 0,
            }
        }
    });

    useEffect(() => {
        const shiftKeys = Object.keys(worklogDefinitions);
        const initialRates: Record<string, number> = {};
        let isGross = true;
        let taxOverrides: { ss: number | null, irpf: number, extra: number } = { ss: null, irpf: 0, extra: 0 };

        let foundTaxes = false;
        for (const key of shiftKeys) {
            const shiftData = ratesConfig[key];
            if (shiftData && typeof shiftData === 'object') {
                initialRates[key] = shiftData.base_rate || 0;
                if (!foundTaxes) {
                    isGross = shiftData.is_gross !== undefined ? shiftData.is_gross : true;
                    if (shiftData.tax_overrides) {
                        taxOverrides = {
                            ss: (shiftData.tax_overrides.ss !== undefined && shiftData.tax_overrides.ss !== null) ? parseFloat((shiftData.tax_overrides.ss * 100).toFixed(4)) : null,
                            irpf: parseFloat(((shiftData.tax_overrides.irpf || 0) * 100).toFixed(4)),
                            extra: parseFloat(((shiftData.tax_overrides.extra || 0) * 100).toFixed(4)),
                        };
                        foundTaxes = true;
                    }
                }
            } else {
                initialRates[key] = 0;
            }
        }

        form.reset({
            role: company.role || "worker",
            isActive: company.isActiveMember ?? true,
            isGross,
            rates: initialRates,
            taxOverrides
        });
    }, [company, worklogDefinitions, ratesConfig, form]);

    const mutation = useMutation({
        mutationFn: (data: any) => updateCompanyMember(company.id, user.id, data),
        onSuccess: () => {
            toast({ title: "Configuración actualizada" });
            onUpdate();
        },
        onError: () => toast({ title: "Error al actualizar", variant: "destructive" })
    });

    function onSubmit(values: MemberConfigValues) {
        console.log("Submitting configuration:", values);
        const newRatesConfig: Record<string, any> = {};
        const shiftKeys = Object.keys(worklogDefinitions);

        for (const key of shiftKeys) {
            newRatesConfig[key] = {
                base_rate: Number(values.rates[key]) || 0,
                is_gross: values.isGross,
                tax_overrides: {
                    ss: values.taxOverrides.ss !== null ? Number(values.taxOverrides.ss) / 100 : null,
                    irpf: Number(values.taxOverrides.irpf) / 100,
                    extra: Number(values.taxOverrides.extra) / 100
                }
            };
        }

        mutation.mutate({
            role: values.role,
            isActive: values.isActive,
            ratesConfig: newRatesConfig
        });
    }

    const onFormError = (errors: any) => {
        console.error("Form validation errors:", errors);
        toast({
            title: "Error de validación",
            description: "Por favor, revisa los campos del formulario.",
            variant: "destructive"
        });
    };

    return (
        <Card className="border-indigo-100 dark:border-indigo-900 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between bg-indigo-50/30 dark:bg-indigo-950/10 border-b">
                <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-indigo-600" />
                    <div>
                        <CardTitle className="text-lg">{company.name}</CardTitle>
                        <CardDescription className="text-xs">ID: {company.id}</CardDescription>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant={company.isActiveMember ? 'default' : 'secondary'}>
                        {company.isActiveMember ? 'Activo' : 'Inactivo'}
                    </Badge>
                    <Badge variant="outline" className="capitalize">{company.role}</Badge>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit, onFormError)} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-1 space-y-4">
                                <h3 className="text-sm font-semibold flex items-center gap-2 text-indigo-600">
                                    <Shield className="h-4 w-4" />
                                    Membresía
                                </h3>
                                <FormField
                                    control={form.control}
                                    name="role"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Rol en Empresa</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-9">
                                                        <SelectValue placeholder="Seleccionar rol" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="worker">Trabajador</SelectItem>
                                                    <SelectItem value="manager">Gestor / Supervisor</SelectItem>
                                                    <SelectItem value="admin">Administrador Empresa</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="isActive"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-md border bg-slate-50 dark:bg-slate-900 px-3 py-2">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-sm">Usuario Activo</FormLabel>
                                                <FormDescription className="text-[10px]">Permitir registros</FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="md:col-span-2 space-y-4">
                                <h3 className="text-sm font-semibold flex items-center gap-2 text-indigo-600">
                                    <Wallet className="h-4 w-4" />
                                    Tarifas por Turno
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {Object.entries(worklogDefinitions).map(([key, def]: [string, any]) => (
                                        <FormField
                                            key={key}
                                            control={form.control}
                                            name={`rates.${key}`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs uppercase text-muted-foreground font-bold tracking-wider">{def.label}</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-2 text-muted-foreground text-xs">€</span>
                                                            <Input 
                                                                type="number" 
                                                                step="0.01" 
                                                                {...field} 
                                                                value={field.value ?? ""} 
                                                                onChange={field.onChange}
                                                                className="pl-7 h-9" 
                                                            />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 border-t pt-6">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-semibold flex items-center gap-2 text-indigo-600">
                                    <Database className="h-4 w-4" />
                                    Impuestos y Deducciones (Per-User)
                                </h3>
                                <FormField
                                    control={form.control}
                                    name="isGross"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center gap-2 space-y-0">
                                            <FormLabel className="text-xs font-bold text-muted-foreground uppercase">Sobre Bruto</FormLabel>
                                            <FormControl>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {form.watch("isGross") && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="taxOverrides.ss"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-bold text-muted-foreground">SS (%)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        step="0.0001"
                                                        placeholder="Defecto"
                                                        value={field.value ?? ""}
                                                        onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                                                        className="h-9"
                                                    />
                                                </FormControl>
                                                <FormDescription className="text-[10px]">Vacío para usar global</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="taxOverrides.irpf"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-bold text-muted-foreground">IRPF (%)</FormLabel>
                                                <FormControl>
                                                    <Input 
                                                        type="number" 
                                                        step="0.0001" 
                                                        {...field} 
                                                        value={field.value ?? ""} 
                                                        onChange={field.onChange}
                                                        className="h-9" 
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="taxOverrides.extra"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-bold text-muted-foreground">EXTRA (%)</FormLabel>
                                                <FormControl>
                                                    <Input 
                                                        type="number" 
                                                        step="0.0001" 
                                                        {...field} 
                                                        value={field.value ?? ""} 
                                                        onChange={e => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
                                                        className="h-9" 
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button type="submit" disabled={mutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all">
                                {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
                                Actualizar Configuración en {company.name}
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}

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

    // 1. Obtener todas las definiciones de campos de todas las empresas para tener etiquetas legibles
    const fieldDefinitions = useMemo(() => {
        const defs: Record<string, { label: string, icon?: any }> = {};
        companies.forEach(c => {
            if (c.worklogDefinitions) {
                Object.entries(c.worklogDefinitions).forEach(([key, val]: [string, any]) => {
                    defs[key] = { label: val.label || key };
                });
            }
        });
        // Añadir mapeos manuales para iconos conocidos
        if (defs["has_coordination"]) defs["has_coordination"].icon = Sparkles;
        if (defs["has_night"]) defs["has_night"].icon = Moon;
        return defs;
    }, [companies]);

    // 2. Identificar qué campos de extraData existen realmente en los datos actuales
    const dynamicExtraKeys = useMemo(() => {
        const keys = new Set<string>();
        workLogs.forEach(log => {
            if (log.extraData) {
                Object.keys(log.extraData).forEach(k => {
                    // Solo añadimos si tiene un valor que valga la pena mostrar
                    if (log.extraData[k] !== null && log.extraData[k] !== undefined && log.extraData[k] !== false) {
                        keys.add(k);
                    }
                });
            }
        });
        return Array.from(keys);
    }, [workLogs]);

    // 3. Construir las columnas dinámicamente
    const logColumns = useMemo<ColumnDef<any>[]>(() => {
        // Columnas Base (Siempre presentes)
        const columns: ColumnDef<any>[] = [
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
                cell: ({ row }) => {
                    const company = companies.find(c => c.id === row.original.companyId);
                    return <span>{company?.name ?? "N/A"}</span>;
                }
            },
        ];

        // Columnas Dinámicas (basadas en extraData detectado)
        dynamicExtraKeys.forEach(key => {
            const def = fieldDefinitions[key];
            const label = def?.label || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const Icon = def?.icon;

            columns.push({
                id: `extra-${key}`,
                header: label,
                cell: ({ row }) => {
                    const val = row.original.extraData?.[key];
                    if (val === null || val === undefined || val === false) return <span />;

                    if (typeof val === 'boolean') {
                        return Icon ? <Icon className="h-4 w-4 text-indigo-500" /> : <Badge variant="secondary" className="text-[10px]">Sí</Badge>;
                    }
                    
                    if (typeof val === 'object') {
                        return <span className="text-sm">{JSON.stringify(val)}</span>;
                    }
                    
                    return <span className="text-sm">{String(val)}</span>;
                }
            });
        });

        // Columnas Finales (Importe y Acciones)
        columns.push(
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={(e) => {
                            e.stopPropagation(); // Evitar que el click en borrar abra el diálogo de edición
                            handleDeleteLog(row.original.id);
                        }}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )
            }
        );

        return columns;
    }, [companies, dynamicExtraKeys, fieldDefinitions]);

    if (loadingUser) return <div className="p-8 text-center"><Loader2 className="animate-spin" /> Cargando...</div>;
    if (!user) return <div className="p-8 text-center text-red-600">Usuario no encontrado</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">{user.firstName} {user.lastName}</h1>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <p>{user.email}</p>
                        <span>•</span>
                        <Badge variant={user.isActive ? "default" : "destructive"}>{user.isActive ? "Activo" : "Inactivo"}</Badge>
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
                    <TabsTrigger value="companies">Empresas & Configuración</TabsTrigger>
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
                                searchKey="type"
                                searchPlaceholder="Buscar por tipo..."
                                onRowClick={(log) => {
                                    setSelectedLog(log);
                                    setIsEditDialogOpen(true);
                                }}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="companies" className="pt-4">
                    <div className="grid gap-8">
                        {companies.map((company) => (
                            <CompanyMemberConfigCard 
                                key={company.id}
                                user={user} 
                                company={company} 
                                onUpdate={() => queryClient.invalidateQueries({ queryKey: ["user-companies", userId] })} 
                            />
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
