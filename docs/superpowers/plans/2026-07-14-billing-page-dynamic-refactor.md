# Billing Page — Refactor Dinámico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la tabla de facturación rígida (hardcoded a `particular`, `tutorial`, `coordinación`, `nocturnidad`) por una vista dinámica que lea los tipos de worklog definidos en `company.worklogDefinitions` y su unidad de medida (`unit: "hours" | "days"`).

**Architecture:** La agregación en `BillingPageClient` hoy itera con `if (log.type === 'particular')...` etc. Se reemplaza por un bucle genérico que agrupa logs por `log.type` y suma `duration` (horas) o días únicos dependiendo del `unit` de la definición. La tabla y el diálogo de desglose se regeneran a partir de las claves dinámicas.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, TanStack Query, TanStack Table, date-fns, shadcn/ui, export-to-csv.

**Execution Mode Recommendation:** Driven (Sequential) — cada tarea depende de los tipos producidos en la anterior. No hay paralelismo real seguro.

## Global Constraints

- No tests unitarios ni comprobaciones de código (plan sencillo).
- No modificar modelos del backend ni endpoints existentes.
- Leer siempre `company.worklogDefinitions` para saber qué tipos existen y su `unit`.
- Si un worklog tiene un `type` que no existe en `worklogDefinitions`, mostrar el `type` literal como fallback.
- La unidad de medida `"hours"` → mostrar `X h`, `"days"` → mostrar `X días`.
- Mantener los KPI cards de Coste Bruto y Coste Neto. Los KPI de "Horas Particulares" y "Días Tutoriales" se eliminan (son hardcoded); se reemplaza por un KPI genérico de "Total registros".
- El CSV exportado debe incluir una columna por cada tipo dinámico.
- Idioma: español (ES) en todos los labels de UI. Nombres técnicos (`code_name`) solo como fallback interno.

---

## Estructura de datos clave

### `company.worklogDefinitions` (JSONB)
```
// Ejemplo real de la BD
{
  "particular": { "unit": "hours", "label": "Particular" },
  "tutorial":   { "unit": "days",  "label": "Tutorial" }
}
```

### `CompanyMember.ratesConfig` (JSONB)
```
{
  "particular": { "base_rate": 25.0, "is_gross": true, "tax_overrides": {} },
  "tutorial":   { "base_rate": 120.0, "is_gross": false, "tax_overrides": {} }
}
```

### WorkLog campos relevantes
- `log.type` → string clave de `worklogDefinitions`
- `log.duration` → número (horas si `unit === "hours"`)
- `log.startDate`, `log.endDate` → para contar días únicos si `unit === "days"`
- `log.netAmount`, `log.grossAmount` → importes calculados en backend

---

## Archivos afectados

| Archivo | Acción |
|---|---|
| `frontend/src/components/manager/billing-table.tsx` | **Modificar** — tabla dinámica por tipo |
| `frontend/src/components/manager/billing-breakdown-dialog.tsx` | **Modificar** — desglose dinámico |
| `frontend/src/app/(app)/manager/billing/BillingPageClient.tsx` | **Modificar** — agregación dinámica, KPI cards, CSV |
| `frontend/src/lib/types.ts` | **Modificar** — nuevo tipo `DynamicBillingRow` |

---

### Tarea 1: Definir `DynamicBillingRow` en types.ts

**Archivos:**
- Modificar: `frontend/src/lib/types.ts`

**Interfaces:**
- Produce: `DynamicBillingRow` — consumido por Tareas 2, 3 y 4.

**Implementation Steps:**

- [ ] **Step 1: Añadir el tipo `WorklogTypeSummary`** — Representa el resumen de un tipo de worklog para un usuario:
  ```ts
  export interface WorklogTypeSummary {
      typeKey: string;
      label: string;
      unit: "hours" | "days" | string;
      quantity: number;   // horas o días, según unit
      netAmount: number;
      grossAmount: number;
  }
  ```

