# Especificación de Diseño: Módulo de Estadísticas de Turnos

Este documento detalla la arquitectura, flujos de datos y diseño de componentes para el nuevo módulo `shifts_statistics` ("Estadísticas Semanales de Turnos"), que permite a los trabajadores y administradores de la empresa ver resúmenes semanales de dinero y unidades trabajadas.

---

## 1. Requerimientos de Negocio y Reglas

1. **Catálogo de Módulos (SaaS)**:
   - Identificador del módulo: `"shifts_statistics"`.
   - Nombre: `"Estadísticas Semanales de Turnos"`.
   - Descripción: `"Visualización y desglose de totales de dinero y unidades de turnos agrupados por semanas."`.
   - Ámbito (`target_scope`): `"company"`.

2. **Control de Acceso (Roles)**:
   - **Administradores de Plataforma**: Tienen acceso a todo.
   - **Managers de Empresa**: Pueden ver estadísticas consolidadas, filtrar por trabajador y ver desgloses individuales.
   - **Trabajadores (Workers)**: Solo pueden ver sus propias estadísticas de la empresa activa.

3. **Reglas de Cálculo de Dinero**:
   - **Para el Trabajador (Worker)**: Los totales de dinero se muestran siempre en **Neto** (`netAmount` / `amount`), independientemente de la configuración de la empresa.
   - **Para la Empresa (Manager)**: Los totales de dinero dependen de la configuración de la empresa en `business_logic.price_type` (o `billing.price_type` como fallback):
     - Si está configurada en `"gross"`, se suma y muestra en **Bruto** (`grossAmount`).
     - Si está configurada en `"net"` (o no está definido), se suma y muestra en **Neto** (`netAmount`).

4. **Reglas de Cálculo de Unidades**:
   - Cada tipo de turno (definición) tiene un tipo de unidad: `"hours"`, `"days"` o `"fixed"`.
   - Para evitar sumar peras con manzanas (ej. sumar 8 horas y 3 días y mostrar 11), las estadísticas de unidades se agruparán y mostrarán desglosadas por unidad:
     - **Horas**: Suma de las horas trabajadas en turnos de tipo por horas (ej. `duration` o `durationHours`).
     - **Días**: Suma de los días transcurridos en turnos de tipo por rango de días (ej. `endDate - startDate + 1` en tutoriales o similares).
     - **Fijos / Sesiones**: Suma de cantidad de turnos de tipo fijo (cada turno cuenta como 1 unidad).

5. **Navegación e Interacción**:
   - Acceso desde la barra lateral bajo el nombre "Estadísticas Semanales".
   - Por defecto, se cargan las **últimas 8 semanas** (de lunes a domingo).
   - Se muestra un listado cronológico de las semanas.
   - Al hacer clic en una semana, se expande hacia abajo de forma animada (despliegue inline) para listar los turnos individuales correspondientes a esa semana.
   - Al hacer clic en un turno individual, se abre el diálogo de detalles del turno existente (`WorkLogDetailsDialog`).

---

## 2. Arquitectura de Datos y Backend

### 2.1. Seed de Base de Datos
Crearemos una migración de Alembic para insertar el módulo `"shifts_statistics"` en `app_modules` y activar suscripciones predeterminadas para todas las empresas existentes.

```python
# Módulo a registrar
{
    "code_name": "shifts_statistics",
    "name": "Estadísticas Semanales de Turnos",
    "description": "Visualización y desglose de totales de dinero y unidades de turnos agrupados por semanas.",
    "target_scope": "company",
    "is_active": True,
}
```

### 2.2. Endpoints
Se utilizará el endpoint existente `GET /work-logs`, filtrado por:
- `company_id`: Empresa seleccionada.
- `user_id`: Trabajador seleccionado (o `null` para todos, si es manager).
- `start_date` y `end_date`: Límites del periodo de 8 semanas.

---

## 3. Diseño Frontend (Next.js)

### 3.1. Registro en la Barra Lateral
Se añade el módulo al mapeo dinámico en `frontend/src/app/(app)/layout.tsx`:

```typescript
"shifts_statistics": {
    href: "/manager/shifts-statistics",
    label: "Estadísticas Semanales",
    icon: TrendingUp, // Importado de lucide-react
    allowedRoles: ["manager", "worker"],
}
```

### 3.2. Página de Estadísticas `/manager/shifts-statistics/page.tsx`
Un nuevo componente de página dinámico que implementa:
- Obtención del contexto de usuario (`useAuth`) y los módulos activos (`useModules`).
- Lógica de selección de empresa activa (persistencia mediante query param `companyId` y contexto).
- Filtros superiores:
  - Selector de Trabajador (solo visible para managers, opciones: "Todos" y listado de empleados de la empresa).
  - Selector de rango de fechas (Presets: "Últimas 8 semanas", "Últimas 12 semanas", "Año actual", "Personalizado").
- Generación de rangos semanales (lunes a domingo) a partir de la fecha seleccionada.
- Agrupación en el cliente (`useMemo`):
  - Recorre los turnos obtenidos por React Query.
  - Clasifica cada turno en su respectiva semana de lunes a domingo.
  - Suma unidades y montos monetarios de acuerdo a la regla de roles (worker = neto, manager = configurado).
- Renderizado de la lista de semanas:
  - Cada fila/tarjeta de semana muestra:
    - Título: "Semana N (dd/mm/aaaa - dd/mm/aaaa)".
    - Total de dinero formateado en EUR.
    - Total de unidades desglosado (ej. `40.00h | 2 días | 1 sesión`).
  - Estado colapsable/expandible para cada semana.
  - Vista expandida: Tabla simplificada de turnos de la semana:
    - Fecha.
    - Empleado (solo si es manager y está viendo "Todos").
    - Tipo de Turno (Badge).
    - Unidades individuales.
    - Dinero individual.
    - Botón/Fila interactiva que abre `WorkLogDetailsDialog`.

---

## 4. Plan de Pruebas

1. **Validación de Roles**:
   - Entrar como trabajador y verificar que el dinero mostrado siempre coincide con el monto Neto de los turnos, y que no aparece el selector de empleados.
   - Entrar como manager y verificar que si la empresa está en modo bruto, el dinero se muestra bruto, y que se puede filtrar por empleado.
2. **Validación de Unidades**:
   - Crear turnos de tipo horas, días y fijos en una misma semana, y comprobar que se muestran los desgloses correctos (`Xh`, `Y días`, `Z unidades`).
3. **Control de Suscripciones**:
   - Si se desactiva el módulo `shifts_statistics` para una empresa en `/admin/modules`, comprobar que el menú desaparece de la barra lateral y que si se intenta acceder por URL, la página muestra un mensaje de acceso restringido o redirige.
