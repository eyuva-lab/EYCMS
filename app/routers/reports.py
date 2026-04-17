from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import PlaceholderDefinition, Project, ReportTemplate, TemplateFormat, TemplateType, User, UserRole
from app.schemas import (
    GenerateReportRequest,
    PlaceholderDefinitionCreate,
    PlaceholderDefinitionUpdate,
    ReportTemplateCreate,
)
from app.services.reporting import TEMPLATE_UPLOAD_DIR, evaluate_expression, generate_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/templates")
def create_template(payload: ReportTemplateCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role in {UserRole.auditor, UserRole.fellow}:
        raise HTTPException(status_code=403, detail="Only coordinator/finance can create templates")
    template = ReportTemplate(**payload.model_dump(), created_by_id=user.id, updated_by_id=user.id)
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.post("/templates/upload-word")
async def upload_word_template(
    name: str = Form(...),
    type: str = Form(...),
    template_format: str = Form(...),
    description: str | None = Form(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role in {UserRole.auditor, UserRole.fellow}:
        raise HTTPException(status_code=403, detail="Only coordinator/finance can upload templates")

    fmt = template_format.upper()
    if fmt not in {TemplateFormat.doc.value, TemplateFormat.docx.value}:
        raise HTTPException(status_code=400, detail="template_format must be DOC or DOCX")

    ext = ".docx" if fmt == TemplateFormat.docx.value else ".doc"
    if not (file.filename or "").lower().endswith(ext):
        raise HTTPException(status_code=400, detail=f"Uploaded file must end with {ext}")

    path = TEMPLATE_UPLOAD_DIR / f"tpl_{uuid4().hex}{ext}"
    path.write_bytes(await file.read())

    template = ReportTemplate(
        name=name,
        type=TemplateType(type),
        template_format=TemplateFormat(fmt),
        description=description,
        header_config={},
        layout_json={"source": "word-upload"},
        html_template="",
        template_file_path=str(path),
        created_by_id=user.id,
        updated_by_id=user.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.get("/templates")
def list_templates(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(ReportTemplate).all()


@router.post("/placeholders")
def create_placeholder(payload: PlaceholderDefinitionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role in {UserRole.auditor, UserRole.fellow}:
        raise HTTPException(status_code=403, detail="Only coordinator/finance can manage placeholders")
    if db.query(PlaceholderDefinition).filter(PlaceholderDefinition.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Placeholder already exists")

    item = PlaceholderDefinition(**payload.model_dump(), created_by_id=user.id, updated_by_id=user.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/placeholders")
def list_placeholders(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(PlaceholderDefinition).order_by(PlaceholderDefinition.name.asc()).all()


@router.put("/placeholders/{placeholder_id}")
def update_placeholder(
    placeholder_id: int,
    payload: PlaceholderDefinitionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role in {UserRole.auditor, UserRole.fellow}:
        raise HTTPException(status_code=403, detail="Only coordinator/finance can manage placeholders")
    item = db.get(PlaceholderDefinition, placeholder_id)
    if not item:
        raise HTTPException(status_code=404, detail="Placeholder not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    item.updated_by_id = user.id
    db.commit()
    db.refresh(item)
    return item


@router.post("/placeholders/{placeholder_id}/evaluate")
def evaluate_placeholder(placeholder_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = db.get(PlaceholderDefinition, placeholder_id)
    if not item:
        raise HTTPException(status_code=404, detail="Placeholder not found")
    try:
        value = evaluate_expression(db, item.expression_json or {}, item.filters_json or {})
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"name": item.name, "value": str(round(value, 2))}


@router.post("/generate")
def run_report(payload: GenerateReportRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role == UserRole.fellow:
        if not payload.project_id:
            raise HTTPException(status_code=400, detail="Fellow must select own project")
        project = db.get(Project, payload.project_id)
        if not project or project.owner_user_id != user.id:
            raise HTTPException(status_code=403, detail="Fellow can generate reports for own project only")

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

    html_output = report.html_output
    if report.pdf_path and report.output_format == "HTML" and Path(report.pdf_path).exists():
        html_output = Path(report.pdf_path).read_text(encoding="utf-8")
    return {
        "report_id": report.id,
        "html_output": html_output,
        "output_format": report.output_format,
        "file_path": report.pdf_path,
    }