- [ ] **Step 2: Añadir el tipo `DynamicBillingRow`** — Representa una fila en la tabla de facturación:
  ```ts
  export interface DynamicBillingRow {
      userId: string;
      userName: string;
      userEmail: string;
      byType: Record<string, WorklogTypeSummary>;  // typeKey → summary
      totalNet: number;
      totalGross: number;
      logs: WorkLog[];
  }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add frontend/src/lib/types.ts
  git commit -m "types: add DynamicBillingRow and WorklogTypeSummary for dynamic billing"
  ```

---

### Tarea 2: Refactorizar la agregación en `BillingPageClient`

**Archivos:**
- Modificar: `frontend/src/app/(app)/manager/billing/BillingPageClient.tsx`

**Interfaces:**
- Consume: `DynamicBillingRow`, `WorklogTypeSummary` (Tarea 1), `company.worklogDefinitions`.
- Produce: `billingData: DynamicBillingRow[]`, `worklogDefs: Record<string, {unit: string, label: string}>` — pasados como props a la tabla.

**Implementation Steps:**

- [ ] **Step 1: Leer `worklogDefinitions` de la empresa** — La query de `company` ya existe en el componente. Añadir debajo:
  ```ts
  const worklogDefs: Record<string, { unit: string; label: string }> =
      company?.worklogDefinitions ?? {};
  ```

