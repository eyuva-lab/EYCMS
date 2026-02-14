from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import Base, SessionLocal, engine
from .deps import hash_password
from .models import Project, User, UserRole
from .routers import auth, bank, events, master_data, reports, transactions, users

Base.metadata.create_all(bind=engine)


def seed_defaults() -> None:
    db = SessionLocal()
    try:
        default_email = "coordinator@eyuva.local"
        coordinator = db.query(User).filter(User.email == default_email).first()
        if not coordinator:
            coordinator = User(
                name="Default Coordinator",
                email=default_email,
                password_hash=hash_password("admin123"[:72]),
                role=UserRole.coordinator,
                is_active=True,
            )
            db.add(coordinator)
            db.commit()
            db.refresh(coordinator)

        centre = db.query(Project).filter(Project.is_centre_project.is_(True)).first()
        if not centre:
            centre = Project(
                code="CENTRE-EYUVA",
                name="E-YUVA Centre",
                description="Default seeded centre project",
                is_centre_project=True,
                owner_user_id=coordinator.id,
                created_by_id=coordinator.id,
                updated_by_id=coordinator.id,
            )
            db.add(centre)
            db.commit()
    finally:
        db.close()


seed_defaults()

app = FastAPI(title="E-YUVA Grant Manager")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(master_data.router)
app.include_router(transactions.router)
app.include_router(bank.router)
app.include_router(events.router)
app.include_router(reports.router)
app.include_router(users.router)

frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
