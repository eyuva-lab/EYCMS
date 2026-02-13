from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import Account, BudgetHead, Project, User
from app.schemas import AccountCreate, BudgetHeadCreate, ProjectCreate

router = APIRouter(prefix="/master", tags=["master-data"])


@router.post("/accounts")
def create_account(payload: AccountCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    account = Account(**payload.model_dump())
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.get("/accounts")
def list_accounts(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Account).all()


@router.post("/projects")
def create_project(payload: ProjectCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = Project(**payload.model_dump(), created_by_id=user.id, updated_by_id=user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/projects")
def list_projects(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Project).all()


@router.post("/budget-heads")
def create_budget_head(payload: BudgetHeadCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    head = BudgetHead(**payload.model_dump(), created_by_id=user.id, updated_by_id=user.id)
    db.add(head)
    db.commit()
    db.refresh(head)
    return head


@router.get("/budget-heads")
def list_budget_heads(project_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    q = db.query(BudgetHead)
    if project_id:
        q = q.filter(BudgetHead.project_id == project_id)
    return q.all()
