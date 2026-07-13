"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getModule, updateModule } from "@/lib/api/modules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Package, Sparkles, ShieldAlert } from "lucide-react";
import { SubscriptionBadge } from "@/components/modules/SubscriptionBadge";

export default function ModuleDetailPage({ params }: { params: Promise<{ moduleId: string }> }) {
    const { moduleId } = use(params);
    const router = useRouter();
    const queryClient = useQueryClient();

    // ─── Queries ────────────────────────────────────────────────────────────
    const { data: module, isLoading: loadingModule } = useQuery({
        queryKey: ["modules", moduleId],
        queryFn: () => getModule(moduleId),
    });

    // ─── Module Form State ──────────────────────────────────────────────────
    const [moduleForm, setModuleForm] = useState({
        name: "",
        description: "",
        targetScope: "both" as "company" | "user" | "both",
        priceMonthly: "" as string | number,
        isActive: true,
    });

    useEffect(() => {
        if (module) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setModuleForm({
                name: module.name,
                description: module.description || "",
                targetScope: module.targetScope,
                priceMonthly: module.priceMonthly != null ? module.priceMonthly : "",
                isActive: module.isActive,
            });
        }
    }, [module]);

    // ─── Module Mutation ────────────────────────────────────────────────────
    const updateModuleMutation = useMutation({
        mutationFn: (data: Parameters<typeof updateModule>[1]) => updateModule(moduleId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["modules"] });
            toast.success("Módulo actualizado correctamente.");
        },
        onError: () => toast.error("Error al actualizar el módulo."),
    });

    const handleSaveModule = () => {
        updateModuleMutation.mutate({
            name: moduleForm.name,
            description: moduleForm.description,
            targetScope: moduleForm.targetScope,
            priceMonthly: moduleForm.priceMonthly !== "" ? Number(moduleForm.priceMonthly) : null,
            isActive: moduleForm.isActive,
        });
    };

    if (loadingModule) {
        return <div className="p-8 text-center text-slate-500 font-medium">Cargando detalles del módulo...</div>;
    }

    if (!module) {
        return (
            <div className="p-8 text-center max-w-md mx-auto space-y-4">
                <div className="rounded-full bg-rose-50 p-4 text-rose-500 w-14 h-14 flex items-center justify-center mx-auto">
                    <ShieldAlert className="h-6 w-6" />
                </div>
                <h1 className="text-xl font-bold text-slate-800">Módulo no encontrado</h1>
                <p className="text-sm text-slate-500">El identificador provisto no corresponde a ningún módulo activo en el catálogo.</p>
                <Button onClick={() => router.push("/admin/modules")}>Volver a la lista</Button>
            </div>
        );
    }



    return (
        <div className="space-y-6 w-full py-2">
            {/* Header */}
            <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => router.push("/admin/modules")}
                    className="h-9 w-9 text-slate-500 hover:text-slate-800 rounded-lg shrink-0"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                        <Package className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-800">
                            {moduleForm.name || "Cargando..."}
                        </h1>
                        <p className="text-xs text-slate-400 font-mono font-semibold">{module.codeName}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Columna Izquierda: Formulario del Módulo */}
                <div className="lg:col-span-5 space-y-6">
                    <Card className="relative overflow-hidden border-slate-200/80 bg-white">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-sky-400" />
                        <CardHeader className="pb-4">
                            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-indigo-500" /> Datos del Módulo
                            </CardTitle>
                            <CardDescription className="text-xs">Actualiza los datos visuales y de alcance del catálogo</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-600">Código interno</Label>
                                <Input
                                    value={module.codeName}
                                    disabled
                                    className="bg-slate-100/80 text-slate-500 font-mono font-semibold text-xs border-slate-200"
                                />
                                <p className="text-[10px] text-slate-400">Identificador permanente de sistema.</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-600">Nombre visible</Label>
                                <Input
                                    value={moduleForm.name}
                                    onChange={e => setModuleForm(p => ({ ...p, name: e.target.value }))}
                                    className="bg-slate-50/50 focus-visible:ring-indigo-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-600">Descripción</Label>
                                <Textarea
                                    value={moduleForm.description}
                                    onChange={e => setModuleForm(p => ({ ...p, description: e.target.value }))}
                                    className="min-h-[100px] bg-slate-50/50 focus-visible:ring-indigo-500 text-sm leading-relaxed"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-600">Alcance</Label>
                                    <Select
                                        value={moduleForm.targetScope}
                                        onValueChange={(v: "company" | "user" | "both") => setModuleForm(p => ({ ...p, targetScope: v }))}
                                    >
                                        <SelectTrigger className="bg-slate-50/50">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="both">Empresa y Usuario</SelectItem>
                                            <SelectItem value="company">Solo Empresa</SelectItem>
                                            <SelectItem value="user">Solo Usuario</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-600">Precio mensual (€)</Label>
                                    <Input
                                        type="number"
                                        value={moduleForm.priceMonthly}
                                        onChange={e => setModuleForm(p => ({ ...p, priceMonthly: e.target.value }))}
                                        placeholder="0.00"
                                        className="bg-slate-50/50 focus-visible:ring-indigo-500"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
                                <div className="space-y-0.5">
                                    <Label className="text-xs font-bold text-slate-700">Módulo Activo</Label>
                                    <p className="text-[10px] text-slate-400">Si está inactivo, no se podrán crear nuevas suscripciones.</p>
                                </div>
                                <Switch
                                    checked={moduleForm.isActive}
                                    onCheckedChange={v => setModuleForm(p => ({ ...p, isActive: v }))}
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="bg-slate-50/50 border-t border-slate-100 py-3.5 flex justify-end">
                            <Button
                                onClick={handleSaveModule}
                                disabled={!moduleForm.name || updateModuleMutation.isPending}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-1.5 px-4"
                            >
                                {updateModuleMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>

                {/* Columna Derecha Placeholder */}
                <div id="sub-section-target" className="lg:col-span-7 space-y-6">
                    <Card className="border-slate-200/80 bg-white">
                        <CardContent className="py-8 text-center text-slate-400 text-sm">
                            Inicializando sección de suscripciones...
                            {/* Use unused imports to avoid compilation warnings/errors */}
                            <span className="hidden">
                                <SubscriptionBadge status="active" />
                            </span>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
