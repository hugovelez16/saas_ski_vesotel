# Postgres Billing Aggregation Function Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accelerate and simplify billing queries on the manager's billing tab by implementing a PostgreSQL database function `get_billing_summary` to pre-aggregate work logs, user info, net, gross, and unique days worked on the database side.

**Architecture:** A PostgreSQL PL/pgSQL function handles daily expansion lateral series and aggregation, returning a flat set of aggregated rows per active member and work log type. A FastAPI router endpoint `/work-logs/billing-summary` queries this function and serializes it. The React frontend queries this new endpoint and transforms it into the table format.

**Tech Stack:** PostgreSQL (PL/pgSQL), Alembic, FastAPI, Pydantic, TypeScript, React, React Query.

## Global Constraints
* Always use `docker-compose -f docker-compose.dev.yml` for all Docker operations.
* No placeholders (TODOs/TBDs) in the implemented code.
* Follow camelCase naming in frontend JSON API fields via CamelModel aliases.

---

## File Structure

The implementation will affect the following files:
* `backend/migrations/versions/<timestamp>_add_get_billing_summary_function.py`: Creates the Postgres function.
* `backend/schemas.py`: Adds `BillingSummaryItemResponse` schema.
* `backend/routers/work_logs.py`: Adds the `GET /work-logs/billing-summary` endpoint.
* `frontend/src/lib/types.ts`: Updates `DynamicBillingRow` type and adds `BillingSummaryItem`.
* `frontend/src/lib/api/work-logs.ts`: Adds `getBillingSummary` API call.
* `frontend/src/components/manager/billing-table.tsx`: Updates table to display `logsCount` instead of `logs.length`.
* `frontend/src/app/(app)/manager/billing/BillingPageClient.tsx`: Integrates the new API call and groups the flat response.

---

### Task 1: Database Migration (PostgreSQL Function)

**Files:**
* Create: `backend/migrations/versions/20260717120000_add_get_billing_summary_function.py` (or generate it using Alembic)

**Interfaces:**
* Produces: PostgreSQL PL/pgSQL function `get_billing_summary(comp_id UUID, s_date DATE, e_date DATE)`

- [ ] **Step 1: Create Alembic Migration File**
  Run this command to generate the migration stub (make sure containers are up first if not already running):
  ```powershell
  docker-compose -f docker-compose.dev.yml run --rm backend alembic revision -m "add_get_billing_summary_function"
  ```
  *Note: Find the newly created file name in `backend/migrations/versions/` and use it for Step 2.*

- [ ] **Step 2: Implement the Migration Code**
  Edit the generated migration file (e.g. `backend/migrations/versions/<revision>_add_get_billing_summary_function.py`) to define the PL/pgSQL function:
  ```python
  """add_get_billing_summary_function

  Revision ID: <revision>
  Revises: <previous_revision>
  Create Date: 2026-07-17

  """
  from alembic import op
  import sqlalchemy as sa

  # revision identifiers, used by Alembic.
  revision = '<revision>'
  down_revision = '<previous_revision>'
  branch_labels = None
  depends_on = None

  def upgrade() -> None:
      op.execute("""
      CREATE OR REPLACE FUNCTION get_billing_summary(comp_id UUID, s_date DATE, e_date DATE)
      RETURNS TABLE (
          user_id UUID,
          first_name VARCHAR,
          last_name VARCHAR,
          email VARCHAR,
          type VARCHAR,
          total_hours NUMERIC,
          total_net NUMERIC,
          total_gross NUMERIC,
          unique_days INT,
          logs_count INT
      ) AS $$
      BEGIN
          RETURN QUERY
          WITH active_members AS (
              SELECT cm.user_id, u.first_name, u.last_name, u.email
              FROM company_members cm
              JOIN users u ON cm.user_id = u.id
              WHERE cm.company_id = comp_id
                AND cm.is_active = true
          ),
          filtered_logs AS (
              SELECT * FROM work_logs
              WHERE company_id = comp_id
                AND end_date >= s_date AND start_date <= e_date
          ),
          unique_days_cte AS (
              SELECT wl.user_id, wl.type, COUNT(DISTINCT d.day) AS unique_days
              FROM filtered_logs wl,
              LATERAL generate_series(wl.start_date::timestamp, wl.end_date::timestamp, '1 day'::interval) d(day)
              GROUP BY wl.user_id, wl.type
          ),
          metrics_cte AS (
              SELECT wl.user_id, wl.type, 
                     SUM(wl.duration) AS total_hours,
                     SUM(wl.net_amount) AS total_net, 
                     SUM(wl.gross_amount) AS total_gross,
                     COUNT(*) AS logs_count
              FROM filtered_logs wl
              GROUP BY wl.user_id, wl.type
          )
          SELECT
              am.user_id,
              am.first_name::VARCHAR,
              am.last_name::VARCHAR,
              am.email::VARCHAR,
              m.type::VARCHAR,
              COALESCE(m.total_hours, 0)::NUMERIC AS total_hours,
              COALESCE(m.total_net, 0)::NUMERIC AS total_net,
              COALESCE(m.total_gross, 0)::NUMERIC AS total_gross,
              COALESCE(u.unique_days, 0)::INT AS unique_days,
              COALESCE(m.logs_count, 0)::INT AS logs_count
          FROM active_members am
          LEFT JOIN metrics_cte m ON am.user_id = m.user_id
          LEFT JOIN unique_days_cte u ON am.user_id = u.user_id AND m.type = u.type;
      END;
      $$ LANGUAGE plpgsql;
      """)

  def downgrade() -> None:
      op.execute("DROP FUNCTION IF EXISTS get_billing_summary(UUID, DATE, DATE);")
  ```

