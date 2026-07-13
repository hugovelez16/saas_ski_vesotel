# Detalle de Módulo y Suscripciones Inline — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar una página de detalle de módulo y gestión de suscripciones inline con diseño de doble columna en `/admin/modules/[moduleId]`, agregando el endpoint backend `GET /modules/{module_id}` y eliminando los diálogos modales para una gestión fluida.

**Architecture:**
1. **Backend:** Endpoint en `backend/routers/modules.py` para devolver un módulo específico por ID, validando rol de administrador.
2. **API Frontend:** Wrapper `getModule` en `frontend/src/lib/api/modules.ts` y actualización de `getSubscriptions` con parámetro opcional `moduleId`.
3. **Página de Detalle:** Nueva página dinámica Next.js `/admin/modules/[moduleId]/page.tsx` estructurada en un Grid de doble columna: formulario del módulo a la izquierda, listado de suscripciones y formulario de edición/creación en línea colapsable a la derecha.

**Tech Stack:** Next.js, FastAPI, SQLAlchemy, TanStack Query, Tailwind CSS, Shadcn UI / Radix UI.

## Global Constraints
* Usar `docker compose` en lugar del comando deprecado `docker-compose`.
* Respetar las convenciones de TypeScript y camelCase en el frontend.
* Asegurar que no se rompan las dependencias y que todas las pruebas pasen correctamente.

---

### Task 1: Endpoint de Consulta del Módulo Individual en Backend

**Files:**
- Modify: `backend/routers/modules.py:55-71`

**Interfaces:**
- Produces: Endpoint `GET /modules/{module_id}` que retorna `schemas.AppModuleResponse`.

- [ ] **Step 1: Agregar el endpoint `GET /modules/{module_id}` en `backend/routers/modules.py`**

Modificar `backend/routers/modules.py` añadiendo la ruta del GET para el módulo individual justo antes de la sección de suscripciones:
```python
@router.get("/{module_id}", response_model=schemas.AppModuleResponse)
def get_module(
    module_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_verified_user)
):
    """Obtiene un módulo específico por su ID (Platform Admin)."""
    _require_admin(current_user)
    module = crud.get_module_by_id(db, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Módulo no encontrado.")
    return module
```

- [ ] **Step 2: Verificar la compilación del backend**

Ejecutar:
```bash
docker compose -f docker-compose.dev.yml exec backend python -c "import main"
```
Esperado: Compila y carga exitosamente sin errores de sintaxis o de importación.

- [ ] **Step 3: Realizar commit**

```bash
git add backend/routers/modules.py
git commit -m "backend: implement GET /modules/{module_id} endpoint"
```

---

### Task 2: Wrapper API Cliente y Pruebas Unitarias del Frontend

**Files:**
- Modify: `frontend/src/lib/api/modules.ts`
- Modify: `frontend/src/__tests__/lib/api/modules.test.ts`

**Interfaces:**
- Consumes: endpoint backend `GET /modules/{module_id}`.
- Produces: `getModule` en el cliente de API de módulos, y soporte de filtro por `moduleId` en `getSubscriptions`.

- [ ] **Step 1: Modificar `frontend/src/lib/api/modules.ts`**

Agregar la función `getModule` y permitir el filtro opcional `moduleId` en `getSubscriptions`:
```typescript
export const getModule = async (moduleId: string): Promise<AppModule> => {
    const response = await api.get<AppModule>(`/modules/${moduleId}`);
    return response.data;
};
```
Actualizar `getSubscriptions` para recibir `moduleId`:
```typescript
export const getSubscriptions = async (params?: {
    companyId?: string;
    userId?: string;
    moduleId?: string;
}): Promise<ModuleSubscription[]> => {
    const response = await api.get<ModuleSubscription[]>("/modules/subscriptions", { params });
    return response.data;
};
```

- [ ] **Step 2: Modificar pruebas unitarias en `frontend/src/__tests__/lib/api/modules.test.ts`**

Añadir pruebas para verificar el funcionamiento de las llamadas de API:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/lib/api';
import { getSubscriptions, updateSubscription, getModule } from '@/lib/api/modules';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(),
        put: vi.fn(),
    },
}));

const mockedApi = vi.mocked(api);

