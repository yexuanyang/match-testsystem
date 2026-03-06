import os
import shutil
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional

import docker
import redis
from app import models, schemas
from app.api import deps
from app.core.config import settings
from app.core.database import get_db
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

router = APIRouter()

# Redis Connection
r = redis.from_url(settings.REDIS_URL)

# Security Configuration
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
MAX_SUBMISSIONS_PER_HOUR = 10  # Maximum submissions per hour
MAX_SUBMISSIONS_PER_PROBLEM_PER_DAY = 20  # Maximum submissions per problem per day
MAX_PENDING_SUBMISSIONS = 3  # Maximum pending submissions per user
MIN_SUBMISSION_INTERVAL = 180  # Minimum submission interval (seconds), 3 minutes
ALLOWED_EXTENSIONS = {".zip"}  # Allowed file extensions
ALLOWED_REPORT_EXTENSIONS = {".pdf"}  # Allowed report file extensions


@router.get("/", response_model=List[schemas.SubmissionOut])
def read_submissions(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    problem_id: Optional[int] = None,
    submission_id: Optional[int] = None,
    all_users: bool = False,
    sort_order: str = "desc",
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve submissions.
    If all_users is True, return all submissions from all users (including admins).
    Otherwise, return only the current user's submissions.
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

    if submission_id:
        query = query.filter(models.Submission.id == submission_id)

    if sort_order == "asc":
        query = query.order_by(models.Submission.submitted_at.asc())
    elif sort_order == "score_desc":
        query = query.order_by(models.Submission.score.desc())
    elif sort_order == "score_asc":
        query = query.order_by(models.Submission.score.asc())
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
    # 1. Check if problem exists
    problem = db.query(models.Problem).filter(models.Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    # 2. File size validation
    answer_file.file.seek(0, 2)  # Seek to end of file
    file_size = answer_file.file.tell()
    answer_file.file.seek(0)  # Reset to beginning

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE / 1024 / 1024:.0f}MB",
        )

    if file_size == 0:
        raise HTTPException(status_code=400, detail="Empty file not allowed")

    # 3. File extension validation
    file_ext = os.path.splitext(answer_file.filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # 4. Check minimum submission interval (3 minutes) - Skip for admins
    if not current_user.is_admin:
        last_submission = (
            db.query(models.Submission)
            .filter(models.Submission.user_id == current_user.id)
            .order_by(models.Submission.submitted_at.desc())
            .first()
        )

        if last_submission:
            time_since_last = (
                datetime.now(timezone.utc) - last_submission.submitted_at
            ).total_seconds()
            if time_since_last < MIN_SUBMISSION_INTERVAL:
                wait_time = int(MIN_SUBMISSION_INTERVAL - time_since_last)
                raise HTTPException(
                    status_code=429,
                    detail=f"Please wait {wait_time} seconds before submitting again. Minimum interval: {MIN_SUBMISSION_INTERVAL // 60} minutes.",
                )

    # 5. Check submission frequency (hourly limit) - Skip for admins
    if not current_user.is_admin:
        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        recent_submissions = (
            db.query(models.Submission)
            .filter(
                models.Submission.user_id == current_user.id,
                models.Submission.submitted_at >= one_hour_ago,
            )
            .count()
        )

        if recent_submissions >= MAX_SUBMISSIONS_PER_HOUR:
            raise HTTPException(
                status_code=429,
                detail=f"Too many submissions. Maximum {MAX_SUBMISSIONS_PER_HOUR} per hour.",
            )

    # 6. Check per-problem submission frequency (daily limit) - Skip for admins
    if not current_user.is_admin:
        one_day_ago = datetime.now(timezone.utc) - timedelta(days=1)
        problem_submissions = (
            db.query(models.Submission)
            .filter(
                models.Submission.user_id == current_user.id,
                models.Submission.problem_id == problem_id,
                models.Submission.submitted_at >= one_day_ago,
            )
            .count()
        )

        if problem_submissions >= MAX_SUBMISSIONS_PER_PROBLEM_PER_DAY:
            raise HTTPException(
                status_code=429,
                detail=f"Too many submissions for this problem. Maximum {MAX_SUBMISSIONS_PER_PROBLEM_PER_DAY} per day.",
            )

    # 7. Check pending submissions count
    pending_count = (
        db.query(models.Submission)
        .filter(
            models.Submission.user_id == current_user.id,
            models.Submission.status.in_(["Pending", "Running"]),
        )
        .count()
    )

    if pending_count >= MAX_PENDING_SUBMISSIONS:
        raise HTTPException(
            status_code=429,
            detail=f"Too many pending submissions. Maximum {MAX_PENDING_SUBMISSIONS} concurrent submissions. Please wait for previous submissions to complete.",
        )

    # 8. Generate save path
    submission_id = str(uuid.uuid4())
    save_dir = os.path.join(
        settings.UPLOAD_DIR, str(current_user.id), str(problem_id), submission_id
    )
    os.makedirs(save_dir, exist_ok=True)

    # 9. Save answer file
    answer_filename = f"answer_{answer_file.filename}"
    answer_path = os.path.join(save_dir, answer_filename)
    with open(answer_path, "wb") as buffer:
        shutil.copyfileobj(answer_file.file, buffer)

    # 10. Save report file (optional)
    report_path_str = None
    if report_file:
        # Report file extension validation
        report_ext = os.path.splitext(report_file.filename)[1].lower()
        if report_ext not in ALLOWED_REPORT_EXTENSIONS:
            shutil.rmtree(save_dir, ignore_errors=True)
            raise HTTPException(
                status_code=400,
                detail=f"Report file type not allowed. Allowed: {', '.join(ALLOWED_REPORT_EXTENSIONS)}",
            )

        # Report file also needs size validation
        report_file.file.seek(0, 2)
        report_size = report_file.file.tell()
        report_file.file.seek(0)

        if report_size > MAX_FILE_SIZE:
            # Clean up already saved answer file
            shutil.rmtree(save_dir, ignore_errors=True)
            raise HTTPException(
                status_code=413,
                detail=f"Report file too large. Maximum size is {MAX_FILE_SIZE / 1024 / 1024:.0f}MB",
            )

        report_filename = f"report_{report_file.filename}"
        report_path = os.path.join(save_dir, report_filename)
        with open(report_path, "wb") as buffer:
            shutil.copyfileobj(report_file.file, buffer)
        report_path_str = report_path

    # 11. Create database record
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

    # 12. Push to Redis queue
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


@router.get("/{submission_id}/log/download")
def download_submission_log(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
):
    """
    Download the log file for a submission.
    """
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
        raise HTTPException(status_code=404, detail="Log file not found")

    return FileResponse(
        path=submission.log_path,
        filename=f"submission_{submission_id}.log",
        media_type="text/plain",
    )


@router.delete("/{submission_id}")
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
    current_user: models.User = Depends(deps.get_current_active_user),
):
    """
    Cancel a pending or running submission.
    - Users can cancel their own Pending submissions.
    - Admins can cancel any Pending or Running submission.
    """
    submission = (
        db.query(models.Submission)
        .filter(models.Submission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Permission check: users can only cancel their own submissions
    if not current_user.is_admin and submission.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough privileges")

    # Status check
    if submission.status not in ["Pending", "Running"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel submission with status '{submission.status}'",
        )

    # Non-admin users can only cancel Pending submissions
    if not current_user.is_admin and submission.status == "Running":
        raise HTTPException(
            status_code=403, detail="Only admins can cancel running submissions"
        )

    try:
        if submission.status == "Pending":
            # Remove from Redis queue if still there
            r.lrem("submission_queue", 0, submission.id)
            submission.status = "Cancelled"
            db.commit()
            return {"message": "Submission cancelled"}

        elif submission.status == "Running":
            # Kill the docker container
            client = docker.from_env()
            containers = client.containers.list(
                filters={"label": f"leaderboard_submission_id={submission.id}"}
            )

            for container in containers:
                print(
                    f"Killing container {container.id} for submission {submission.id}"
                )
                container.kill()

            submission.status = "Cancelled"
            db.commit()
            return {"message": "Submission cancelled"}

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to cancel submission: {str(e)}"
        )


@router.get("/stats/user/{user_id}")
def get_user_submission_stats(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_admin_user),
):
    """
    Get submission statistics for a user (Admin only).
    Used for monitoring potential abuse.
    """
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    one_day_ago = datetime.now(timezone.utc) - timedelta(days=1)

    total_submissions = (
        db.query(models.Submission).filter(models.Submission.user_id == user_id).count()
    )

    last_hour = (
        db.query(models.Submission)
        .filter(
            models.Submission.user_id == user_id,
            models.Submission.submitted_at >= one_hour_ago,
        )
        .count()
    )

    last_day = (
        db.query(models.Submission)
        .filter(
            models.Submission.user_id == user_id,
            models.Submission.submitted_at >= one_day_ago,
        )
        .count()
    )

    pending = (
        db.query(models.Submission)
        .filter(
            models.Submission.user_id == user_id,
            models.Submission.status.in_(["Pending", "Running"]),
        )
        .count()
    )

    return {
        "user_id": user_id,
        "total_submissions": total_submissions,
        "last_hour": last_hour,
        "last_day": last_day,
        "pending_submissions": pending,
        "limits": {
            "max_per_hour": MAX_SUBMISSIONS_PER_HOUR,
            "max_per_day_per_problem": MAX_SUBMISSIONS_PER_PROBLEM_PER_DAY,
            "max_pending": MAX_PENDING_SUBMISSIONS,
        },
    }