- [ ] **Step 2: Reemplazar el `useMemo` de `billingData`** — Eliminar toda la lógica con `particularHours`, `tutorialDays`, etc. El nuevo algoritmo:
  ```ts
  const billingData: DynamicBillingRow[] = useMemo(() => {
      if (!workLogs.length) return [];

      // typeKey → Set<string> de fechas (para tipos unit="days")
      type DateSetMap = Record<string, Set<string>>;
      const userMap = new Map<string, { row: DynamicBillingRow; dateSets: DateSetMap }>();

      // Inicializar con miembros activos
      members.forEach((member: any) => {
          if (!member.user) return;
          userMap.set(member.user_id, {
              row: {
                  userId: member.user_id,
                  userName: `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim() || member.user.email,
                  userEmail: member.user.email,
                  byType: {},
                  totalNet: 0,
                  totalGross: 0,
                  logs: [],
              },
              dateSets: {},
          });
      });

      workLogs.forEach((log: WorkLog) => {
          let agg = userMap.get(log.userId);
          if (!agg) {
              agg = {
                  row: { userId: log.userId, userName: 'Unknown', userEmail: '', byType: {}, totalNet: 0, totalGross: 0, logs: [] },
                  dateSets: {},
              };
              userMap.set(log.userId, agg);
          }

          agg.row.logs.push(log);

          const def = worklogDefs[log.type];
          const unit = def?.unit ?? 'hours';
          const label = def?.label ?? log.type;

          if (!agg.row.byType[log.type]) {
              agg.row.byType[log.type] = { typeKey: log.type, label, unit, quantity: 0, netAmount: 0, grossAmount: 0 };
          }
          if (unit === 'days' && !agg.dateSets[log.type]) {
              agg.dateSets[log.type] = new Set<string>();
          }

          const summary = agg.row.byType[log.type];

          if (unit === 'hours') {
              summary.quantity += Number(log.duration ?? 0);
          } else {
              // Acumular días únicos
              try {
                  eachDayOfInterval({ start: parseISO(log.startDate), end: parseISO(log.endDate) })
                      .forEach(d => agg.dateSets[log.type].add(format(d, 'yyyy-MM-dd')));
              } catch {}
          }

          summary.netAmount += Number(log.netAmount ?? 0);
          summary.grossAmount += Number(log.grossAmount ?? 0);
          agg.row.totalNet += Number(log.netAmount ?? 0);
          agg.row.totalGross += Number(log.grossAmount ?? 0);
      });

      // Resolver cantidades de tipos "days"
      return Array.from(userMap.values()).map(({ row, dateSets }) => {
          Object.keys(dateSets).forEach(typeKey => {
              if (row.byType[typeKey]) {
                  row.byType[typeKey].quantity = dateSets[typeKey].size;
              }
          });
          return row;
      });
  }, [workLogs, members, worklogDefs]);
  ```

- [ ] **Step 3: Actualizar `summaryStats`** — Simplificar: solo `totalGross`, `totalNet`, `totalLogs = workLogs.length`.

- [ ] **Step 4: Reemplazar los KPI cards de "Horas Particulares" y "Días Tutoriales"** — Sustituir por un único card "Total Registros" con icono `FileText` y valor `summaryStats.totalLogs`.

- [ ] **Step 5: Actualizar `handleExportCsv`** — Generar columnas dinámicamente:
  ```ts
  const exportData = billingData.map(row => {
      const base: Record<string, any> = {
          Nombre: row.userName,
          Email: row.userEmail,
      };
      Object.entries(worklogDefs).forEach(([typeKey, def]) => {
          const summary = row.byType[typeKey];
          const unitLabel = def.unit === 'hours' ? 'h' : 'días';
          base[`${def.label} (${unitLabel})`] = summary?.quantity.toFixed(def.unit === 'hours' ? 2 : 0) ?? '0';
      });
      base['Total Bruto (€)'] = (row.totalGross || row.totalNet).toFixed(2);
      base['Total Neto (€)'] = row.totalNet.toFixed(2);
      return base;
  });
  ```

- [ ] **Step 6: Pasar `worklogDefs` a `BillingTable`** — Actualizar el JSX:
  ```tsx
  <BillingTable
      data={billingData}
      worklogDefs={worklogDefs}
      isLoading={isLoadingLogs || isLoadingMembers}
  />
  ```

- [ ] **Step 7: Commit**
  ```bash
  git add frontend/src/app/"(app)"/manager/billing/BillingPageClient.tsx
  git commit -m "feat(billing): replace hardcoded aggregation with dynamic worklog type grouping"
  ```

---

### Tarea 3: Refactorizar `BillingTable` para columnas dinámicas

**Archivos:**
- Modificar: `frontend/src/components/manager/billing-table.tsx`

**Interfaces:**
- Consume: `DynamicBillingRow` (Tarea 1), `worklogDefs` (Tarea 2).
- Produce: tabla con N columnas dinámicas + columna Total Bruto.

**Implementation Steps:**

- [ ] **Step 1: Actualizar props** — Reemplazar `BillingTableProps`:
  ```ts
  interface BillingTableProps {
      data: DynamicBillingRow[];
      worklogDefs: Record<string, { unit: string; label: string }>;
      isLoading?: boolean;
  }
  ```

- [ ] **Step 2: Generar columnas dinámicamente** — Dentro del `useMemo` de columnas:
  ```ts
  const cols: ColumnDef<DynamicBillingRow>[] = [
      {
          accessorKey: 'userName',
          header: 'Nombre del usuario',
          cell: ({ row }) => (
              <div className="flex flex-col">
                  <span className="text-sm font-semibold">{row.original.userName}</span>
                  <span className="text-xs text-muted-foreground">{row.original.userEmail}</span>
              </div>
          ),
      },
      // Una columna por cada tipo en worklogDefs
      ...Object.entries(worklogDefs).map(([typeKey, def]) => ({
          id: typeKey,
          header: def.label ?? typeKey,
          cell: ({ row }: { row: { original: DynamicBillingRow } }) => {
              const summary = row.original.byType[typeKey];
              if (!summary || summary.quantity === 0) return <div className="text-right text-muted-foreground">—</div>;
              const qty = def.unit === 'hours'
                  ? `${summary.quantity.toFixed(2)} h`
                  : `${summary.quantity} días`;
              return <div className="text-right">{qty}</div>;
          },
      })),
      // Columna fija Total Bruto
      {
          id: 'totalGross',
          header: 'Total Bruto',
          cell: ({ row }) => (
              <div className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                  {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
                      .format(row.original.totalGross || row.original.totalNet)}
              </div>
          ),
      },
  ];
  ```
  El `useMemo` debe tener `[worklogDefs]` como dependencia.

- [ ] **Step 3: Actualizar el `BillingBreakdownDialog` dentro de `BillingTable`** — Pasar la nueva prop `worklogDefs={worklogDefs}` al `<BillingBreakdownDialog>`.

- [ ] **Step 4: Eliminar lógica de `showTutorials`, `showCoordination`, `showNights`** — Ya no se usa.

- [ ] **Step 5: Commit**
  ```bash
  git add frontend/src/components/manager/billing-table.tsx
  git commit -m "feat(billing): dynamic columns from worklogDefinitions in BillingTable"
  ```

---

### Tarea 4: Refactorizar `BillingBreakdownDialog` para desglose dinámico

**Archivos:**
- Modificar: `frontend/src/components/manager/billing-breakdown-dialog.tsx`

**Interfaces:**
- Consume: `DynamicBillingRow` (Tarea 1), `worklogDefs` (Tarea 2).

**Implementation Steps:**

- [ ] **Step 1: Actualizar props** — Cambiar interfaz:
  ```ts
  interface BillingBreakdownDialogProps {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      row: DynamicBillingRow | null;
      worklogDefs: Record<string, { unit: string; label: string }>;
  }
  ```

- [ ] **Step 2: Reemplazar las filas hardcoded** — Dentro del `<TableBody>`:
  ```tsx
  {Object.entries(row.byType)
      .filter(([, summary]) => summary.quantity > 0 || summary.grossAmount > 0)
      .map(([typeKey, summary]) => {
          const def = worklogDefs[typeKey];
          const unit = def?.unit ?? 'hours';
          const label = def?.label ?? typeKey;
          const qtyStr = unit === 'hours'
              ? `${summary.quantity.toFixed(2)} h`
              : `${summary.quantity} días`;
          const amount = summary.grossAmount || summary.netAmount;
          return (
              <TableRow key={typeKey}>
                  <TableCell className="font-medium">{label}</TableCell>
                  <TableCell className="text-right">{qtyStr}</TableCell>
                  <TableCell className="text-right">{formatCurrency(amount)}</TableCell>
              </TableRow>
          );
      })
  }
  ```

- [ ] **Step 3: Actualizar la fila Total** — `formatCurrency(row.totalGross || row.totalNet)`.

- [ ] **Step 4: Commit**
  ```bash
  git add frontend/src/components/manager/billing-breakdown-dialog.tsx
  git commit -m "feat(billing): dynamic breakdown dialog from worklogDefinitions"
  ```

---

### Tarea 5: Limpieza y verificación

**Archivos:**
- Modificar: `frontend/src/components/manager/billing-table.tsx`
- Modificar: `frontend/src/lib/types.ts`

**Implementation Steps:**

- [ ] **Step 1: Eliminar la interfaz `BillingRow`** — Borrar el bloque `export interface BillingRow { ... }` de `billing-table.tsx`. Si algún import la referencia todavía, reemplazarlo por `DynamicBillingRow`.

- [ ] **Step 2: Eliminar imports no usados en `BillingPageClient`** — `UserCompanyRate`, `getCompanyRates` (si aún están). Verificar con el compilador de TypeScript o con la consola del navegador en dev.

- [ ] **Step 3: Verificar en navegador** — Arrancar con:
  ```bash
  docker compose -f docker-compose.dev.yml up
  ```
  Navegar a `/manager/billing?companyId=<id>`. Comprobar:
  - Las columnas coinciden con los tipos en `worklogDefinitions` de la empresa.
  - Un clic en una fila abre el diálogo con el desglose correcto.
  - El botón "Exportar CSV" descarga un archivo con las columnas dinámicas.
  - Con una empresa que solo tiene `particular`, aparece solo esa columna.

- [ ] **Step 4: Commit final**
  ```bash
  git add -A
  git commit -m "chore(billing): remove legacy BillingRow and unused imports"
  ```
