import posixpath

DEFAULT_SUBMISSION_MAP_PATH = "/input/submission.zip"


def resolve_submission_bind_target(
    submission_map_path: str | None, submitted_filename: str
) -> str:
    """
    Resolve where the submitted file should appear inside the grading container.
    Directory-like paths keep the upload name; explicit file paths preserve the
    old one-file bind behavior.
    """
    target = (submission_map_path or DEFAULT_SUBMISSION_MAP_PATH).strip()
    if not target:
        target = DEFAULT_SUBMISSION_MAP_PATH

    target_basename = posixpath.basename(target.rstrip("/"))
    _, target_ext = posixpath.splitext(target_basename)
    if target.endswith("/") or not target_ext:
        return posixpath.join(target, submitted_filename)

    return target
