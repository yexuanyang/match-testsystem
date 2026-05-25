import csv
import io
import os
import sys
import unittest
import asyncio

# Add backend to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app import models
from app.api.api_v1.endpoints import users
from app.core.database import Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


class TestUsersExportScores(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:", connect_args={"check_same_thread": False}
        )
        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=self.engine
        )
        self.db = self.SessionLocal()

        self.admin = models.User(username="admin", hashed_password="pw", is_admin=True)
        self.user_a = models.User(username="alice", hashed_password="pw", is_admin=False)
        self.user_b = models.User(username="bob", hashed_password="pw", is_admin=False)
        self.db.add_all([self.admin, self.user_a, self.user_b])
        self.db.commit()

        self.problem_1 = models.Problem(title="P1", docker_image="img")
        self.problem_2 = models.Problem(title="P2", docker_image="img")
        self.db.add_all([self.problem_1, self.problem_2])
        self.db.commit()

        # alice on P1: two submissions, should export best=80
        self.db.add_all(
            [
                models.Submission(
                    user_id=self.user_a.id,
                    problem_id=self.problem_1.id,
                    score=60.0,
                    performance=1.2,
                ),
                models.Submission(
                    user_id=self.user_a.id,
                    problem_id=self.problem_1.id,
                    score=80.0,
                    performance=1.8,
                ),
                models.Submission(
                    user_id=self.user_b.id,
                    problem_id=self.problem_2.id,
                    score=55.5,
                    performance=0.9,
                ),
                # Admin score should be excluded by default
                models.Submission(
                    user_id=self.admin.id,
                    problem_id=self.problem_1.id,
                    score=99.0,
                    performance=2.5,
                ),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _read_streaming_csv_text(self, response):
        async def consume():
            body = b""
            async for chunk in response.body_iterator:
                if isinstance(chunk, str):
                    chunk = chunk.encode("utf-8")
                body += chunk
            return body

        body = asyncio.run(consume())
        return body.decode("utf-8-sig")

    def test_export_excludes_admin_by_default(self):
        response = users.export_user_problem_scores_csv(
            db=self.db,
            include_admin=False,
            current_user=self.admin,
        )

        csv_text = self._read_streaming_csv_text(response)
        rows = list(csv.reader(io.StringIO(csv_text)))

        self.assertGreaterEqual(len(rows), 2)
        header = rows[0]
        self.assertEqual(header[0:2], ["user_id", "username"])

        usernames = [r[1] for r in rows[1:]]
        self.assertIn("alice", usernames)
        self.assertIn("bob", usernames)
        self.assertNotIn("admin", usernames)

        # Check best score aggregation for alice on P1
        p1_score_idx = next(
            i for i, h in enumerate(header) if h.startswith("problem_1_") and h.endswith("_score")
        )
        p1_perf_idx = next(
            i
            for i, h in enumerate(header)
            if h.startswith("problem_1_") and h.endswith("_performance")
        )
        alice_row = next(r for r in rows[1:] if r[1] == "alice")
        self.assertEqual(alice_row[p1_score_idx], "80.0")
        self.assertEqual(alice_row[p1_perf_idx], "1.8")

        # Check bob has value on P2 performance column only
        p2_perf_idx = next(
            i
            for i, h in enumerate(header)
            if h.startswith("problem_2_") and h.endswith("_performance")
        )
        bob_row = next(r for r in rows[1:] if r[1] == "bob")
        self.assertEqual(bob_row[p2_perf_idx], "0.9")

    def test_export_can_include_admin(self):
        response = users.export_user_problem_scores_csv(
            db=self.db,
            include_admin=True,
            current_user=self.admin,
        )

        csv_text = self._read_streaming_csv_text(response)
        rows = list(csv.reader(io.StringIO(csv_text)))
        usernames = [r[1] for r in rows[1:]]
        self.assertIn("admin", usernames)


if __name__ == "__main__":
    unittest.main()
