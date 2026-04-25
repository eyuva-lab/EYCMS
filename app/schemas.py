from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, EmailStr

from .models import AccountType, EntryType, TemplateFormat, TemplateType, UserRole


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.fellow


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: UserRole
    is_active: bool

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    password: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None


class AccountCreate(BaseModel):
    code: str
    name: str
    account_type: AccountType


class AccountUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    account_type: AccountType | None = None


class ProjectCreate(BaseModel):
    code: str
    name: str
    description: str | None = None
    is_centre_project: bool = False
    owner_user_id: int | None = None


class ProjectUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    description: str | None = None
    is_centre_project: bool | None = None
    owner_user_id: int | None = None


class BudgetHeadCreate(BaseModel):
    code: str
    name: str
    project_id: int | None = None
    sanctioned_amount: Decimal = Decimal("0")


class BudgetHeadUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    project_id: int | None = None
    sanctioned_amount: Decimal | None = None


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


class BudgetCheckRequest(BaseModel):
    from_date: datetime | None = None
    to_date: datetime | None = None
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


class BankAccountCreate(BaseModel):
    bank_name: str
    account_number_masked: str
    ifsc: str | None = None
    project_id: int | None = None


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
    template_format: TemplateFormat = TemplateFormat.html
    description: str | None = None
    header_config: dict[str, Any] = {}
    layout_json: dict[str, Any]
    html_template: str = ""


class PlaceholderDefinitionCreate(BaseModel):
    name: str
    description: str | None = None
    filters_json: dict[str, Any] = {}
    expression_json: dict[str, Any]


class PlaceholderDefinitionUpdate(BaseModel):
    description: str | None = None
    filters_json: dict[str, Any] | None = None
    expression_json: dict[str, Any] | None = None


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
