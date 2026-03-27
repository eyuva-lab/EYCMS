from datetime import date
from pathlib import Path
from uuid import uuid4

from jinja2.sandbox import SandboxedEnvironment
from sqlalchemy.orm import Session

from app.models import Account, AccountType, EntryType, Event, GeneratedReport, Project, ReportTemplate, TemplateType, Transaction, TransactionLine

_safe_env = SandboxedEnvironment(autoescape=False)
REPORT_OUTPUT_DIR = Path("generated_reports")
REPORT_OUTPUT_DIR.mkdir(exist_ok=True)


def render_template(template_html: str, context: dict) -> str:
    return _safe_env.from_string(template_html).render(**context)


def build_uc_context(db: Session, project_id: int | None, from_date: date | None, to_date: date | None):
    q = (
        db.query(TransactionLine)
        .join(Account, Account.id == TransactionLine.account_id)
        .join(Transaction, Transaction.id == TransactionLine.transaction_id)
        .filter(TransactionLine.entry_type == EntryType.debit, Account.account_type == AccountType.expense)
    )
    if project_id:
        q = q.filter(TransactionLine.project_id == project_id)
    if from_date:
        q = q.filter(Transaction.txn_date >= from_date)
    if to_date:
        q = q.filter(Transaction.txn_date <= to_date)

    lines = q.all()
    total = sum(float(l.amount) for l in lines)
    project_name = "Centre"
    if project_id:
        project = db.get(Project, project_id)
        if project:
            project_name = project.name

    return {
        "project_name": project_name,
        "from_date": from_date,
        "to_date": to_date,
        "total_spent": round(total, 2),
    }


def build_newsletter_context(db: Session, from_date: date | None, to_date: date | None):
    q = db.query(Event)
    if from_date:
        q = q.filter(Event.start_at >= from_date)
    if to_date:
        q = q.filter(Event.start_at <= to_date)
    events = q.order_by(Event.start_at.desc()).all()
    return {
        "from_date": from_date,
        "to_date": to_date,
        "events": events,
    }


def generate_report(
    db: Session,
    template_id: int,
    project_id: int | None,
    from_date: date | None,
    to_date: date | None,
    parameters: dict,
    user_id: int,
):
    template = db.get(ReportTemplate, template_id)
    if not template:
        raise ValueError("Template not found")

    if template.type in (TemplateType.uc, TemplateType.soe):
        context = build_uc_context(db, project_id, from_date, to_date)
    elif template.type == TemplateType.newsletter:
        context = build_newsletter_context(db, from_date, to_date)
    else:
        context = {}

    context.update(parameters or {})
    html = render_template(template.html_template, context)

    report_file = REPORT_OUTPUT_DIR / f"report_{uuid4().hex}.html"
    report_file.write_text(html, encoding="utf-8")

    report = GeneratedReport(
        template_id=template_id,
        project_id=project_id,
        from_date=from_date,
        to_date=to_date,
        parameters=parameters,
        html_output="",
        pdf_path=str(report_file),
        created_by_id=user_id,
        updated_by_id=user_id,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report
