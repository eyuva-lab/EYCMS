from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import BankAccount, BankStatementLine, Project, Transaction, User, UserRole
from app.schemas import BankAccountCreate, BankStatementImportRow
from app.services.bank_import import parse_statement_file

router = APIRouter(prefix="/bank", tags=["bank"])


@router.get("/accounts")
def list_bank_accounts(limit: int = 100, offset: int = 0, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(BankAccount)
    if user.role == UserRole.fellow:
        q = q.join(Project, BankAccount.project_id == Project.id).filter(Project.owner_user_id == user.id)
    return q.order_by(BankAccount.id.asc()).offset(offset).limit(min(limit, 500)).all()


@router.get("/statements/{bank_account_id}")
def list_statement_lines(bank_account_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    account = db.get(BankAccount, bank_account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    if user.role == UserRole.fellow:
        project = db.get(Project, account.project_id) if account.project_id else None
        if not project or project.owner_user_id != user.id:
            raise HTTPException(status_code=403, detail="Fellow can view own bank statements only")

    return (
        db.query(BankStatementLine)
        .filter(BankStatementLine.bank_account_id == bank_account_id)
        .order_by(BankStatementLine.statement_date.desc())
        .all()
    )


@router.post("/accounts")
def create_bank_account(payload: BankAccountCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role in {UserRole.auditor, UserRole.fellow}:
        raise HTTPException(status_code=403, detail="Only coordinator/finance can create bank accounts")
    account = BankAccount(**payload.model_dump(), created_by_id=user.id, updated_by_id=user.id)
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
    if user.role in {UserRole.auditor, UserRole.fellow}:
        raise HTTPException(status_code=403, detail="Only coordinator/finance can import statements")
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




@router.post("/import/preview")
async def preview_statement_import(
    file: UploadFile = File(...),
    file_format: str = Form("auto"),
    field_mapping: str = Form("{}"),
    _: User = Depends(get_current_user),
):
    content = await file.read()
    rows = parse_statement_file(content, file.filename or '', file_format=file_format, field_mapping_raw=field_mapping)
    normalized = []
    for row in rows:
        normalized.append({
            'statement_date': row['statement_date'].isoformat(),
            'description': row['description'],
            'debit': str(row['debit']),
            'credit': str(row['credit']),
            'closing_balance': str(row['closing_balance']) if row.get('closing_balance') is not None else None,
        })
    return {'rows': normalized, 'count': len(normalized)}


@router.post("/reconcile/{statement_line_id}/{transaction_id}")
def reconcile(
    statement_line_id: int,
    transaction_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role in {UserRole.auditor, UserRole.fellow}:
        raise HTTPException(status_code=403, detail="Only coordinator/finance can reconcile")
    line = db.get(BankStatementLine, statement_line_id)
    txn = db.get(Transaction, transaction_id)
    if not line or not txn:
        raise HTTPException(status_code=404, detail="Missing statement line or transaction")
    line.matched_transaction_id = transaction_id
    line.is_reconciled = True
    db.commit()
    return {"status": "reconciled"}
