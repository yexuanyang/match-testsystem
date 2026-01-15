import os
import shutil
from typing import Any, List, Optional

import docker
from app import models, schemas
from app.api import deps
from app.core.config import settings
from app.core.database import get_db
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

router = APIRouter()


@router.get("/", response_model=List[schemas.ProblemOut])
def read_problems(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve problems.
    """
    problems = (
        db.query(models.Problem)
        .order_by(models.Problem.id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return problems


@router.get("/{problem_id}", response_model=schemas.ProblemOut)
def read_problem(
    *,
    db: Session = Depends(get_db),
    problem_id: int,
) -> Any:
    """
    Get problem by ID.
    """
    problem = db.query(models.Problem).filter(models.Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem


@router.post("/", response_model=schemas.ProblemOut)
def create_problem(
    *,
    db: Session = Depends(get_db),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    docker_image: str = Form(...),
    test_command: Optional[str] = Form(None),
    submission_map_path: Optional[str] = Form(None),
    test_script_file: Optional[UploadFile] = File(None),
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    """
    Create new problem. Only Admin.
    """
    problem = models.Problem(
        title=title,
        description=description,
        docker_image=docker_image,
        test_command=test_command,
        submission_map_path=submission_map_path,
    )
    db.add(problem)
    db.commit()
    db.refresh(problem)

    if test_script_file:
        scripts_dir = os.path.join(settings.UPLOAD_DIR, "scripts")
        os.makedirs(scripts_dir, exist_ok=True)
        # Use problem ID in filename
        script_filename = f"{problem.id}_{test_script_file.filename}"
        script_path = os.path.join(scripts_dir, script_filename)

        with open(script_path, "wb") as buffer:
            shutil.copyfileobj(test_script_file.file, buffer)

        problem.test_script_path = script_path
        db.commit()
        db.refresh(problem)

    return problem


@router.put("/{problem_id}", response_model=schemas.ProblemOut)
def update_problem(
    *,
    db: Session = Depends(get_db),
    problem_id: int,
    title: str = Form(...),
    description: Optional[str] = Form(None),
    docker_image: str = Form(...),
    test_command: Optional[str] = Form(None),
    submission_map_path: Optional[str] = Form(None),
    test_script_file: Optional[UploadFile] = File(None),
    clear_script: bool = Form(False),
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    """
    Update a problem. Only Admin.
    """
    problem = db.query(models.Problem).filter(models.Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    problem.title = title
    problem.description = description
    problem.docker_image = docker_image
    problem.test_command = test_command
    problem.submission_map_path = submission_map_path

    if clear_script:
        problem.test_script_path = None

    if test_script_file:
        scripts_dir = os.path.join(settings.UPLOAD_DIR, "scripts")
        os.makedirs(scripts_dir, exist_ok=True)
        script_filename = f"{problem.id}_{test_script_file.filename}"
        script_path = os.path.join(scripts_dir, script_filename)

        with open(script_path, "wb") as buffer:
            shutil.copyfileobj(test_script_file.file, buffer)

        problem.test_script_path = script_path

    db.commit()
    db.refresh(problem)
    return problem


@router.delete("/{problem_id}", response_model=schemas.ProblemOut)
def delete_problem(
    *,
    db: Session = Depends(get_db),
    problem_id: int,
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    """
    Delete a problem. Only Admin.
    This will also delete all related submissions, cancelling any running ones first.
    """
    problem = db.query(models.Problem).filter(models.Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    # Get all submissions for this problem
    submissions = (
        db.query(models.Submission)
        .filter(models.Submission.problem_id == problem_id)
        .all()
    )

    # Cancel any running submissions by killing their docker containers
    try:
        client = docker.from_env()
        for submission in submissions:
            if submission.status == "Running":
                containers = client.containers.list(
                    filters={"label": f"leaderboard_submission_id={submission.id}"}
                )
                for container in containers:
                    print(
                        f"Killing container {container.id} for submission {submission.id}"
                    )
                    container.kill()
    except Exception as e:
        print(f"Warning: Failed to kill some containers: {str(e)}")

    # Delete all related submissions
    db.query(models.Submission).filter(
        models.Submission.problem_id == problem_id
    ).delete()

    # Delete the problem
    db.delete(problem)
    db.commit()
    return problem
