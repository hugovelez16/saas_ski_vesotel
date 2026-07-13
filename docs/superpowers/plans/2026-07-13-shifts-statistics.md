# Plan de Implementación del Módulo de Estadísticas de Turnos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar un nuevo módulo de suscripción independiente `"shifts_statistics"` que permita a managers y trabajadores visualizar resúmenes semanales de dinero y unidades de los turnos.

**Architecture:** Módulo SaaS independiente registrado en base de datos. En el frontend, se integra en la barra lateral mediante comprobaciones del hook `useModules` y se procesa toda la agregación y desglose de datos semanal directamente en el cliente (Enfoque 1) para garantizar interactividad instantánea al expandir detalles y filtrar.

**Tech Stack:** Next.js (TypeScript/React Query), FastAPI (Python/SQLAlchemy/Alembic).

**Execution Mode Recommendation:** Driven (Sequential) - Las tareas dependen de la existencia de la migración de base de datos primero, seguido del registro de navegación, y finalmente del componente de página.

## Global Constraints

- Identificador del módulo: `"shifts_statistics"`.
- Los trabajadores ven importes siempre en Neto (`netAmount`).
- Los managers ven importes en Bruto (`grossAmount`) si la empresa está configurada como `"gross"`, de lo contrario en Neto (`netAmount`).
- Agrupación cronológica por semanas de lunes a domingo.

---

### Task 1: Migración de Base de Datos (Seeding del Módulo)

**Files:**
- Create: `backend/migrations/versions/YYYYMMDD_seed_shifts_statistics_module.py` (Se genera automáticamente con Alembic)

**Interfaces:**
- Consumes: Catálogo existente de base de datos (`app_modules` y `module_subscriptions`).
- Produces: Un nuevo registro de módulo con `code_name="shifts_statistics"` y suscripciones activas para las empresas existentes en la base de datos.

**Implementation Steps:**
- [ ] **Step 1: Generar la migración de Alembic** - Ejecutar el comando para generar la revisión.
  Run: `docker compose -f docker-compose.dev.yml exec backend alembic revision -m "seed_shifts_statistics_module"`
- [ ] **Step 2: Implementar la migración de seed** - Abrir la migración generada y rellenar las funciones `upgrade()` y `downgrade()`.
  - En `upgrade()`:
    1. Insertar el módulo `shifts_statistics` en `app_modules`.
    2. Consultar las empresas de la base de datos e insertar un registro en `module_subscriptions` para cada empresa con `status='active'` y `scope='company'`.
  - En `downgrade()`:
    1. Eliminar las suscripciones asociadas al módulo `shifts_statistics`.
    2. Eliminar el registro del módulo de `app_modules`.
- [ ] **Step 3: Ejecutar la migración** - Aplicar la migración localmente para actualizar la base de datos.
  Run: `docker compose -f docker-compose.dev.yml exec backend alembic upgrade head` (Expected: Success)
- [ ] **Step 4: Commit** - ```bash
git add backend/migrations/versions/*_seed_shifts_statistics_module.py
git commit -m "migration: seed shifts_statistics module and active subscriptions"
```

---

### Task 2: Registro en Barra Lateral y Navegación

