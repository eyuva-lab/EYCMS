from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import Transaction, TransactionLine, User
from app.schemas import BudgetSummaryOut, TransactionCreate
from app.services.accounting import centre_budget_summary, validate_double_entry

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("")
def create_transaction(payload: TransactionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    validate_double_entry(payload.lines)
    txn = Transaction(
        txn_date=payload.txn_date,
        narration=payload.narration,
        reference_no=payload.reference_no,
        created_by_id=user.id,
        updated_by_id=user.id,
    )
    for line in payload.lines:
        txn.lines.append(TransactionLine(**line.model_dump()))
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


@router.get("")
def list_transactions(
    project_id: int | None = None,
    budget_head_id: int | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Transaction)
    if from_date:
        q = q.filter(Transaction.txn_date >= from_date)
    if to_date:
        q = q.filter(Transaction.txn_date <= to_date)
    if project_id or budget_head_id:
        q = q.join(TransactionLine)
    if project_id:
        q = q.filter(TransactionLine.project_id == project_id)
    if budget_head_id:
        q = q.filter(TransactionLine.budget_head_id == budget_head_id)
    return q.distinct().all()


@router.get("/centre-summary", response_model=list[BudgetSummaryOut])
def get_centre_summary(
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return centre_budget_summary(db, from_date, to_date)
