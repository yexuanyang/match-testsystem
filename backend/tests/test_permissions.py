import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Add backend to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

# Mock redis.from_url globally before importing app.api.api_v1.endpoints.submissions
# because it instantiates a redis client at module level.
with patch("redis.from_url") as mock_redis:
    from app import models
    from app.api.api_v1.endpoints import submissions
    from app.core.database import Base

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


class TestSubmissionPermissions(unittest.TestCase):
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

        # Create Users
        self.admin_user = models.User(
            username="admin", hashed_password="pw", is_admin=True
        )
        self.normal_user = models.User(
            username="user", hashed_password="pw", is_admin=False
        )
        self.other_user = models.User(
            username="other", hashed_password="pw", is_admin=False
        )

        self.db.add(self.admin_user)
        self.db.add(self.normal_user)
        self.db.add(self.other_user)
        self.db.commit()

        # Create Problems (needed for foreign key)
        self.problem = models.Problem(title="P1", docker_image="img")
        self.db.add(self.problem)
        self.db.commit()

        # Create Submissions
        self.sub_admin = models.Submission(
            user_id=self.admin_user.id, problem_id=self.problem.id
        )
        self.sub_normal = models.Submission(
            user_id=self.normal_user.id, problem_id=self.problem.id
        )
        self.sub_other = models.Submission(
            user_id=self.other_user.id, problem_id=self.problem.id
        )

        self.db.add(self.sub_admin)
        self.db.add(self.sub_normal)
        self.db.add(self.sub_other)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_admin_sees_all_in_all_users_view(self):
        # Admin requests all_users=True
        results = submissions.read_submissions(
            db=self.db, all_users=True, current_user=self.admin_user
        )
        ids = [s.id for s in results]
        self.assertIn(self.sub_admin.id, ids)
        self.assertIn(self.sub_normal.id, ids)
        self.assertIn(self.sub_other.id, ids)

    def test_normal_user_does_not_see_admin_in_all_users_view(self):
        # Normal user requests all_users=True
        results = submissions.read_submissions(
            db=self.db, all_users=True, current_user=self.normal_user
        )
        ids = [s.id for s in results]
        self.assertNotIn(
            self.sub_admin.id, ids, "Ordinary user should NOT see admin submissions"
        )
        self.assertIn(self.sub_normal.id, ids)
        self.assertIn(self.sub_other.id, ids)

    def test_normal_user_sees_only_own_in_my_submissions_view(self):
        # Normal user requests all_users=False
        results = submissions.read_submissions(
            db=self.db, all_users=False, current_user=self.normal_user
        )
        ids = [s.id for s in results]
        self.assertIn(self.sub_normal.id, ids)
        self.assertNotIn(self.sub_other.id, ids)
        self.assertNotIn(self.sub_admin.id, ids)


if __name__ == "__main__":
    unittest.main()