**Files:**
- Modify: `frontend/src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: Hook `useModules` y estructura actual de `MODULE_SIDEBAR_REGISTRY`.
- Produces: Nueva opción de barra lateral "Estadísticas Semanales" visible para managers y trabajadores en empresas que tengan la suscripción activa.

**Implementation Steps:**
- [ ] **Step 1: Modificar `layout.tsx`** - Registrar el nuevo módulo:
  - Importar el icono `TrendingUp` (o `BarChart2`) de `lucide-react`.
  - Agregar el módulo `"shifts_statistics"` a `MODULE_SIDEBAR_REGISTRY`:
    ```typescript
    "shifts_statistics": {
        href: "/manager/shifts-statistics",
        label: "Estadísticas Semanales",
        icon: TrendingUp,
        allowedRoles: ["manager", "worker"],
    }
    ```
  - En el renderizado de los nav items de Manager, insertar el item `shifts_statistics` debajo de `shifts` (Turnos) si está activo.
  - En el renderizado de Worker, insertar `shifts_statistics` debajo de `calendar` si está activo.
- [ ] **Step 2: Commit** - ```bash
git add frontend/src/app/\(app\)/layout.tsx
git commit -m "feat: register shifts_statistics in sidebar registry"
```

---

### Task 3: Nueva Página de Estadísticas Semanales

**Files:**
- Create: `frontend/src/app/(app)/manager/shifts-statistics/page.tsx`

**Interfaces:**
- Consumes: `getWorkLogs` de `frontend/src/lib/api/work-logs.ts`, `getMyCompanies` de `frontend/src/lib/api/companies.ts`, y el diálogo `WorkLogDetailsDialog`.
- Produces: Página interactiva en `/manager/shifts-statistics` que calcula y visualiza las agregaciones de turnos.

**Implementation Steps:**
- [ ] **Step 1: Implementar la estructura e inicialización de la página** - 
  - Usar `"use client"` y configurar `export const dynamic = "force-dynamic"`.
  - Consumir el contexto `useAuth()` para saber el rol activo del usuario y el ID de su empresa activa.
  - Usar `useModules()` y verificar si tiene acceso al módulo `shifts_statistics`. Si está cargando mostrar "Cargando...", y si no tiene acceso mostrar un mensaje de error estilizado (Acceso no autorizado).
  - Usar query params (`companyId`) para alinear con el selector de empresas común.
- [ ] **Step 2: Implementar los selectores y filtros** - 
  - Si es Manager: Mostrar un selector de empresa (si hay múltiples) y un selector de empleado (con opción de "Todos los empleados" y miembros activos de la empresa obtenidos de `getCompaniesDetailed`).
  - Para ambos roles: Un selector de rango de fecha inicializado por defecto a las **últimas 8 semanas** (con opción de cambiar a últimas 12 semanas, año actual o personalizado).
- [ ] **Step 3: Implementar la obtención y procesamiento de datos (Lógica de Negocio)** -
  - Cargar los turnos llamando a `getWorkLogs` pasándole el ID de la empresa activa, el ID del trabajador (si es worker o si se filtró un trabajador específico), y el rango de fechas.
  - En un `useMemo`, agrupar los turnos por semanas (lunes a domingo) comprendidas en el rango de fechas.
  - Para cada semana, calcular:
    - **Total Dinero**: 
      - Si es Worker: Sumar `log.netAmount` de cada registro.
      - Si es Manager: Consultar `company.settings?.business_logic?.price_type`. Si es `"gross"`, sumar `log.grossAmount`; si no, sumar `log.netAmount`.
    - **Total Unidades**:
      - Agrupar por la unidad del tipo de turno (`definition?.unit`):
        - `"hours"`: Sumar `log.duration ?? log.durationHours`.
        - `"days"`: Diferencia de días (`endDate - startDate + 1`).
        - `"fixed"`: Sumar 1 unidad por cada turno.
      - Construir un string con el formato: `X.XXh | Y días | Z ses.` omitiendo unidades que sumen cero.
- [ ] **Step 4: Implementar la interfaz y desplegables** - 
  - Renderizar las semanas en orden cronológico inverso (la semana actual arriba).
  - Cada fila de semana será interactiva (al pulsar se expande inline).
  - Al expandirse, mostrar una tabla/lista con los turnos individuales correspondientes a esa semana (Fecha, Trabajador -si aplica-, Tipo con Badge, Unidades, Monto formateado con `formatCurrency`).
  - Al hacer clic en un turno de la lista, abrir el componente importado `WorkLogDetailsDialog` pasando el turno seleccionado para ver sus detalles completos de liquidación.
- [ ] **Step 5: Verificar visualmente y ejecutar pruebas** -
  - Iniciar el servidor local y validar como Manager y Worker la lógica de cálculo y navegación.
- [ ] **Step 6: Commit** - ```bash
git add frontend/src/app/\(app\)/manager/shifts-statistics/page.tsx
git commit -m "feat: implement weekly shifts statistics page and detail expansion"
```