describe('Modules API Client', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('getSubscriptions should GET /modules/subscriptions', async () => {
        (mockedApi.get as any).mockResolvedValue({ data: [] });
        await getSubscriptions({ moduleId: 'm-1' });
        expect(mockedApi.get).toHaveBeenCalledWith('/modules/subscriptions', { params: { moduleId: 'm-1' } });
    });

    it('getModule should GET /modules/:id', async () => {
        (mockedApi.get as any).mockResolvedValue({ data: { id: 'm-1', name: 'Test' } });
        const res = await getModule('m-1');
        expect(mockedApi.get).toHaveBeenCalledWith('/modules/m-1');
        expect(res.name).toBe('Test');
    });

    it('updateSubscription should PUT /modules/subscriptions/:id', async () => {
        (mockedApi.put as any).mockResolvedValue({ data: {} });
        await updateSubscription('sub-1', { status: 'cancelled' });
        expect(mockedApi.put).toHaveBeenCalledWith('/modules/subscriptions/sub-1', { status: 'cancelled' });
    });
});
```

- [ ] **Step 3: Ejecutar pruebas unitarias**

Ejecutar:
```bash
docker compose -f docker-compose.dev.yml exec frontend npm run test -- --run
```
Esperado: Suite de pruebas pasa con éxito.

- [ ] **Step 4: Realizar commit**

```bash
git add frontend/src/lib/api/modules.ts frontend/src/__tests__/lib/api/modules.test.ts
git commit -m "frontend: implement getModule API wrapper and update test suite"
```

---

### Task 3: Nueva Página de Detalle: Estructura y Formulario de Edición

**Files:**
- Create: `frontend/src/app/(app)/admin/modules/[moduleId]/page.tsx`

**Interfaces:**
- Consumes: `getModule` y `updateModule` de `frontend/src/lib/api/modules.ts`.
- Produces: Layout responsivo y formulario de datos del módulo (Nombre, Descripción, Alcance, Precio, Estado Activo) con guardado directo.

- [ ] **Step 1: Crear la página de detalles en `frontend/src/app/(app)/admin/modules/[moduleId]/page.tsx`**

Crear el archivo con el layout base de dos columnas y el formulario de edición en la columna izquierda:
```tsx
"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getModule, updateModule } from "@/lib/api/modules";
import { getSubscriptions, createSubscription, updateSubscription } from "@/lib/api/modules";
import { getCompanies } from "@/lib/api/companies";
import { getUsers } from "@/lib/api/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Package, Sparkles, Building2, User, Layers, Calendar, Edit2, Check, X, ShieldAlert } from "lucide-react";
import { SubscriptionBadge } from "@/components/modules/SubscriptionBadge";
import { ModuleSubscription } from "@/lib/types";

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
        mutationFn: (data: any) => updateModule(moduleId, data),
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

    const scopeIcons = {
        company: Building2,
        user: User,
        both: Layers,
    };
    const ScopeIcon = scopeIcons[moduleForm.targetScope] ?? Layers;

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
                                        onValueChange={(v: any) => setModuleForm(p => ({ ...p, targetScope: v }))}
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
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Ejecutar comprobación estática de tipos en frontend**

Ejecutar:
```bash
docker compose -f docker-compose.dev.yml exec frontend npx tsc --noEmit
```
Esperado: Sin errores de compilación de TypeScript.

- [ ] **Step 3: Realizar commit**

```bash
git add frontend/src/app/\(app\)/admin/modules/\[moduleId\]/page.tsx
git commit -m "frontend: create module details page skeleton and edit form"
```

---

### Task 4: Panel de Suscripciones Inline Colapsable y Listado

**Files:**
- Modify: `frontend/src/app/(app)/admin/modules/[moduleId]/page.tsx`

**Interfaces:**
- Consumes: `getSubscriptions`, `createSubscription`, `updateSubscription` de `frontend/src/lib/api/modules.ts`, `getCompanies` de `companies.ts`, y `getUsers` de `users.ts`.
- Produces: Listado completo de suscripciones con formulario de creación/edición inline colapsable y confirmaciones de cancelación.

- [ ] **Step 1: Modificar `frontend/src/app/(app)/admin/modules/[moduleId]/page.tsx` para agregar la gestión de suscripciones**