- [ ] **Step 3: Run Database Migrations**
  Execute the migrations using the dev compose config:
  ```powershell
  docker-compose -f docker-compose.dev.yml run --rm backend alembic upgrade head
  ```

- [ ] **Step 4: Commit**
  ```bash
  git add backend/migrations/versions/*.py
  git commit -m "migration: add get_billing_summary pg function"
  ```

---

### Task 2: Backend API Router

**Files:**
* Modify: `backend/schemas.py`
* Modify: `backend/routers/work_logs.py`

**Interfaces:**
* Consumes: PostgreSQL PL/pgSQL function `get_billing_summary`
* Produces: Endpoint `GET /work-logs/billing-summary` returning `List[schemas.BillingSummaryItemResponse]`

- [ ] **Step 1: Add Pydantic Response Schema**
  Append `BillingSummaryItemResponse` to `backend/schemas.py`:
  ```python
  class BillingSummaryItemResponse(CamelModel):
      user_id: UUID
      first_name: Optional[str] = None
      last_name: Optional[str] = None
      email: EmailStr
      type: Optional[str] = None
      total_hours: float
      total_net: float
      total_gross: float
      unique_days: int
      logs_count: int
  ```

- [ ] **Step 2: Add Router Endpoint**
  Add the endpoint to `backend/routers/work_logs.py`:
  ```python
  @router.get("/billing-summary", response_model=List[schemas.BillingSummaryItemResponse])
  def get_billing_summary(
      company_id: UUID,
      start_date: date,
      end_date: date,
      db: Session = Depends(get_db),
      current_user: models.User = Depends(auth.get_verified_user)
  ):
      """
      Get billing summary for a company, aggregated by user and work log type, using the PostgreSQL database function.
      Only managers of the company or platform admins can access this.
      """
      if not getattr(current_user, "is_platform_admin", False):
          if not is_manager_of_company(db, current_user, company_id):
              raise HTTPException(
                  status_code=status.HTTP_403_FORBIDDEN,
                  detail="Only managers of this company or platform admins can access the billing summary."
              )
              
      from sqlalchemy import text
      query = text("""
          SELECT user_id, first_name, last_name, email, type, 
                 total_hours, total_net, total_gross, unique_days, logs_count
          FROM get_billing_summary(:company_id, :start_date, :end_date)
      """)
      result = db.execute(query, {
          "company_id": str(company_id),
          "start_date": start_date,
          "end_date": end_date
      }).fetchall()
      
      summary = []
      for row in result:
          summary.append(schemas.BillingSummaryItemResponse(
              user_id=row.user_id,
              first_name=row.first_name,
              last_name=row.last_name,
              email=row.email,
              type=row.type,
              total_hours=float(row.total_hours or 0.0),
              total_net=float(row.total_net or 0.0),
              total_gross=float(row.total_gross or 0.0),
              unique_days=int(row.unique_days or 0),
              logs_count=int(row.logs_count or 0)
          ))
      return summary
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add backend/schemas.py backend/routers/work_logs.py
  git commit -m "feat(backend): add get_billing_summary endpoint"
  ```

---

### Task 3: Frontend Integration

**Files:**
* Modify: `frontend/src/lib/types.ts`
* Modify: `frontend/src/lib/api/work-logs.ts`
* Modify: `frontend/src/components/manager/billing-table.tsx`
* Modify: `frontend/src/app/(app)/manager/billing/BillingPageClient.tsx`

**Interfaces:**
* Consumes: API `GET /work-logs/billing-summary` endpoint
* Produces: Optimized Monthly Billing UI displaying aggregated results directly

- [ ] **Step 1: Update Frontend Types**
  Edit `frontend/src/lib/types.ts` to add the `BillingSummaryItem` interface and replace `logs: WorkLog[]` with `logsCount: number` in `DynamicBillingRow`:
  ```typescript
  export interface BillingSummaryItem {
      userId: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      type: string | null;
      totalHours: number;
      totalNet: number;
      totalGross: number;
      uniqueDays: number;
      logsCount: number;
  }

  export interface DynamicBillingRow {
      userId: string;
      userName: string;
      userEmail: string;
      byType: Record<string, WorklogTypeSummary>;
      totalNet: number;
      totalGross: number;
      logsCount: number;
  }
  ```

