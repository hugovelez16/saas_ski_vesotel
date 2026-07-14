# Fix Findings from Task 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement database transaction rollbacks in work logs supervisor tests, and annotate `company_id` query parameter as a `UUID` instead of `str` in the work logs router.

**Architecture:** Refactor `backend/test_work_logs_supervisor.py` to use `flush()` and `rollback()` instead of `commit()` and manual `delete()` calls. Change `company_id` type annotation in `backend/routers/work_logs.py`.

**Tech Stack:** FastAPI, SQLAlchemy, unittest, PostgreSQL.

**Execution Mode Recommendation:** Driven (Sequential) - Very simple linear progression of tasks.

## Global Constraints

- Use `docker compose` instead of `docker-compose`.
- Always use `docker-compose.dev.yml` with the `-f` flag for container operations.
- Run tests and commit frequently.

---

### Task 1: Refactor Database Transactions in Work Logs Supervisor Tests

**Files:**
- Modify: `backend/test_work_logs_supervisor.py`

**Interfaces:**
- None.

**Implementation Steps:**
- [ ] **Step 1: Modify setUp() and tearDown() in `backend/test_work_logs_supervisor.py`**
  Remove the call to `self.db.commit()` in `setUp()` and replace it with `self.db.flush()`.
  Remove manual deletion of test entities in `tearDown()` and replace with `self.db.rollback()`.
- [ ] **Step 2: Run tests to verify they still pass**
  Run: `docker compose -f docker-compose.dev.yml exec backend python test_work_logs_supervisor.py`
  Expected: PASS
- [ ] **Step 3: Commit changes**
  Run:
  ```bash
  git add backend/test_work_logs_supervisor.py
  git commit -m "test: use database transaction rollback instead of commit in work logs supervisor tests"
  ```

---

### Task 2: Annotate company_id as UUID in Router

**Files:**
- Modify: `backend/routers/work_logs.py`

**Interfaces:**
- None.

**Implementation Steps:**
- [ ] **Step 1: Modify `read_work_logs` function annotation in `backend/routers/work_logs.py`**
  Change the type of the query parameter `company_id` from `str = None` to `UUID = None`.
- [ ] **Step 2: Run tests to verify correctness**
  Run: `docker compose -f docker-compose.dev.yml exec backend python test_work_logs_supervisor.py`
  Expected: PASS
- [ ] **Step 3: Commit changes**
  Run:
  ```bash
  git add backend/routers/work_logs.py
  git commit -m "refactor: annotate company_id query parameter as UUID in work logs router"
  ```

---

## Verification Plan

### Security Verification
- **Validate DB State Isolation:** Verify that no test data remains in the development database after running the supervisor tests. Since we use `rollback()` and avoid committing, the database is kept completely clean.
- **Input Validation:** Verifying that `company_id` query parameter is validated by FastAPI dynamically (FastAPI will raise a 422 Unprocessable Entity error if an invalid UUID string is provided).

### Functional Verification
- Run the suite: `docker compose -f docker-compose.dev.yml exec backend python test_work_logs_supervisor.py`
- Verify that both tests pass:
  1. `test_supervisor_with_explicit_company_id`
  2. `test_supervisor_with_implicit_company_id`
