from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import BankAccount, BankStatementLine, Transaction, User
from app.schemas import BankStatementImportRow

router = APIRouter(prefix="/bank", tags=["bank"])




@router.get("/accounts")
def list_bank_accounts(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(BankAccount).order_by(BankAccount.id.asc()).all()


@router.get("/statements/{bank_account_id}")
def list_statement_lines(bank_account_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return (
        db.query(BankStatementLine)
        .filter(BankStatementLine.bank_account_id == bank_account_id)
        .order_by(BankStatementLine.statement_date.desc())
        .all()
    )

@router.post("/accounts")
def create_bank_account(payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    account = BankAccount(**payload, created_by_id=user.id, updated_by_id=user.id)
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.post("/statements/{bank_account_id}/import")
def import_statement(
    bank_account_id: int,
    rows: list[BankStatementImportRow],
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    for row in rows:
        line = BankStatementLine(
            bank_account_id=bank_account_id,
            **row.model_dump(),
            created_by_id=user.id,
            updated_by_id=user.id,
        )
        db.add(line)
    db.commit()
    return {"imported": len(rows)}


@router.post("/reconcile/{statement_line_id}/{transaction_id}")
def reconcile(
    statement_line_id: int,
    transaction_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    line = db.get(BankStatementLine, statement_line_id)
    txn = db.get(Transaction, transaction_id)
    if not line or not txn:
        raise HTTPException(status_code=404, detail="Missing statement line or transaction")
    line.matched_transaction_id = transaction_id
    line.is_reconciled = True
    db.commit()
    return {"status": "reconciled"}