- [ ] **Step 2: Add API client helper**
  Edit `frontend/src/lib/api/work-logs.ts` to add the function `getBillingSummary`:
  ```typescript
  import { WorkLog, WorkLogCreate, BillingSummaryItem } from '@/lib/types';

  // ... (existing code)

  export const getBillingSummary = async (params: {
      companyId: string;
      startDate: string;
      endDate: string;
  }): Promise<BillingSummaryItem[]> => {
      const apiParams = {
          company_id: params.companyId,
          start_date: params.startDate,
          end_date: params.endDate
      };
      const response = await api.get('/work-logs/billing-summary', { params: apiParams });
      return response.data;
  };
  ```

- [ ] **Step 3: Update Billing Table column**
  Edit `frontend/src/components/manager/billing-table.tsx` around line 37 to display `row.original.logsCount`:
  ```typescript
  // Target:
  {
      id: 'logsCount',
      header: 'Registros',
      cell: ({ row }) => (
          <div className="text-right font-medium text-slate-500 pr-4">
              {row.original.logsCount}
          </div>
      ),
  },
  ```

- [ ] **Step 4: Update BillingPageClient to query the summary endpoint**
  Edit `frontend/src/app/(app)/manager/billing/BillingPageClient.tsx` to replace `getWorkLogs` with `getBillingSummary`, and perform the lightweight grouping of flat results:
  ```typescript
  import { getBillingSummary } from "@/lib/api/work-logs";
  import { BillingSummaryItem, DynamicBillingRow } from "@/lib/types";

  // ... inside ManagerBillingPage():

  // Replace query 1 (fetching logs) with getBillingSummary:
  const { data: billingItems = [], isLoading: isLoadingBilling } = useQuery({
      queryFn: () => getBillingSummary({
          companyId: selectedCompanyId!,
          startDate: date?.from ? format(date.from, 'yyyy-MM-dd') : undefined,
          endDate: date?.to ? format(date.to, 'yyyy-MM-dd') : undefined,
      }),
      queryKey: ["companyBillingSummary", selectedCompanyId, date?.from, date?.to],
      enabled: !!selectedCompanyId && !!date?.from,
  });

  // (Optional: remove members query if you don't need it, but keep it if we want to ensure all active users are shown,
  // though the Postgres function already joins active_members and returns all of them, including those with no logs!)
  
  // Aggregate billingData from flat database rows:
  const billingData: DynamicBillingRow[] = useMemo(() => {
      if (!billingItems.length) return [];

      const userMap = new Map<string, DynamicBillingRow>();

      billingItems.forEach((item: BillingSummaryItem) => {
          let row = userMap.get(item.userId);
          if (!row) {
              row = {
                  userId: item.userId,
                  userName: `${item.firstName || ''} ${item.lastName || ''}`.trim() || item.email,
                  userEmail: item.email,
                  byType: {},
                  totalNet: 0,
                  totalGross: 0,
                  logsCount: 0,
              };
              userMap.set(item.userId, row);
          }

          // If the item has a type, add it to byType
          if (item.type) {
              const def = worklogDefs[item.type];
              const unit = def?.unit ?? 'hours';
              const label = def?.label ?? item.type;

              // Quantity is totalHours if unit is hours, otherwise uniqueDays
              const quantity = unit === 'hours' ? item.totalHours : item.uniqueDays;

              row.byType[item.type] = {
                  typeKey: item.type,
                  label,
                  unit,
                  quantity,
                  netAmount: item.totalNet,
                  grossAmount: item.totalGross,
              };

              row.totalNet += item.totalNet;
              row.totalGross += item.totalGross;
              row.logsCount += item.logsCount;
          }
      });

      return Array.from(userMap.values());
  }, [billingItems, worklogDefs]);

  // Update summaryStats:
  const summaryStats = useMemo(() => {
      let totalGross = 0;
      let totalNet = 0;
      let totalLogs = 0;

      billingData.forEach(row => {
          totalGross += row.totalGross;
          totalNet += row.totalNet;
          totalLogs += row.logsCount;
      });

      return { totalGross, totalNet, totalLogs };
  }, [billingData]);
  ```

- [ ] **Step 5: Commit**
  ```bash
  git add frontend/src/lib/types.ts frontend/src/lib/api/work-logs.ts frontend/src/components/manager/billing-table.tsx frontend/src/app/\(app\)/manager/billing/BillingPageClient.tsx
  git commit -m "feat(frontend): integrate pg billing-summary API call"
  ```
