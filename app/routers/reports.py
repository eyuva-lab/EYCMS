from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import ReportTemplate, User
from app.schemas import GenerateReportRequest, ReportTemplateCreate
from app.services.reporting import generate_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/templates")
def create_template(payload: ReportTemplateCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    template = ReportTemplate(**payload.model_dump(), created_by_id=user.id, updated_by_id=user.id)
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.get("/templates")
def list_templates(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(ReportTemplate).all()


@router.post("/generate")
def run_report(payload: GenerateReportRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        report = generate_report(
            db,
            template_id=payload.template_id,
            project_id=payload.project_id,
            from_date=payload.from_date,
            to_date=payload.to_date,
            parameters=payload.parameters,
            user_id=user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return {
        "report_id": report.id,
        "html_output": report.html_output,
        "pdf_path": report.pdf_path,
    }