Reemplazar la sección del componente e implementar los estados, efectos y layouts requeridos para las suscripciones inline en la columna derecha:
```tsx
"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getModule, updateModule } from "@/lib/api/modules";
import { getSubscriptions, createSubscription, updateSubscription } from "@/lib/api/modules";
import { getCompanies } from "@/lib/api/companies";
import { getUsers } from "@/lib/api/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Package, Sparkles, Building2, User, Layers, Calendar, Edit2, Check, X, ShieldAlert, PlusCircle } from "lucide-react";
import { SubscriptionBadge } from "@/components/modules/SubscriptionBadge";
import { ModuleSubscription } from "@/lib/types";

export default function ModuleDetailPage({ params }: { params: Promise<{ moduleId: string }> }) {
    const { moduleId } = use(params);
    const router = useRouter();
    const queryClient = useQueryClient();

    // ─── Form States ────────────────────────────────────────────────────────
    const [moduleForm, setModuleForm] = useState({
        name: "",
        description: "",
        targetScope: "both" as "company" | "user" | "both",
        priceMonthly: "" as string | number,
        isActive: true,
    });

    const [showSubForm, setShowSubForm] = useState(false);
    const [editingSub, setEditingSub] = useState<ModuleSubscription | null>(null);

    const [subForm, setSubForm] = useState({
        scope: "company" as "company" | "user",
        targetId: "",
        status: "active",
        expiresAt: "",
        notes: "",
    });

    // Helper para fechas seguras
    const parseDate = (dStr: string) => {
        if (!dStr) return null;
        const d = new Date(dStr);
        return isNaN(d.getTime()) ? null : d.toISOString();
    };

    // ─── Queries ────────────────────────────────────────────────────────────
    const { data: module, isLoading: loadingModule } = useQuery({
        queryKey: ["modules", moduleId],
        queryFn: () => getModule(moduleId),
    });

    const { data: subscriptions = [] } = useQuery({
        queryKey: ["subscriptions", { moduleId }],
        queryFn: () => getSubscriptions({ moduleId }),
    });

    const { data: companies = [] } = useQuery({
        queryKey: ["companies"],
        queryFn: getCompanies,
    });

    const { data: users = [] } = useQuery({
        queryKey: ["users"],
        queryFn: getUsers,
    });

    // Sincronizar formulario de módulo
    useEffect(() => {
        if (module) {
            setModuleForm({
                name: module.name,
                description: module.description || "",
                targetScope: module.targetScope,
                priceMonthly: module.priceMonthly != null ? module.priceMonthly : "",
                isActive: module.isActive,
            });
        }
    }, [module]);

    // ─── Mutations ──────────────────────────────────────────────────────────
    const updateModuleMutation = useMutation({
        mutationFn: (data: any) => updateModule(moduleId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["modules"] });
            toast.success("Módulo actualizado correctamente.");
        },
        onError: () => toast.error("Error al actualizar el módulo."),
    });

    const addSubMutation = useMutation({
        mutationFn: createSubscription,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["subscriptions", { moduleId }] });
            setShowSubForm(false);
            setSubForm({ scope: "company", targetId: "", status: "active", expiresAt: "", notes: "" });
            toast.success("Suscripción registrada correctamente.");
        },
        onError: () => toast.error("Error al registrar la suscripción."),
    });

    const editSubMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateSubscription(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["subscriptions", { moduleId }] });
            setEditingSub(null);
            setShowSubForm(false);
            setSubForm({ scope: "company", targetId: "", status: "active", expiresAt: "", notes: "" });
            toast.success("Suscripción actualizada correctamente.");
        },
        onError: () => toast.error("Error al actualizar la suscripción."),
    });

    const cancelSubMutation = useMutation({
        mutationFn: (id: string) => updateSubscription(id, { status: "cancelled" }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["subscriptions", { moduleId }] });
            toast.success("Suscripción cancelada.");
        },
        onError: () => toast.error("Error al cancelar la suscripción."),
    });

    // ─── Handlers ───────────────────────────────────────────────────────────
    const handleSaveModule = () => {
        updateModuleMutation.mutate({
            name: moduleForm.name,
            description: moduleForm.description,
            targetScope: moduleForm.targetScope,
            priceMonthly: moduleForm.priceMonthly !== "" ? Number(moduleForm.priceMonthly) : null,
            isActive: moduleForm.isActive,
        });
    };

    const handleSaveSubscription = () => {
        if (!subForm.targetId && !editingSub) {
            toast.error("Por favor, selecciona una entidad para la suscripción.");
            return;
        }

        if (editingSub) {
            editSubMutation.mutate({
                id: editingSub.id,
                data: {
                    status: subForm.status,
                    expiresAt: parseDate(subForm.expiresAt),
                    notes: subForm.notes,
                },
            });
        } else {
            addSubMutation.mutate({
                moduleId,
                scope: subForm.scope,
                companyId: subForm.scope === "company" ? subForm.targetId : undefined,
                userId: subForm.scope === "user" ? subForm.targetId : undefined,
                status: subForm.status,
                expiresAt: subForm.expiresAt ? new Date(subForm.expiresAt).toISOString() : undefined,
                notes: subForm.notes || undefined,
            });
        }
    };

    const handleOpenEditSub = (sub: ModuleSubscription) => {
        setEditingSub(sub);
        setSubForm({
            scope: sub.scope,
            targetId: sub.scope === "company" ? (sub.companyId || "") : (sub.userId || ""),
            status: sub.status,
            expiresAt: sub.expiresAt ? sub.expiresAt.substring(0, 10) : "",
            notes: sub.notes || "",
        });
        setShowSubForm(true);
    };

    const getAssigneeName = (sub: ModuleSubscription) => {
        if (sub.scope === "company") {
            return sub.company?.name ?? (sub.companyId ? `Empresa: ${sub.companyId.substring(0, 8)}...` : "Empresa sin ID");
        } else {
            const u = sub.user;
            if (!u) {
                return sub.userId ? `Usuario: ${sub.userId.substring(0, 8)}...` : "Usuario sin ID";
            }
            const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim();
            return fullName ? `${fullName} (${u.email})` : u.email;
        }
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

    const scopeIcons = {
        company: Building2,
        user: User,
        both: Layers,
    };
    const ScopeIcon = scopeIcons[moduleForm.targetScope] ?? Layers;

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
                                        onValueChange={(v: any) => setModuleForm(p => ({ ...p, targetScope: v }))}
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

                {/* Columna Derecha: Gestión de Suscripciones */}
                <div className="lg:col-span-7 space-y-6">
                    <Card className="border-slate-200/80 bg-white">
                        <CardHeader className="flex flex-row justify-between items-center pb-4 border-b border-slate-100">
                            <div>
                                <CardTitle className="text-base font-bold text-slate-800">Suscripciones Asignadas</CardTitle>
                                <CardDescription className="text-xs">Control de accesos y licencias activas para este módulo</CardDescription>
                            </div>
                            <Button
                                size="sm"
                                disabled={!module.isActive || showSubForm}
                                onClick={() => {
                                    const defaultScope = moduleForm.targetScope === "both" ? "company" : moduleForm.targetScope;
                                    setEditingSub(null);
                                    setSubForm({ scope: defaultScope, targetId: "", status: "active", expiresAt: "", notes: "" });
                                    setShowSubForm(true);
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"
                            >
                                <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                                Añadir Suscripción
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-5">
                            {/* Formulario Inline Colapsable */}
                            {showSubForm && (
                                <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-4 transition-all duration-300">
                                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                            {editingSub ? "Editar Suscripción" : "Nueva Suscripción"}
                                        </h3>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setShowSubForm(false)}
                                            className="h-6 w-6 text-slate-400 hover:text-slate-600 rounded-md"
                                        >
                                            <X className="h-4.5 w-4.5" />
                                        </Button>
                                    </div>
                                    <div className="space-y-3">
                                        {/* Scope Select - Solo si el alcance general es 'both' y es creación */}
                                        {moduleForm.targetScope === "both" && !editingSub && (
                                            <div className="space-y-1">
                                                <Label className="text-xs font-bold text-slate-600">Tipo de suscripción</Label>
                                                <Select
                                                    value={subForm.scope}
                                                    onValueChange={(v: any) => setSubForm(p => ({ ...p, scope: v, targetId: "" }))}
                                                >
                                                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="company">Empresa</SelectItem>
                                                        <SelectItem value="user">Usuario</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}

                                        {/* Target Entity Selector - Solo en creación, en edición se muestra lectura */}
                                        {!editingSub ? (
                                            <div className="space-y-1">
                                                <Label className="text-xs font-bold text-slate-600">
                                                    {subForm.scope === "company" ? "Seleccionar Empresa" : "Seleccionar Usuario"}
                                                </Label>
                                                {subForm.scope === "company" ? (
                                                    <Select
                                                        value={subForm.targetId}
                                                        onValueChange={v => setSubForm(p => ({ ...p, targetId: v }))}
                                                    >
                                                        <SelectTrigger className="bg-white focus:ring-indigo-500">
                                                            <SelectValue placeholder="Selecciona una empresa..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {companies.map(c => (
                                                                <SelectItem key={c.id} value={c.id}>
                                                                    {c.name} {c.fiscalId ? `(${c.fiscalId})` : ""}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <Select
                                                        value={subForm.targetId}
                                                        onValueChange={v => setSubForm(p => ({ ...p, targetId: v }))}
                                                    >
                                                        <SelectTrigger className="bg-white focus:ring-indigo-500">
                                                            <SelectValue placeholder="Selecciona un usuario..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {users.map(u => (
                                                                <SelectItem key={u.id} value={u.id}>
                                                                    {u.firstName || u.lastName ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : u.email} ({u.email})
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </div>
                                        ) : (
                                            <div>
                                                <Label className="text-xs font-bold text-slate-500">Asignada a</Label>
                                                <div className="text-xs font-semibold border border-slate-200/60 rounded-lg px-3 py-2 bg-slate-100 text-slate-600 mt-1">
                                                    {getAssigneeName(editingSub)}
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label className="text-xs font-bold text-slate-600">Estado</Label>
                                                <Select
                                                    value={subForm.status}
                                                    onValueChange={v => setSubForm(p => ({ ...p, status: v }))}
                                                >
                                                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="active">Activo</SelectItem>
                                                        <SelectItem value="trial">Trial</SelectItem>
                                                        {editingSub && <SelectItem value="expired">Expirado</SelectItem>}
                                                        {editingSub && <SelectItem value="cancelled">Cancelado</SelectItem>}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs font-bold text-slate-600">Fecha expiración (opcional)</Label>
                                                <Input
                                                    type="date"
                                                    value={subForm.expiresAt}
                                                    onChange={e => setSubForm(p => ({ ...p, expiresAt: e.target.value }))}
                                                    className="bg-white focus-visible:ring-indigo-500"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-xs font-bold text-slate-600">Notas (opcional)</Label>
                                            <Input
                                                placeholder="Notas de soporte, Stripe ID, etc..."
                                                value={subForm.notes}
                                                onChange={e => setSubForm(p => ({ ...p, notes: e.target.value }))}
                                                className="bg-white focus-visible:ring-indigo-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setShowSubForm(false)}
                                            className="text-xs"
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleSaveSubscription}
                                            disabled={addSubMutation.isPending || editSubMutation.isPending}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"
                                        >
                                            {addSubMutation.isPending || editSubMutation.isPending ? "Guardando..." : "Guardar Suscripción"}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Listado de Suscripciones */}
                            <div className="space-y-2.5">
                                {subscriptions.length > 0 ? (
                                    subscriptions.map(sub => (
                                        <div key={sub.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/40 p-3 hover:bg-slate-50 transition-colors">
                                            <div className="flex flex-col gap-1 min-w-0 flex-1 mr-2">
                                                <div className="flex items-center gap-2">
                                                    <SubscriptionBadge status={sub.status} />
                                                    <span className="text-xs font-semibold text-slate-700 truncate" title={getAssigneeName(sub)}>
                                                        {getAssigneeName(sub)}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-slate-500 font-medium">
                                                    {sub.expiresAt
                                                        ? `Expira: ${new Date(sub.expiresAt).toLocaleDateString("es-ES")}`
                                                        : "Permanente"}
                                                    {sub.notes && ` • ${sub.notes}`}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={showSubForm}
                                                    onClick={() => handleOpenEditSub(sub)}
                                                    className="h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/60 rounded-md"
                                                    title="Editar suscripción"
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </Button>
                                                {sub.status !== "cancelled" && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            const name = getAssigneeName(sub);
                                                            if (window.confirm(`¿Estás seguro de que deseas cancelar la suscripción de "${name}"?`)) {
                                                                cancelSubMutation.mutate(sub.id);
                                                            }
                                                        }}
                                                        className="h-7 text-[11px] font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50/60 rounded-md"
                                                    >
                                                        Cancelar
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-slate-400 text-sm">
                                        No hay suscripciones registradas para este módulo.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Ejecutar linting y chequeo de tipos**

Ejecutar:
```bash
docker compose -f docker-compose.dev.yml exec frontend npm run lint
```
Esperado: Sin advertencias ni errores.

- [ ] **Step 3: Realizar commit**

```bash
git add frontend/src/app/\(app\)/admin/modules/\[moduleId\]/page.tsx
git commit -m "frontend: implement inline subscription creation and editing panel in module details page"
```
