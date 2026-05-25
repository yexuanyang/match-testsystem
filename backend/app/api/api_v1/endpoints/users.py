import csv
import io
from typing import Any, List

from app import models, schemas
from app.api import deps
from app.core import security
from app.core.database import get_db
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

router = APIRouter()


def _build_user_problem_scores_csv(
    users: List[models.User],
    problems: List[models.Problem],
    best_score_map: dict,
    best_performance_map: dict,
) -> str:
    output = io.StringIO()
    writer = csv.writer(output)

    headers = ["user_id", "username"]
    for problem in problems:
        headers.append(f"problem_{problem.id}_{problem.title}_score")
        headers.append(f"problem_{problem.id}_{problem.title}_performance")
    writer.writerow(headers)

    for user in users:
        row = [user.id, user.username]
        for problem in problems:
            score = best_score_map.get((user.id, problem.id))
            performance = best_performance_map.get((user.id, problem.id))
            row.append("" if score is None else score)
            row.append("" if performance is None else performance)
        writer.writerow(row)

    return output.getvalue()


@router.get("/", response_model=List[schemas.UserOut])
def read_users(
    response: Response,
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    """
    Retrieve users. Only for Admin.
    """
    query = db.query(models.User)
    total = query.count()
    response.headers["X-Total-Count"] = str(total)
    users = query.order_by(models.User.id).offset(skip).limit(limit).all()
    return users


@router.post("/", response_model=schemas.UserOut)
def create_user(
    *,
    db: Session = Depends(get_db),
    user_in: schemas.UserCreate,
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    """
    Create new user. Only for Admin.
    """
    user = (
        db.query(models.User).filter(models.User.username == user_in.username).first()
    )
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    user = models.User(
        username=user_in.username,
        hashed_password=security.get_password_hash(user_in.password),
        is_admin=user_in.is_admin,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/batch")
def create_users_batch(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_admin_user),
):
    """
    Batch create users from CSV.
    CSV Format: username,password
    """
    content = file.file.read().decode("utf-8")
    try:
        dialect = csv.Sniffer().sniff(content[:1024], delimiters=",\t")
    except csv.Error:
        # Fallback to comma-separated CSV when delimiter detection fails.
        dialect = csv.excel
    csv_reader = csv.reader(io.StringIO(content), dialect)

    created_count = 0
    errors = []

    for row in csv_reader:
        if len(row) < 2:
            continue
        username = row[0].strip()
        password = row[1].strip()

        if not username or not password:
            continue

        # Check exist
        existing = (
            db.query(models.User).filter(models.User.username == username).first()
        )
        if existing:
            errors.append(f"User {username} already exists")
            continue

        try:
            user = models.User(
                username=username,
                hashed_password=security.get_password_hash(password),
                is_admin=False,
            )
            db.add(user)
            created_count += 1
        except Exception as e:
            errors.append(f"Error creating {username}: {str(e)}")

    db.commit()
    return {"created": created_count, "errors": errors}


@router.get("/export/problem-scores")
def export_user_problem_scores_csv(
    db: Session = Depends(get_db),
    include_admin: bool = False,
    current_user: models.User = Depends(deps.get_current_admin_user),
):
    """
    Export per-user per-problem best score and best performance as CSV.
    Only available to Admin.
    """
    user_query = db.query(models.User)
    if not include_admin:
        user_query = user_query.filter(models.User.is_admin == False)
    users = user_query.order_by(models.User.id).all()

    problems = db.query(models.Problem).order_by(models.Problem.id).all()

    best_score_rows = (
        db.query(
            models.Submission.user_id,
            models.Submission.problem_id,
            func.max(models.Submission.score).label("best_score"),
        )
        .filter(models.Submission.score.isnot(None))
        .group_by(models.Submission.user_id, models.Submission.problem_id)
        .all()
    )
    best_score_map = {
        (row.user_id, row.problem_id): row.best_score for row in best_score_rows
    }

    best_performance_rows = (
        db.query(
            models.Submission.user_id,
            models.Submission.problem_id,
            func.max(models.Submission.performance).label("best_performance"),
        )
        .filter(models.Submission.performance.isnot(None))
        .group_by(models.Submission.user_id, models.Submission.problem_id)
        .all()
    )
    best_performance_map = {
        (row.user_id, row.problem_id): row.best_performance
        for row in best_performance_rows
    }

    csv_content = _build_user_problem_scores_csv(
        users,
        problems,
        best_score_map,
        best_performance_map,
    )

    filename = "user_problem_scores.csv"
    return StreamingResponse(
        iter([csv_content.encode("utf-8-sig")]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/me", response_model=schemas.UserOut)
def read_user_me(
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current user.
    """
    return current_user


@router.put("/me/password", response_model=schemas.UserOut)
def update_password(
    *,
    db: Session = Depends(get_db),
    password_in: schemas.UserUpdatePassword,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update own password.
    """
    if not security.verify_password(
        password_in.old_password, current_user.hashed_password
    ):
        raise HTTPException(status_code=400, detail="Incorrect password")

    current_user.hashed_password = security.get_password_hash(password_in.new_password)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/{user_id}/password")
def reset_user_password(
    user_id: int,
    password_in: schemas.UserUpdatePassword,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_admin_user),
):
    """
    Admin reset user password.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = security.get_password_hash(password_in.new_password)
    db.add(user)
    db.commit()
    return {"message": "Password updated successfully"}


@router.delete("/{user_id}", response_model=schemas.UserOut)
def delete_user(
    *,
    db: Session = Depends(get_db),
    user_id: int,
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    """
    Delete a user. Only for Admin.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this id does not exist in the system",
        )
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    # Check if user has submissions
    submission_count = (
        db.query(models.Submission).filter(models.Submission.user_id == user_id).count()
    )
    if submission_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete user: has {submission_count} submission(s). Delete submissions first.",
        )

    db.delete(user)
    db.commit()
    return user
