from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import Account, AccountType, BudgetHead, EntryType, Project, Transaction, TransactionLine, User, UserRole
from app.schemas import BudgetCheckRequest, BudgetSummaryOut, TransactionCreate
from app.services.accounting import centre_budget_summary, validate_double_entry

router = APIRouter(prefix="/transactions", tags=["transactions"])


def fellow_project_ids(db: Session, user: User) -> list[int]:
    if user.role != UserRole.fellow:
        return []
    return [pid for (pid,) in db.query(Project.id).filter(Project.owner_user_id == user.id).all()]


def _serialize_line_for_reverse(line: TransactionLine) -> dict:
    return {
        "account_id": line.account_id,
        "project_id": line.project_id,
        "budget_head_id": line.budget_head_id,
        "entry_type": EntryType.credit if line.entry_type == EntryType.debit else EntryType.debit,
        "amount": Decimal(line.amount),
    }


@router.post("")
def create_transaction(payload: TransactionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role == UserRole.auditor:
        raise HTTPException(status_code=403, detail="Auditor has read-only access")

    if user.role == UserRole.fellow:
        allowed = set(fellow_project_ids(db, user))
        for line in payload.lines:
            if not line.project_id or line.project_id not in allowed:
                raise HTTPException(status_code=403, detail="Fellow can only post transactions for own project")

    validate_double_entry(payload.lines)
    txn = Transaction(
        txn_date=payload.txn_date,
        narration=payload.narration,
        reference_no=payload.reference_no,
        created_by_id=user.id,
        updated_by_id=user.id,
    )
    for line in payload.lines:
        txn.lines.append(TransactionLine(**line.model_dump(), created_by_id=user.id, updated_by_id=user.id))
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


@router.post("/{transaction_id}/reverse")
def reverse_transaction(transaction_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role == UserRole.auditor:
        raise HTTPException(status_code=403, detail="Auditor has read-only access")

    txn = db.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if user.role == UserRole.fellow:
        allowed = set(fellow_project_ids(db, user))
        if any((not line.project_id or line.project_id not in allowed) for line in txn.lines):
            raise HTTPException(status_code=403, detail="Fellow can only reverse own project transactions")

    reversal = Transaction(
        txn_date=datetime.now(timezone.utc),
        narration=f"Reversal of TXN-#{txn.id}: {txn.narration}",
        reference_no=f"REV-{txn.id}",
        created_by_id=user.id,
        updated_by_id=user.id,
    )
    for line in txn.lines:
        reversal.lines.append(TransactionLine(**_serialize_line_for_reverse(line), created_by_id=user.id, updated_by_id=user.id))
    db.add(reversal)
    db.commit()
    db.refresh(reversal)
    return {"status": "reversed", "source_transaction_id": txn.id, "reversal_transaction_id": reversal.id}


@router.post("/budget-check")
def budget_check(payload: BudgetCheckRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    by_head: dict[int, Decimal] = {}
    for line in payload.lines:
        if line.entry_type == EntryType.debit and line.budget_head_id:
            by_head[line.budget_head_id] = by_head.get(line.budget_head_id, Decimal("0")) + Decimal(line.amount)

    warnings = []
    fellow_allowed = set(fellow_project_ids(db, user)) if user.role == UserRole.fellow else set()

    for head_id, new_amt in by_head.items():
        head = db.get(BudgetHead, head_id)
        if not head:
            warnings.append({"budget_head_id": head_id, "warning": "Budget head not found"})
            continue

        if user.role == UserRole.fellow:
            if not head.project_id or head.project_id not in fellow_allowed:
                warnings.append({"budget_head_id": head_id, "warning": "Budget head not in fellow scope"})
                continue

        spent_stmt = (
            select(
                func.coalesce(
                    func.sum(
                        case((TransactionLine.entry_type == EntryType.debit, TransactionLine.amount), else_=0)
                    ),
                    0,
                )
            )
            .select_from(TransactionLine)
            .join(Transaction, Transaction.id == TransactionLine.transaction_id)
            .where(TransactionLine.budget_head_id == head_id)
        )
        if payload.from_date:
            spent_stmt = spent_stmt.where(Transaction.txn_date >= payload.from_date)
        if payload.to_date:
            spent_stmt = spent_stmt.where(Transaction.txn_date <= payload.to_date)
        if user.role == UserRole.fellow:
            spent_stmt = spent_stmt.where(TransactionLine.project_id.in_(fellow_allowed))

        current_spent = Decimal(db.execute(spent_stmt).scalar_one() or 0)
        projected = current_spent + new_amt
        sanctioned = Decimal(head.sanctioned_amount or 0)
        if sanctioned and projected > sanctioned:
            warnings.append(
                {
                    "budget_head_id": head_id,
                    "budget_head_name": head.name,
                    "sanctioned": str(sanctioned),
                    "current_spent": str(current_spent),
                    "new_amount": str(new_amt),
                    "projected_spent": str(projected),
                    "warning": "Projected spend exceeds sanctioned amount",
                }
            )
    return {"ok": len(warnings) == 0, "warnings": warnings}


@router.get("")
def list_transactions(
    project_id: int | None = None,
    budget_head_id: int | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Transaction)
    if from_date:
        q = q.filter(Transaction.txn_date >= from_date)
    if to_date:
        q = q.filter(Transaction.txn_date <= to_date)
    if project_id or budget_head_id or user.role == UserRole.fellow:
        q = q.join(TransactionLine)
    if project_id:
        q = q.filter(TransactionLine.project_id == project_id)
    if budget_head_id:
        q = q.filter(TransactionLine.budget_head_id == budget_head_id)
    if user.role == UserRole.fellow:
        allowed = fellow_project_ids(db, user)
        if not allowed:
            return []
        q = q.filter(TransactionLine.project_id.in_(allowed))
    return q.distinct().order_by(Transaction.txn_date.desc()).offset(offset).limit(min(limit, 500)).all()


@router.get("/centre-summary", response_model=list[BudgetSummaryOut])
def get_centre_summary(
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role == UserRole.fellow:
        raise HTTPException(status_code=403, detail="Fellow can view own project details only")
    return centre_budget_summary(db, from_date, to_date)


@router.get("/project-summary/{project_id}", response_model=list[BudgetSummaryOut])
def get_project_summary(
    project_id: int,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role == UserRole.fellow:
        allowed = set(fellow_project_ids(db, user))
        if project_id not in allowed:
            raise HTTPException(status_code=403, detail="Fellow can view own project summary only")

    data = centre_budget_summary(db, from_date, to_date, project_id=project_id)
    return data
