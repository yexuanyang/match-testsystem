import os
import shutil
import uuid
from typing import Any, List, Optional

import docker
import redis
from app import models, schemas
from app.api import deps
from app.core.config import settings
from app.core.database import get_db
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

router = APIRouter()

# Redis Connection
r = redis.from_url(settings.REDIS_URL)


@router.get("/", response_model=List[schemas.SubmissionOut])
def read_submissions(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    problem_id: Optional[int] = None,
    all_users: bool = False,
    sort_order: str = "desc",
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve submissions.
    If all_users is True, return all submissions from all users (including admins).
    Otherwise, return only the currentgg user's submissions.
    """
    query = db.query(models.Submission)

    if all_users:
        # Return all submissions from all users
        if not current_user.is_admin:
            # Ordinary users cannot see admin submissions
            query = query.join(models.User).filter(models.User.is_admin == False)
    else:
        # Return only own submissions
        query = query.filter(models.Submission.user_id == current_user.id)

    if problem_id:
        query = query.filter(models.Submission.problem_id == problem_id)

    if sort_order == "asc":
        query = query.order_by(models.Submission.submitted_at.asc())
    else:
        query = query.order_by(models.Submission.submitted_at.desc())

    submissions = query.offset(skip).limit(limit).all()
    return submissions


@router.post("/", response_model=schemas.SubmissionOut)
def create_submission(
    *,
    db: Session = Depends(get_db),
    problem_id: int = Form(...),
    answer_file: UploadFile = File(...),
    report_file: Optional[UploadFile] = File(None),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Submit a solution.
    """
    # Check problem exists
    problem = db.query(models.Problem).filter(models.Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    # Generate paths
    submission_id = str(uuid.uuid4())  # Temporary ID for file naming, real ID from DB

    # Structure: uploads/{user_id}/{problem_id}/{uuid}/
    save_dir = os.path.join(
        settings.UPLOAD_DIR, str(current_user.id), str(problem_id), submission_id
    )
    os.makedirs(save_dir, exist_ok=True)

    # Save Answer File
    answer_filename = f"answer_{answer_file.filename}"
    answer_path = os.path.join(save_dir, answer_filename)
    with open(answer_path, "wb") as buffer:
        shutil.copyfileobj(answer_file.file, buffer)

    # Save Report File (if exists)
    report_path_str = None
    if report_file:
        report_filename = f"report_{report_file.filename}"
        report_path = os.path.join(save_dir, report_filename)
        with open(report_path, "wb") as buffer:
            shutil.copyfileobj(report_file.file, buffer)
        # Store relative path for portability if needed, but absolute is fine for now
        report_path_str = report_path

    # Create DB Record
    db_submission = models.Submission(
        user_id=current_user.id,
        problem_id=problem_id,
        status="Pending",
        answer_path=answer_path,
        report_path=report_path_str,
    )
    db.add(db_submission)
    db.commit()
    db.refresh(db_submission)

    # Push to Redis Queue
    r.rpush("submission_queue", db_submission.id)

    return db_submission


@router.get("/{submission_id}/log")
def get_submission_log(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
):
    submission = (
        db.query(models.Submission)
        .filter(models.Submission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if not current_user.is_admin and submission.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough privileges")

    if not submission.log_path or not os.path.exists(submission.log_path):
        return {"log": "Log not available yet or file missing."}

    with open(submission.log_path, "r") as f:
        content = f.read()

    return {"log": content}


@router.delete("/{submission_id}", response_model=schemas.SubmissionOut)
def delete_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_admin_user),
):
    """
    Delete a submission. Only Admin.
    """
    submission = (
        db.query(models.Submission)
        .filter(models.Submission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    db.delete(submission)
    db.commit()
    return submission


@router.post("/{submission_id}/cancel")
def cancel_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_admin_user),
):
    """
    Cancel a running submission by killing the docker container. Only Admin.
    """
    submission = (
        db.query(models.Submission)
        .filter(models.Submission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if submission.status != "Running":
        raise HTTPException(status_code=400, detail="Submission is not running")

    # Try to find container with label
    try:
        client = docker.from_env()
        containers = client.containers.list(
            filters={"label": f"leaderboard_submission_id={submission.id}"}
        )

        for container in containers:
            print(f"Killing container {container.id} for submission {submission.id}")
            container.kill()

        submission.status = "Cancelled"
        db.commit()
        return {"message": "Submission cancelled"}

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to cancel submission: {str(e)}"
        )
