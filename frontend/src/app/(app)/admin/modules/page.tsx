"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getModules, getSubscriptions, createModule, updateModule, createSubscription, updateSubscription, deleteSubscription } from "@/lib/api/modules";
import { AppModule, ModuleSubscription } from "@/lib/types";
import { ModuleCard } from "@/components/modules/ModuleCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PlusCircle, Package } from "lucide-react";

export default function AdminModulesPage() {
    const queryClient = useQueryClient();
    const [showCreateModule, setShowCreateModule] = useState(false);
    const [showAddSubscription, setShowAddSubscription] = useState<AppModule | null>(null);

    // ─── Queries ────────────────────────────────────────────────────────────
    const { data: modules = [] } = useQuery({
        queryKey: ["modules", "all"],
        queryFn: () => getModules(true), // include_inactive = true for admin
    });

    const { data: subscriptions = [] } = useQuery({
        queryKey: ["subscriptions"],
        queryFn: () => getSubscriptions(),
    });

    // ─── Mutations ──────────────────────────────────────────────────────────
    const createModuleMutation = useMutation({
        mutationFn: createModule,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["modules"] });
            setShowCreateModule(false);
            toast.success("Módulo creado correctamente.");
        },
        onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error al crear el módulo."),
    });

    const cancelSubMutation = useMutation({
        mutationFn: (sub: ModuleSubscription) => updateSubscription(sub.id, { status: "cancelled" }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
            toast.success("Suscripción cancelada.");
        },
        onError: () => toast.error("Error al cancelar la suscripción."),
    });

    const addSubMutation = useMutation({
        mutationFn: createSubscription,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
            setShowAddSubscription(null);
            toast.success("Suscripción creada correctamente.");
        },
        onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error al crear la suscripción."),
    });

    // ─── Create Module Form State ────────────────────────────────────────────
    const [newModule, setNewModule] = useState({ codeName: "", name: "", description: "", targetScope: "both" });

    // ─── Add Subscription Form State ────────────────────────────────────────
    const [newSub, setNewSub] = useState({ scope: "company", targetId: "", status: "active", expiresAt: "", notes: "" });

    const subsForModule = (moduleId: string) =>
        subscriptions.filter(s => s.moduleId === moduleId);

    return (
        <div className="container py-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Package className="h-6 w-6 text-primary" />
                    <div>
                        <h1 className="text-2xl font-bold">Gestión de Módulos</h1>
                        <p className="text-sm text-muted-foreground">Catálogo de funcionalidades y suscripciones activas</p>
                    </div>
                </div>
                <Button onClick={() => setShowCreateModule(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nuevo Módulo
                </Button>
            </div>

            {/* Module Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {modules.map(module => (
                    <ModuleCard
                        key={module.id}
                        module={module}
                        subscriptions={subsForModule(module.id)}
                        onAddSubscription={(m) => setShowAddSubscription(m)}
                        onCancelSubscription={(sub) => cancelSubMutation.mutate(sub)}
                    />
                ))}
            </div>

            {/* Create Module Dialog */}
            <Dialog open={showCreateModule} onOpenChange={setShowCreateModule}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nuevo Módulo</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Código interno</Label>
                            <Input
                                placeholder="export_pdf"
                                value={newModule.codeName}
                                onChange={e => setNewModule(p => ({ ...p, codeName: e.target.value }))}
                            />
                            <p className="text-xs text-muted-foreground mt-1">Snake_case, sin espacios. Es permanente.</p>
                        </div>
                        <div>
                            <Label>Nombre visible</Label>
                            <Input
                                placeholder="Exportación a PDF"
                                value={newModule.name}
                                onChange={e => setNewModule(p => ({ ...p, name: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label>Descripción</Label>
                            <Textarea
                                value={newModule.description}
                                onChange={e => setNewModule(p => ({ ...p, description: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label>Alcance</Label>
                            <Select value={newModule.targetScope} onValueChange={v => setNewModule(p => ({ ...p, targetScope: v }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="both">Empresa y Usuario</SelectItem>
                                    <SelectItem value="company">Solo Empresa</SelectItem>
                                    <SelectItem value="user">Solo Usuario</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateModule(false)}>Cancelar</Button>
                        <Button
                            onClick={() => createModuleMutation.mutate(newModule)}
                            disabled={!newModule.codeName || !newModule.name || createModuleMutation.isPending}
                        >
                            Crear Módulo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Subscription Dialog */}
            <Dialog open={!!showAddSubscription} onOpenChange={() => setShowAddSubscription(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Añadir Suscripción — {showAddSubscription?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Tipo de suscripción</Label>
                            <Select value={newSub.scope} onValueChange={v => setNewSub(p => ({ ...p, scope: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="company">Empresa (por ID)</SelectItem>
                                    <SelectItem value="user">Usuario (por ID)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>{newSub.scope === "company" ? "ID de Empresa" : "ID de Usuario"}</Label>
                            <Input
                                placeholder="UUID..."
                                value={newSub.targetId}
                                onChange={e => setNewSub(p => ({ ...p, targetId: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label>Estado</Label>
                            <Select value={newSub.status} onValueChange={v => setNewSub(p => ({ ...p, status: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Activo</SelectItem>
                                    <SelectItem value="trial">Trial</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Fecha de expiración (opcional)</Label>
                            <Input
                                type="date"
                                value={newSub.expiresAt}
                                onChange={e => setNewSub(p => ({ ...p, expiresAt: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label>Notas (opcional)</Label>
                            <Input
                                placeholder="Regalo, Pago Stripe #123..."
                                value={newSub.notes}
                                onChange={e => setNewSub(p => ({ ...p, notes: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddSubscription(null)}>Cancelar</Button>
                        <Button
                            onClick={() => {
                                if (!showAddSubscription || !newSub.targetId) return;
                                addSubMutation.mutate({
                                    moduleId: showAddSubscription.id,
                                    scope: newSub.scope,
                                    companyId: newSub.scope === "company" ? newSub.targetId : undefined,
                                    userId: newSub.scope === "user" ? newSub.targetId : undefined,
                                    status: newSub.status,
                                    expiresAt: newSub.expiresAt || undefined,
                                    notes: newSub.notes || undefined,
                                });
                            }}
                            disabled={!newSub.targetId || addSubMutation.isPending}
                        >
                            Crear Suscripción
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
