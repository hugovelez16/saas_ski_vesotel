# Spec: Página de Detalle de Módulo y Gestión de Suscripciones Inline

Este documento especifica el diseño y la arquitectura para la nueva página de detalles y edición de módulos SaaS, incluyendo la gestión inline de suscripciones asociadas bajo una interfaz de doble columna.

## 1. Cambios en el Backend

### 1.1. Nuevo Endpoint de Consulta de Módulo Individual
Añadir una ruta en `backend/routers/modules.py` para obtener un módulo por ID.

* **Ruta:** `GET /modules/{module_id}`
* **Auth:** Requiere ser administrador de la plataforma (`_require_admin`).
* **Respuesta:** `schemas.AppModuleResponse`
* **Implementación:**
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

---

## 2. Cambios en el Frontend

### 2.1. API Client (`frontend/src/lib/api/modules.ts`)
Agregar la función para consultar un módulo individual:
```typescript
export const getModule = async (moduleId: string): Promise<AppModule> => {
    const response = await api.get<AppModule>(`/modules/${moduleId}`);
    return response.data;
};
```

Y actualizar `getSubscriptions` para aceptar filtros opcionales de módulo:
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

### 2.2. Nueva Página: `/admin/modules/[moduleId]/page.tsx`
Se construirá un layout de dos columnas usando CSS Grid.

#### Estructura del Componente:
* **Estado:**
  - `showForm`: boolean (indica si el panel inline de añadir/editar suscripción está abierto).
  - `editingSub`: `ModuleSubscription | null` (si se está editando, contiene la suscripción; si es null y `showForm` es true, es creación).
  - Formulario de edición del módulo: `name`, `description`, `targetScope`, `priceMonthly`, `isActive`.
  - Formulario de suscripción inline: `scope`, `targetId`, `status`, `expiresAt`, `notes`.
* **Cargas de Datos (React Query):**
  - Módulo (`moduleId`) -> `getModule(moduleId)`
  - Suscripciones del módulo -> `getSubscriptions({ moduleId })` (filtrado en cliente o backend).
  - Empresas -> `getCompanies()`
  - Usuarios -> `getUsers()`

#### Layout Visual (Tailwind CSS):
```tsx
<div className="space-y-6 w-full py-2">
  {/* Header con botón para regresar a la lista de módulos */}
  <div className="flex items-center gap-3 border-b pb-4">
    <Button variant="ghost" onClick={() => router.push("/admin/modules")}>...</Button>
    <h1 className="text-2xl font-bold">Detalle del Módulo</h1>
  </div>

  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
    {/* Columna Izquierda: Formulario del Módulo (lg:col-span-5) */}
    <div className="lg:col-span-5 space-y-6">
      <Card>
        <CardHeader>...</CardHeader>
        <CardContent className="space-y-4">
           {/* Inputs del formulario */}
        </CardContent>
        <CardFooter>
           {/* Botón Guardar Cambios */}
        </CardFooter>
      </Card>
    </div>

    {/* Columna Derecha: Suscripciones del Módulo (lg:col-span-7) */}
    <div className="lg:col-span-7 space-y-6">
      <Card>
        <CardHeader className="flex justify-between items-center">
           <CardTitle>Suscripciones</CardTitle>
           <Button onClick={() => openAddSubscription()}>+ Añadir Suscripción</Button>
        </CardHeader>
        <CardContent className="space-y-6">
           {/* Formulario Inline de Suscripción (si showForm es true) */}
           {showForm && (
             <div className="border rounded-lg p-4 bg-slate-50 space-y-4">
               {/* Inputs de creación/edición */}
             </div>
           )}

           {/* Listado de Suscripciones registradas */}
           <div className="space-y-3">
              {subscriptions.map(sub => (
                <div key={sub.id} className="flex justify-between items-center p-3 border rounded-lg">
                   {/* Detalles y botones de acción inline (Editar / Cancelar) */}
                </div>
              ))}
           </div>
        </CardContent>
      </Card>
    </div>
  </div>
</div>
```

---

## 3. Criterios de Aceptación
1. Acceder a `/admin/modules/{moduleId}` muestra el formulario correcto con los datos del módulo.
2. Guardar cambios en el módulo realiza una petición `PUT /modules/{moduleId}` y actualiza la UI.
3. Se listan las suscripciones que corresponden únicamente a este módulo.
4. Al hacer clic en "+ Añadir Suscripción" se abre un formulario dentro de la columna derecha, sin redirecciones ni modales/diálogos globales.
5. Al hacer clic en "Editar" en una suscripción de la lista, el mismo formulario inline se abre en la parte superior del listado precargado con los datos de dicha suscripción.
6. Guardar la suscripción ejecuta la creación (`POST`) o edición (`PUT`) de la suscripción, actualizando la lista y cerrando el panel inline.
7. Conservar compatibilidad y pasar la suite de pruebas unitarias.
