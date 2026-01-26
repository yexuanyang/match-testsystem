from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


# User Schemas
class UserBase(BaseModel):
    username: str


class UserCreate(UserBase):
    password: str
    is_admin: bool = False


class UserUpdatePassword(BaseModel):
    old_password: str
    new_password: str


class UserOut(UserBase):
    id: int
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


# Problem Schemas (Placeholder for now)
class ProblemBase(BaseModel):
    title: str
    description: Optional[str] = None
    docker_image: str
    test_command: Optional[str] = None
    test_script_path: Optional[str] = None
    submission_map_path: Optional[str] = None
    attachments: Optional[str] = None  # JSON string of attachment info
    performance_enabled: bool = False
    performance_unit: Optional[str] = None


class ProblemCreate(ProblemBase):
    pass


class ProblemOut(ProblemBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Submission Schemas
class SubmissionOut(BaseModel):
    id: int
    user_id: int
    user: UserBase
    problem_id: int
    problem: ProblemOut  # Include full problem details
    status: str
    score: Optional[float] = None
    performance: Optional[float] = None
    submitted_at: datetime
    finished_at: Optional[datetime] = None

    class Config:
        from_attributes = True
