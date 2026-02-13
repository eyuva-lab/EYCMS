from datetime import datetime, date
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, EmailStr

from .models import AccountType, EntryType, TemplateType, UserRole


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: UserRole

    class Config:
        from_attributes = True


class AccountCreate(BaseModel):
    code: str
    name: str
    account_type: AccountType


class ProjectCreate(BaseModel):
    code: str
    name: str
    description: str | None = None
    is_centre_project: bool = False
    owner_user_id: int | None = None


class BudgetHeadCreate(BaseModel):
    code: str
    name: str
    project_id: int | None = None
    sanctioned_amount: Decimal = Decimal("0")


class TransactionLineIn(BaseModel):
    account_id: int
    project_id: int | None = None
    budget_head_id: int | None = None
    entry_type: EntryType
    amount: Decimal


class TransactionCreate(BaseModel):
    txn_date: datetime
    narration: str
    reference_no: str | None = None
    lines: list[TransactionLineIn]


class TransactionOut(BaseModel):
    id: int
    txn_date: datetime
    narration: str

    class Config:
        from_attributes = True


class BankStatementImportRow(BaseModel):
    statement_date: datetime
    description: str
    debit: Decimal = Decimal("0")
    credit: Decimal = Decimal("0")
    closing_balance: Decimal | None = None


class EventCreate(BaseModel):
    title: str
    description: str | None = None
    start_at: datetime
    end_at: datetime
    project_id: int | None = None
    budget_head_id: int | None = None
    estimated_cost: Decimal = Decimal("0")
    prior_approval_required: bool = False


class ReportTemplateCreate(BaseModel):
    name: str
    type: TemplateType
    description: str | None = None
    header_config: dict[str, Any] = {}
    layout_json: dict[str, Any]
    html_template: str


class GenerateReportRequest(BaseModel):
    template_id: int
    project_id: int | None = None
    from_date: date | None = None
    to_date: date | None = None
    parameters: dict[str, Any] = {}


class BudgetSummaryOut(BaseModel):
    budget_head_id: int
    budget_head_name: str
    sanctioned: Decimal
    spent: Decimal
    remaining: Decimal
    utilized_pct: float
