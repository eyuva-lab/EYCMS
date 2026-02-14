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
- `GET /transactions/centre-summary?from_date=...&to_date=...` : dashboard budget summary.
- `POST /events/{event_id}/prior-approval?template_id=...` : render prior approval form HTML.
- `POST /reports/generate` with template + dates + project : generate UC/SoE/newsletter outputs.

## Run locally

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

> If you hit bcrypt/passlib errors on Windows, ensure `bcrypt==4.0.1` is installed (pinned in requirements).

Open `http://127.0.0.1:8000` for dashboard UI and `http://127.0.0.1:8000/docs` for Swagger.

Default seeded Coordinator on first run: `coordinator@eyuva.local` / `admin123`.


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

- Day 3-4 sprint adds Home setup checklist + role-aware navigation + default coordinator/centre seeding.
- Day 1-2 sprint adds CRUD-style UI actions (create/list/edit/delete) for Users and Master Data (accounts/projects/budget heads).
- Use **Login** first; after login the app hides the login card and shows your profile badge.
- Use **Logout** button in the top-right to clear token/session from browser storage.
- **Users** tab lets coordinator/finance create users and refresh user list.
- UI now includes an ERP-style workspace with module navigation: Dashboard, Master Data, Users, Calendar & Events, Transactions, and Reports & Templates.
