from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db, hash_password
from app.models import User, UserRole
from app.schemas import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


def ensure_manage_permission(current: User):
    if current.role not in {UserRole.coordinator, UserRole.finance}:
        raise HTTPException(status_code=403, detail="Only coordinator/finance can manage users")


@router.get("", response_model=list[UserOut])
def list_users(limit: int = 100, offset: int = 0, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(User).order_by(User.id.asc()).offset(offset).limit(min(limit, 500)).all()


@router.post("", response_model=UserOut)
def create_user(payload: UserCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    ensure_manage_permission(current)
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


@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    ensure_manage_permission(current)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.email and payload.email != user.email:
        exists = db.query(User).filter(User.email == payload.email).first()
        if exists:
            raise HTTPException(status_code=400, detail="Email already used")

    data = payload.model_dump(exclude_unset=True)
    password = data.pop("password", None)
    for key, value in data.items():
        setattr(user, key, value)
    if password:
        user.password_hash = hash_password(password[:72])
    user.updated_by_id = current.id
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    ensure_manage_permission(current)
    if current.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    user.updated_by_id = current.id
    db.commit()
    return {"status": "deactivated"}
