from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import Event, ReportTemplate, TemplateType, User
from app.schemas import EventCreate
from app.services.reporting import render_template

router = APIRouter(prefix="/events", tags=["events"])


@router.post("")
def create_event(payload: EventCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    event = Event(**payload.model_dump(), created_by_id=user.id, updated_by_id=user.id)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("")
def list_events(project_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    q = db.query(Event)
    if project_id:
        q = q.filter(Event.project_id == project_id)
    return q.order_by(Event.start_at.desc()).all()


@router.post("/{event_id}/prior-approval")
def generate_prior_approval(event_id: int, template_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    event = db.get(Event, event_id)
    template = db.get(ReportTemplate, template_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not template or template.type != TemplateType.prior_approval:
        raise HTTPException(status_code=404, detail="Prior approval template not found")

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
