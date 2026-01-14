import os
import shutil
import uuid
from typing import Any

from app import models
from app.api import deps
from app.core.config import settings
from fastapi import APIRouter, Depends, File, UploadFile

router = APIRouter()


@router.post("/upload-image", response_model=dict)
def upload_image(
    image: UploadFile = File(...),
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    """
    Upload an image for markdown description. Only Admin.
    """
    # Ensure directory exists
    image_dir = os.path.join(settings.UPLOAD_DIR, "images")
    os.makedirs(image_dir, exist_ok=True)

    # Generate filename
    ext = os.path.splitext(image.filename)[1]
    filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(image_dir, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    # Return full URL so frontend can directly use it in markdown
    return {
        "url": f"{settings.BACKEND_URL}{settings.API_V1_STR}/utils/images/{filename}"
    }


@router.get("/images/{filename}")
def get_image(filename: str):
    from fastapi.responses import FileResponse

    image_path = os.path.join(settings.UPLOAD_DIR, "images", filename)
    if os.path.exists(image_path):
        return FileResponse(image_path)
    return {"error": "Image not found"}
