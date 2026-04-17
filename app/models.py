from datetime import date, datetime, timezone
from decimal import Decimal
from enum import Enum

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class UserRole(str, Enum):
    coordinator = "COORDINATOR"
    finance = "FINANCE"
    fellow = "FELLOW"
    auditor = "AUDITOR"


class AccountType(str, Enum):
    asset = "ASSET"
    liability = "LIABILITY"
    equity = "EQUITY"
    income = "INCOME"
    expense = "EXPENSE"


class EntryType(str, Enum):
    debit = "DEBIT"
    credit = "CREDIT"


class TemplateType(str, Enum):
    uc = "UC"
    soe = "SoE"
    prior_approval = "PriorApproval"
    event_report = "EventReport"
    newsletter = "Newsletter"


class TemplateFormat(str, Enum):
    html = "HTML"
    doc = "DOC"
    docx = "DOCX"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(SqlEnum(UserRole), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_centre_project: Mapped[bool] = mapped_column(Boolean, default=False)
    owner_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class Account(Base, TimestampMixin):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    account_type: Mapped[AccountType] = mapped_column(SqlEnum(AccountType), index=True)
    parent_account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id"), nullable=True)


class BudgetHead(Base, TimestampMixin):
    __tablename__ = "budget_heads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(50), index=True)
    name: Mapped[str] = mapped_column(String(255))
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    sanctioned_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))


class Transaction(Base, TimestampMixin):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    txn_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    narration: Mapped[str] = mapped_column(Text)
    reference_no: Mapped[str | None] = mapped_column(String(100), nullable=True)

    lines: Mapped[list["TransactionLine"]] = relationship(
        "TransactionLine", back_populates="transaction", cascade="all, delete-orphan"
    )


class TransactionLine(Base, TimestampMixin):
    __tablename__ = "transaction_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id"), index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), index=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    budget_head_id: Mapped[int | None] = mapped_column(
        ForeignKey("budget_heads.id"), nullable=True
    )
    entry_type: Mapped[EntryType] = mapped_column(SqlEnum(EntryType))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))

    transaction: Mapped[Transaction] = relationship("Transaction", back_populates="lines")


class TransactionDocument(Base, TimestampMixin):
    __tablename__ = "transaction_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id"), index=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), index=True)


class BankAccount(Base, TimestampMixin):
    __tablename__ = "bank_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bank_name: Mapped[str] = mapped_column(String(200))
    account_number_masked: Mapped[str] = mapped_column(String(30))
    ifsc: Mapped[str | None] = mapped_column(String(20), nullable=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True)


class BankStatementLine(Base, TimestampMixin):
    __tablename__ = "bank_statement_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bank_account_id: Mapped[int] = mapped_column(ForeignKey("bank_accounts.id"), index=True)
    statement_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    description: Mapped[str] = mapped_column(Text)
    debit: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    credit: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    closing_balance: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    is_reconciled: Mapped[bool] = mapped_column(Boolean, default=False)
    matched_transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("transactions.id"), nullable=True
    )


class Event(Base, TimestampMixin):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    budget_head_id: Mapped[int | None] = mapped_column(ForeignKey("budget_heads.id"), nullable=True)
    estimated_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    prior_approval_required: Mapped[bool] = mapped_column(Boolean, default=False)


class EventEvidence(Base, TimestampMixin):
    __tablename__ = "event_evidence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), index=True)
    document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"), nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class Document(Base, TimestampMixin):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    file_name: Mapped[str] = mapped_column(String(255))
    storage_path: Mapped[str] = mapped_column(String(500))
    mime_type: Mapped[str] = mapped_column(String(100))
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id"), nullable=True)


class ReportTemplate(Base, TimestampMixin):
    __tablename__ = "report_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    type: Mapped[TemplateType] = mapped_column(SqlEnum(TemplateType), index=True)
    template_format: Mapped[TemplateFormat] = mapped_column(SqlEnum(TemplateFormat), default=TemplateFormat.html)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    header_config: Mapped[dict] = mapped_column(JSON, default={})
    layout_json: Mapped[dict] = mapped_column(JSON)
    html_template: Mapped[str] = mapped_column(Text, default="")
    template_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)


class PlaceholderDefinition(Base, TimestampMixin):
    __tablename__ = "placeholder_definitions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    filters_json: Mapped[dict] = mapped_column(JSON, default={})
    expression_json: Mapped[dict] = mapped_column(JSON, default={})


class GeneratedReport(Base, TimestampMixin):
    __tablename__ = "generated_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    template_id: Mapped[int] = mapped_column(ForeignKey("report_templates.id"), index=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    from_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    to_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    parameters: Mapped[dict] = mapped_column(JSON, default={})
    html_output: Mapped[str] = mapped_column(Text)
    pdf_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    output_format: Mapped[str] = mapped_column(String(20), default="HTML")
