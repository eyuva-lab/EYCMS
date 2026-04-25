# E-YUVA Grant Programme Manager

A modular FastAPI application for centre-level grant accounting and fellow subgrant tracking.

## Architecture

- `app/models.py`: SQLAlchemy schema (users, projects/fellows, budget heads, journal transactions, bank statements, events, documents, report templates).
- `app/routers/`: API modules by bounded context.
- `app/services/accounting.py`: Double-entry validation and budget summary logic.
- `app/services/reporting.py`: Template rendering + report generation (UC/SoE/newsletter/prior approval).
- `frontend/`: Lightweight dashboard UI with role profile, tabs, event form, and template editor.

## Domain schema highlights

### Double-entry journal
- `transactions` (header) + `transaction_lines` (line items).
- Each line stores `account_id`, optional `project_id`, optional `budget_head_id`, `entry_type` (DEBIT/CREDIT), `amount`.
- API validates debit total == credit total before commit.

### Budget and project model
- `projects`: Centre project and fellow subgrant projects.
- `budget_heads`: Can be centre-level (`project_id NULL`) or project-specific.
- `transactions/centre-summary`: sanctioned/spent/remaining/utilization by head.

### Banking + reconciliation
- `bank_accounts`
- `bank_statement_lines` (imported CSV-equivalent rows)
- Reconcile endpoint links each statement row to a transaction.

### Calendar/events + prior approvals
- `events` with `prior_approval_required` and cost metadata.
- Prior approval rendered from report template and event fields.

### Documents and evidence
- `documents` for bill/receipt/minutes/photos, linkable to project/event.
- `transaction_documents` and `event_evidence` for many-to-many style evidence mapping.

### Report builder
- `report_templates` stores template type + JSON layout + Jinja-like HTML.
- `generated_reports` stores rendered HTML and optional PDF path.

## Example template JSON

```json
{
  "name": "UC Basic",
  "type": "UC",
  "layout_json": {
    "sections": [
      {"title": "Grant Summary", "table": ["head", "sanctioned", "spent", "remaining"]}
    ]
  },
  "html_template": "<h1>UC {{ project_name }}</h1><p>{{ from_date }} to {{ to_date }}</p><p>Total spent: {{ total_spent }}</p>"
}
```

## Key API examples

- `POST /transactions` : post a balanced transaction with line items.
- `POST /transactions/{id}/reverse` : create immutable reversal journal for a posted voucher (no hard delete).
- `GET /transactions/centre-summary?from_date=...&to_date=...` : dashboard budget summary.
- `POST /events/{event_id}/prior-approval?template_id=...` : render prior approval form HTML.
- `POST /reports/generate` with template + dates + project : generate UC/SoE/newsletter outputs.
- `POST /reports/templates/upload-word` : upload DOC/DOCX templates using `<<Placeholder>>` tokens.
- `POST /reports/placeholders` : create custom placeholder formula definitions (filters + operations).


## Security / runtime environment

Set these before running:

```bash
export SECRET_KEY="<strong-random-secret>"
export CORS_ALLOWED_ORIGINS="http://127.0.0.1:8000,http://localhost:8000"
# optional local seed
export SEED_DEFAULTS=true
export SEED_COORDINATOR_PASSWORD="change-me-now"
```

`SECRET_KEY` is mandatory unless `ALLOW_INSECURE_DEV_SECRET=true` is explicitly set for local dev only.

## Run locally

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

> If you hit bcrypt/passlib errors on Windows, ensure `bcrypt==4.0.1` is installed (pinned in requirements).

Open `http://127.0.0.1:8000` for dashboard UI and `http://127.0.0.1:8000/docs` for Swagger.

Default seed is disabled by default. To seed locally, set `SEED_DEFAULTS=true` and optionally `SEED_COORDINATOR_PASSWORD`.


### Windows (PowerShell)

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8010
```

You can change the port (for example if 8000 is already used) with `--port <number>`.
Then open `http://127.0.0.1:<number>` and `http://127.0.0.1:<number>/docs`.


## UI notes

- Day 8 sprint adds guided frequent transaction types + manual journal mode, multi-format bank import preview (CSV/XLSX/MT940/CAMT.053), and MVP drag-drop report builder with tag insertion.
- Day 7 sprint adds full operational pages: transactions filters+line-items+warnings, reconciliation table with matching, events prior-approval table actions, and reports generation dropdown workflow.
- Day 5-6 sprint adds operational UI for transactions, bank reconciliation, events approvals, report generation, and role-aware edit safety.
- Day 3-4 sprint adds Home setup checklist + role-aware navigation + default coordinator/centre seeding.
- Day 1-2 sprint adds CRUD-style UI actions (create/list/edit/delete) for Users and Master Data (accounts/projects/budget heads).
- Use **Login** first; after login the app hides the login card and shows your profile badge.
- Use **Logout** button in the top-right to clear token/session from browser storage.
- **Users** tab lets coordinator/finance create users and refresh user list.
- UI now includes an ERP-style workspace with module navigation: Dashboard, Master Data, Users, Calendar & Events, Transactions, and Reports & Templates.


## Demo data quick start

1. Login with `coordinator@eyuva.local` / `admin123`.
2. Create one Finance user and one Fellow user in **Users**.
3. In **Master Data**, create at least 2 Accounts, 1 Fellow Project, and 2 Budget Heads.
4. In **Transactions**, add two balanced lines and run **Check Budget Warning** before posting.
5. In **Transactions → Bank Reconciliation**, create a bank account, import sample statement JSON, and reconcile with a transaction id.
6. In **Events**, create event + generate prior approval using a prior-approval template id.
7. In **Reports**, save template, generate report, and download HTML.


## Word templates and placeholders

- Supported template formats: HTML, DOC, DOCX.
- Use placeholders in DOC/DOCX like `<<ProjectName>>`, `<<FromDate>>`, `<<TotalExpenses>>`, `<<TotalIncome>>`, `<<NetUtilization>>`.
- Create dynamic placeholders via `/reports/placeholders` using expression JSON (operations: `metric`, `add`, `subtract`, `multiply`, `divide`) and filter JSON (`project_id`, `budget_head_id`, `from_date`, `to_date`, `entry_type`, `account_type`).
