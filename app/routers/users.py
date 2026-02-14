from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db, hash_password
from app.models import User, UserRole
from app.schemas import UserCreate, UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(User).order_by(User.id.asc()).all()


@router.post("", response_model=UserOut)
def create_user(payload: UserCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.role not in {UserRole.coordinator, UserRole.finance}:
        raise HTTPException(status_code=403, detail="Only coordinator/finance can create users")

    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already used")

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password[:72]),
        role=payload.role,
        created_by_id=current.id,
        updated_by_id=current.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
