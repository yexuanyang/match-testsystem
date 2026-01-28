import os
import sys
import unittest
from datetime import datetime
from unittest.mock import patch

# Add backend to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

# Mock redis.from_url globally
with patch("redis.from_url"):
    from app import models
    from app.api.api_v1.endpoints import submissions
    from app.core.database import Base

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

class TestSubmissionSort(unittest.TestCase):
    def setUp(self):
        # Setup In-Memory DB
        self.engine = create_engine(
            "sqlite:///:memory:", connect_args={"check_same_thread": False}
        )
        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=self.engine
        )
        self.db = self.SessionLocal()

        # Create User
        self.user = models.User(
            username="tester", hashed_password="pw", is_admin=True
        )
        self.db.add(self.user)
        self.db.commit()

        # Create Problem
        self.problem = models.Problem(title="P1", docker_image="img")
        self.db.add(self.problem)
        self.db.commit()

        # Create Submissions with different scores
        # s1: score 10
        self.s1 = models.Submission(
            user_id=self.user.id, problem_id=self.problem.id, score=10.0,
            submitted_at=datetime(2023, 1, 1, 10, 0, 0)
        )
        # s2: score 5
        self.s2 = models.Submission(
            user_id=self.user.id, problem_id=self.problem.id, score=5.0,
            submitted_at=datetime(2023, 1, 1, 11, 0, 0)
        )
        # s3: score 20
        self.s3 = models.Submission(
            user_id=self.user.id, problem_id=self.problem.id, score=20.0,
            submitted_at=datetime(2023, 1, 1, 12, 0, 0)
        )
        # s4: score None (should be handled gracefully, usually None comes last or first depending on DB default, 
        # but in Python sorting None comparison might fail if done manually. 
        # SQL standard: NULLS LAST or FIRST. SQLAlchemy default depends on backend.
        # For simplicity in this test, let's assume we care about numeric scores first.)
        self.s4 = models.Submission(
            user_id=self.user.id, problem_id=self.problem.id, score=None,
            submitted_at=datetime(2023, 1, 1, 13, 0, 0)
        )

        self.db.add_all([self.s1, self.s2, self.s3, self.s4])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_sort_by_score_desc(self):
        results = submissions.read_submissions(
            db=self.db, all_users=True, sort_order="score_desc", current_user=self.user
        )
        # Check order. None might be first or last. 
        # Typically in Postgres DESC, NULLS FIRST is default? No, NULLS LAST usually for DESC?
        # Let's filter out None to check the numeric order first
        scores = [s.score for s in results if s.score is not None]
        self.assertEqual(scores, [20.0, 10.0, 5.0])

    def test_sort_by_score_asc(self):
        results = submissions.read_submissions(
            db=self.db, all_users=True, sort_order="score_asc", current_user=self.user
        )
        scores = [s.score for s in results if s.score is not None]
        self.assertEqual(scores, [5.0, 10.0, 20.0])

    def test_sort_default_desc(self):
        # Default is usually by time desc
        results = submissions.read_submissions(
            db=self.db, all_users=True, sort_order="desc", current_user=self.user
        )
        ids = [s.id for s in results]
        # s4 is newest (13:00), s3 (12:00), s2 (11:00), s1 (10:00)
        self.assertEqual(ids, [self.s4.id, self.s3.id, self.s2.id, self.s1.id])

if __name__ == "__main__":
    unittest.main()
