from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    String,
    DateTime,
    Float,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


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
    )  # 可以存储简单的文本，或者前端通过 API 获取 Markdown 文件内容
    description_path = Column(String, nullable=True)  # 存储 Markdown 文件路径
    docker_image = Column(String, nullable=False)  # 评测用的镜像名
    test_command = Column(String, nullable=True)  # 容器内执行的测试命令
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    submissions = relationship("Submission", back_populates="problem")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    problem_id = Column(Integer, ForeignKey("problems.id"))

    status = Column(
        String, default="Pending"
    )  # Pending, Queued, Running, Success, Failed, Error
    score = Column(Float, nullable=True)

    answer_path = Column(String, nullable=True)
    report_path = Column(String, nullable=True)
    log_path = Column(String, nullable=True)  # 存储日志文件的相对路径
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    problem_id = Column(Integer, ForeignKey("problems.id"))

    status = Column(String, default="Pending") # Pending, Queued, Running, Success, Failed, Error
    score = Column(Float, nullable=True)

    answer_path = Column(String, nullable=True)
    report_path = Column(String, nullable=True)
    log_path = Column(String, nullable=True) # 存储日志文件的相对路径

    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="submissions")
    problem = relationship("Problem", back_populates="submissions")
