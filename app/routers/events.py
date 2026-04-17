from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import Event, Project, ReportTemplate, TemplateType, User, UserRole
from app.schemas import EventCreate
from app.services.reporting import render_template

router = APIRouter(prefix="/events", tags=["events"])


@router.post("")
def create_event(payload: EventCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role == UserRole.auditor:
        raise HTTPException(status_code=403, detail="Auditor has read-only access")

    if user.role == UserRole.fellow:
        if not payload.project_id:
            raise HTTPException(status_code=400, detail="Fellow must link event to own project")
        project = db.get(Project, payload.project_id)
        if not project or project.owner_user_id != user.id:
            raise HTTPException(status_code=403, detail="Fellow can only create events for own project")

    event = Event(**payload.model_dump(), created_by_id=user.id, updated_by_id=user.id)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("")
def list_events(project_id: int | None = None, limit: int = 100, offset: int = 0, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Event)
    if project_id:
        q = q.filter(Event.project_id == project_id)
    if user.role == UserRole.fellow:
        q = q.join(Project, Event.project_id == Project.id).filter(Project.owner_user_id == user.id)
    return q.order_by(Event.start_at.desc()).offset(offset).limit(min(limit, 500)).all()




@router.get("/{event_id}")
def get_event(event_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if user.role == UserRole.fellow:
        project = db.get(Project, event.project_id) if event.project_id else None
        if not project or project.owner_user_id != user.id:
            raise HTTPException(status_code=403, detail="Fellow can access own events only")
    return event


@router.post("/{event_id}/prior-approval")
def generate_prior_approval(event_id: int, template_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    event = db.get(Event, event_id)
    template = db.get(ReportTemplate, template_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not template or template.type != TemplateType.prior_approval:
        raise HTTPException(status_code=404, detail="Prior approval template not found")

    if user.role == UserRole.fellow:
        project = db.get(Project, event.project_id) if event.project_id else None
        if not project or project.owner_user_id != user.id:
            raise HTTPException(status_code=403, detail="Fellow can access own events only")

    html = render_template(
        template.html_template,
        {
            "event_title": event.title,
            "event_date": event.start_at.date(),
            "estimated_cost": event.estimated_cost,
            "description": event.description,
        },
    )
    return {
        "event_id": event_id,
        "template_id": template_id,
        "html": html,
        "pdf_status": "not_generated_in_dev",
    }
