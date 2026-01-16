from app.core.database import Base
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    submissions = relationship("Submission", back_populates="user")


class Problem(Base):
    __tablename__ = "problems"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(
        Text, nullable=True
    )  # Store simple text or frontend fetches Markdown file content via API
    description_path = Column(String, nullable=True)  # Store Markdown file path
    docker_image = Column(String, nullable=False)  # Docker image for evaluation
    test_command = Column(String, nullable=True)  # Test command to execute in container
    test_script_path = Column(String, nullable=True)  # Store test script path
    submission_map_path = Column(
        String, nullable=True
    )  # Answer mapping path, defaults to /input/submission.zip
    attachments = Column(
        Text, nullable=True
    )  # JSON string storing attachment file info [{"filename": "x.patch", "path": "/uploads/..."}]
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    submissions = relationship("Submission", back_populates="problem")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    problem_id = Column(
        Integer, ForeignKey("problems.id", ondelete="RESTRICT"), nullable=False
    )

    status = Column(
        String, default="Pending"
    )  # Pending, Queued, Running, Success, Failed, Error
    score = Column(Float, nullable=True)

    answer_path = Column(String, nullable=True)
    report_path = Column(String, nullable=True)
    log_path = Column(String, nullable=True)  # 存储日志文件的相对路径

    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="submissions")
    problem = relationship("Problem", back_populates="submissions")
