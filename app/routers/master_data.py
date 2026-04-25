from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import Account, BudgetHead, Project, User, UserRole
from app.schemas import (
    AccountCreate,
    AccountUpdate,
    BudgetHeadCreate,
    BudgetHeadUpdate,
    ProjectCreate,
    ProjectUpdate,
)

router = APIRouter(prefix="/master", tags=["master-data"])


def ensure_admin(current: User):
    if current.role not in {UserRole.coordinator, UserRole.finance}:
        raise HTTPException(status_code=403, detail="Only coordinator/finance can change master data")


@router.post("/accounts")
def create_account(payload: AccountCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_admin(user)
    account = Account(**payload.model_dump())
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.get("/accounts")
def list_accounts(limit: int = 100, offset: int = 0, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Account).order_by(Account.id.asc()).offset(offset).limit(min(limit, 500)).all()


@router.put("/accounts/{account_id}")
def update_account(account_id: int, payload: AccountUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_admin(user)
    account = db.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(account, key, value)
    db.commit()
    db.refresh(account)
    return account


@router.delete("/accounts/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_admin(user)
    account = db.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete(account)
    db.commit()
    return {"status": "deleted"}


@router.post("/projects")
def create_project(payload: ProjectCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_admin(user)
    project = Project(**payload.model_dump(), created_by_id=user.id, updated_by_id=user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/projects")
def list_projects(limit: int = 100, offset: int = 0, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Project)
    if user.role == UserRole.fellow:
        q = q.filter(Project.owner_user_id == user.id)
    return q.order_by(Project.id.asc()).offset(offset).limit(min(limit, 500)).all()


@router.put("/projects/{project_id}")
def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_admin(user)
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    project.updated_by_id = user.id
    db.commit()
    db.refresh(project)
    return project


@router.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_admin(user)
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return {"status": "deleted"}


@router.post("/budget-heads")
def create_budget_head(payload: BudgetHeadCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_admin(user)
    head = BudgetHead(**payload.model_dump(), created_by_id=user.id, updated_by_id=user.id)
    db.add(head)
    db.commit()
    db.refresh(head)
    return head


@router.get("/budget-heads")
def list_budget_heads(
    project_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(BudgetHead)
    if project_id:
        q = q.filter(BudgetHead.project_id == project_id)
    if user.role == UserRole.fellow:
        q = q.join(Project, BudgetHead.project_id == Project.id).filter(Project.owner_user_id == user.id)
    return q.order_by(BudgetHead.id.asc()).offset(offset).limit(min(limit, 500)).all()


@router.put("/budget-heads/{head_id}")
def update_budget_head(head_id: int, payload: BudgetHeadUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_admin(user)
    head = db.get(BudgetHead, head_id)
    if not head:
        raise HTTPException(status_code=404, detail="Budget head not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(head, key, value)
    head.updated_by_id = user.id
    db.commit()
    db.refresh(head)
    return head


@router.delete("/budget-heads/{head_id}")
def delete_budget_head(head_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_admin(user)
    head = db.get(BudgetHead, head_id)
    if not head:
        raise HTTPException(status_code=404, detail="Budget head not found")
    db.delete(head)
    db.commit()
    return {"status": "deleted"}


@router.get("/setup-status")
def setup_status(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    users_count = db.query(User).count()
    projects_count = db.query(Project).count()
    heads_count = db.query(BudgetHead).count()
    accounts_count = db.query(Account).count()

    return {
        "users": {"count": users_count, "done": users_count >= 2},
        "projects": {"count": projects_count, "done": projects_count >= 1},
        "budget_heads": {"count": heads_count, "done": heads_count >= 1},
        "accounts": {"count": accounts_count, "done": accounts_count >= 1},
    }
