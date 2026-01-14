from typing import Any, List

from app import models, schemas
from app.api import deps
from app.core.database import get_db
from fastapi import APIRouter, Depends, HTTPException, status
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
    problem_in: schemas.ProblemCreate,
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    """
    Create new problem. Only Admin.
    """
    problem = models.Problem(
        title=problem_in.title,
        description=problem_in.description,
        docker_image=problem_in.docker_image,
        test_command=problem_in.test_command,
    )
    db.add(problem)
    db.commit()
    db.refresh(problem)
    return problem


@router.put("/{problem_id}", response_model=schemas.ProblemOut)
def update_problem(
    *,
    db: Session = Depends(get_db),
    problem_id: int,
    problem_in: schemas.ProblemCreate,
    current_user: models.User = Depends(deps.get_current_admin_user),
) -> Any:
    """
    Update a problem. Only Admin.
    """
    problem = db.query(models.Problem).filter(models.Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    problem.title = problem_in.title
    problem.description = problem_in.description
    problem.docker_image = problem_in.docker_image
    problem.test_command = problem_in.test_command

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
    """
    problem = db.query(models.Problem).filter(models.Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    db.delete(problem)
    db.commit()
    return problem
