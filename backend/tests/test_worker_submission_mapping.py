import os
import sys
import unittest

sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.submission_mapping import (
    DEFAULT_SUBMISSION_MAP_PATH,
    resolve_submission_bind_target,
)


class TestWorkerSubmissionMapping(unittest.TestCase):
    def test_default_mapping_uses_original_file_target(self):
        self.assertEqual(
            resolve_submission_bind_target(None, "20240001.zip"),
            DEFAULT_SUBMISSION_MAP_PATH,
        )

    def test_file_mapping_keeps_explicit_target(self):
        self.assertEqual(
            resolve_submission_bind_target("/input/submission.zip", "20240001.zip"),
            "/input/submission.zip",
        )

    def test_directory_mapping_preserves_submitted_filename(self):
        self.assertEqual(
            resolve_submission_bind_target("/workspace/", "20240001.zip"),
            "/workspace/20240001.zip",
        )

    def test_directory_mapping_without_trailing_slash_preserves_filename(self):
        self.assertEqual(
            resolve_submission_bind_target("/workspace", "20240001.zip"),
            "/workspace/20240001.zip",
        )


if __name__ == "__main__":
    unittest.main()
