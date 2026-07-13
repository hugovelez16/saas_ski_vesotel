# Plan de Implementación: Barra Lateral Dinámica Basada en Módulos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que la barra lateral (Sidebar) cargue y filtre sus opciones de forma dinámica a partir de las suscripciones activas a los módulos en la base de datos, eliminando la lógica condicional estática y migrando las opciones heredadas de `settings.modules` para Facturación e Informes.

**Architecture:** Mapear en el frontend los códigos de módulo del backend a sus respectivas rutas, etiquetas e iconos mediante un registro estático. En `layout.tsx`, consultar en tiempo real las suscripciones activas del usuario usando el hook `useModules` y reconstruir dinámicamente las listas de menú de Manager y Worker.

**Tech Stack:** Next.js (React), React Query, Alembic (SQLAlchemy), FastAPI.

**Execution Mode Recommendation:** Driven (Sequential) - Las tareas dependen secuencialmente de que la base de datos y la API sirvan los módulos antes de cambiar el renderizado en el Sidebar.

## Global Constraints

- Usar `docker compose` en lugar del comando deprecado `docker-compose` para cualquier operación de contenedores.
- Siempre operar sobre los contenedores levantados en el docker compose definido en `docker-compose.dev.yml` mediante el flag `-f`.
- Seguir las convenciones de TypeScript y camelCase en el frontend.

---

### Task 1: Migración de Base de Datos para Módulos Heredados (billing y reports)

**Files:**
- Create: `backend/migrations/versions/XXXX_seed_billing_and_reports_modules.py`
- Modify: `backend/routers/companies.py` (para usar comprobaciones dinámicas en el backend si aplica)

**Interfaces:**
- Consumes: Módulos de base de datos y modelo de `module_subscriptions`.
- Produces: Datos en las tablas `app_modules` y `module_subscriptions` para todos los tenants existentes.

**Implementation Steps:**
- [ ] **Step 1: Crear archivo de migración de Alembic** - Generar una nueva migración ejecutando `docker compose -f docker-compose.dev.yml exec backend alembic revision -m "seed_billing_and_reports_modules"`.
- [ ] **Step 2: Programar la migración de datos (upgrade)** - Modificar la migración generada para insertar los módulos `billing` ("Facturación y Cobros", ámbito: `company`) y `reports` ("Informes y Estadísticas", ámbito: `both`) si no existen en `app_modules`. Luego, recorrer las empresas en la base de datos y crear registros activos en `module_subscriptions` para aquellas empresas que tengan `billing` o `reports` habilitados en su JSONB `settings` (o por defecto).
- [ ] **Step 3: Programar el rollback (downgrade)** - Definir la eliminación de las suscripciones y módulos insertados en el catálogo en caso de rollback.
- [ ] **Step 4: Ejecutar la migración** - Aplicar la migración con `docker compose -f docker-compose.dev.yml exec backend alembic upgrade head` y validar que finaliza sin errores.
- [ ] **Step 5: Confirmar cambios en base de datos** - Verificar que los nuevos módulos aparecen en la base de datos y que las suscripciones correspondientes fueron asignadas a las empresas existentes.
- [ ] **Step 6: Commit** - 
  ```bash
  git add backend/migrations/versions/
  git commit -m "migration: seed billing and reports modules and subscribe existing companies"
  ```

---

### Task 2: Configuración del Registro y Renderizado Dinámico en Sidebar

**Files:**
- Modify: `frontend/src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: API cliente `getMyModules` a través del hook `useModules`.
- Produces: Estructura dinámica de elementos en el Sidebar según el rol y suscripciones del usuario.

**Implementation Steps:**
- [ ] **Step 1: Importar dependencias** - Importar el hook `useModules` en `frontend/src/app/(app)/layout.tsx`.
- [ ] **Step 2: Definir el registro estático de navegación** - Crear el objeto `MODULE_SIDEBAR_REGISTRY` mapeando los códigos de módulo (`worker_daily_report`, `billing`, `reports`) a su configuración de ruta, etiqueta e icono.
- [ ] **Step 3: Filtrar dinámicamente las opciones del menú** - Modificar la construcción de `managerItems` y `workerNavItems` en `layout.tsx` para recuperar los módulos activos vía `useModules` y mapear y filtrar dinámicamente según el rol activo actual del usuario y el contexto de empresa, removiendo por completo las referencias estáticas a `settings.modules`.
- [ ] **Step 4: Controlar la carga inicial** - Asegurar que el estado `loadingModules` del hook `useModules` se evalúe junto con `loading` del AuthContext antes de renderizar la página, evitando destellos de menús vacíos.
- [ ] **Step 5: Ejecutar validaciones** - Ejecutar `docker compose -f docker-compose.dev.yml exec frontend npx tsc --noEmit` y `docker compose -f docker-compose.dev.yml exec frontend npx eslint "src/app/(app)/layout.tsx"` para asegurar que no hay errores de tipo o formato.
- [ ] **Step 6: Ejecutar tests** - Correr los tests del frontend con `docker compose -f docker-compose.dev.yml exec frontend npm run test -- --run`.
- [ ] **Step 7: Commit** - 
  ```bash
  git add frontend/src/app/\(app\)/layout.tsx
  git commit -m "frontend: render sidebar modules dynamically using MODULE_SIDEBAR_REGISTRY and useModules"
  ```
