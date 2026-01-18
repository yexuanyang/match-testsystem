import json
import os
import re
import time
from datetime import datetime

import docker
import redis
from app import models
from app.core.config import settings
from app.core.database import SessionLocal
from sqlalchemy.orm import Session

# Initialize Docker Client
# 默认连接到 /var/run/docker.sock
docker_client = docker.from_env()

# Initialize Redis
r = redis.from_url(settings.REDIS_URL)


def get_host_path(container_path: str):
    """
    Transform a path inside the backend container to a path on the host system.
    We know:
    Container: settings.UPLOAD_DIR (/app/data/uploads)
    Host: settings.HOST_UPLOAD_DIR (e.g., /home/user/project/data/uploads)
    """
    rel_path = os.path.relpath(container_path, settings.UPLOAD_DIR)
    host_path = os.path.join(settings.HOST_UPLOAD_DIR, rel_path)
    return os.path.abspath(host_path)


def process_submission(db: Session, submission_id: int):
    print(f"Processing submission {submission_id}...")
    submission = (
        db.query(models.Submission)
        .filter(models.Submission.id == submission_id)
        .first()
    )
    if not submission:
        print(f"Submission {submission_id} not found in DB.")
        return

    try:
        # Update Status to Running
        submission.status = "Running"
        db.commit()

        problem = submission.problem

        # Prepare paths
        # Assumption: The answer file is what we mount.
        # We mount the directory containing the answer to /input inside the container
        # Or mount the file directly. Let's mount the file to /input/answer.zip
        host_answer_path = get_host_path(submission.answer_path)

        # Prepare Log File
        log_filename = f"{submission.id}_{int(time.time())}.log"
        log_path_container = os.path.join(settings.LOG_DIR, log_filename)
        # Ensure log dir exists
        os.makedirs(settings.LOG_DIR, exist_ok=True)

        print(f"Running container for image: {problem.docker_image}")

        # Determine submission map path
        submission_map_target = (
            problem.submission_map_path
            if problem.submission_map_path
            else "/input/submission.zip"
        )
        print(f"Mounting {host_answer_path} to {submission_map_target}")

        volumes = {host_answer_path: {"bind": submission_map_target, "mode": "ro"}}

        run_command = problem.test_command

        # Check for test script
        if problem.test_script_path and os.path.exists(problem.test_script_path):
            try:
                host_script_path = get_host_path(problem.test_script_path)
                print(f"Mounting script {host_script_path} to /test_script.sh")
                volumes[host_script_path] = {"bind": "/test_script.sh", "mode": "ro"}
                run_command = "sh /test_script.sh"
            except Exception as e:
                print(f"Error resolving script path: {e}")
                # Fallback to command or fail? Let's proceed with command if script fails,
                # but likely we should just let it fail or log it.
                pass

        # Run Container
        container = docker_client.containers.run(
            image=problem.docker_image,
            command=run_command,
            volumes=volumes,
            detach=True,
            mem_limit="512m",  # 限制内存
            memswap_limit="512m",  # 禁用 swap
            cpu_quota=50000,  # 限制 CPU (0.5 CPU)
            cpu_period=100000,
            network_disabled=True,  # 禁用网络
            read_only=False,  # 允许写入（测试需要）
            cap_drop=["ALL"],  # 移除所有 capabilities
            security_opt=["no-new-privileges"],  # 防止提权
            pids_limit=100,  # 限制进程数
            labels={"leaderboard_submission_id": str(submission_id)},
        )

        # Wait for finish with timeout
        try:
            result = container.wait(timeout=300)  # 5 分钟超时
            exit_code = result["StatusCode"]
        except Exception as e:
            print(f"Container timeout or error for submission {submission_id}: {e}")
            # Kill the container
            try:
                container.kill()
            except:
                pass
            exit_code = -1
            logs = f"Container execution timeout (>300s) or error: {str(e)}"

            # Remove container
            try:
                container.remove(force=True)
            except:
                pass

            # Write error log
            log_filename = f"{submission.id}_{int(time.time())}.log"
            log_path_container = os.path.join(settings.LOG_DIR, log_filename)
            with open(log_path_container, "w") as f:
                f.write(f"Exit Code: {exit_code}\n")
                f.write("-" * 20 + "\n")
                f.write(logs)

            submission.status = "Failed"
            submission.score = 0.0
            submission.log_path = log_path_container
            submission.finished_at = datetime.utcnow()
            db.commit()
            print(f"Submission {submission_id} timeout/error handled")
            return

        # Get Logs
        logs = container.logs(stdout=True, stderr=True).decode("utf-8", errors="ignore")

        # Remove container
        container.remove(force=True)

        # Write Logs to File
        with open(log_path_container, "w") as f:
            f.write(f"Exit Code: {exit_code}\n")
            f.write("-" * 20 + "\n")
            f.write(logs)

        # Parse Score
        # Simple Logic: Look for "SCORE: <float>"
        score = 0.0
        score_match = re.search(r"SCORE:\s*([\d\.]+)", logs)
        if score_match:
            try:
                score = float(score_match.group(1))
            except:
                pass
        elif exit_code == 0:
            score = (
                0.0  # Default full score if success and no score printed? Or maybe 0.
            )

        # Parse Performance (if enabled for this problem)
        performance = None
        if problem.performance_enabled:
            performance_match = re.search(r"PERFORMANCE:\s*([\d\.]+)", logs)
            if performance_match:
                try:
                    performance = float(performance_match.group(1))
                except:
                    pass

        # Update DB
        submission.status = "Success" if exit_code == 0 else "Failed"
        submission.score = score
        submission.performance = performance
        submission.log_path = log_path_container
        submission.finished_at = datetime.utcnow()
        db.commit()
        print(
            f"Submission {submission_id} finished. Status: {submission.status}, Score: {score}"
        )

    except Exception as e:
        print(f"Error processing submission {submission_id}: {e}")
        submission.status = "Error"
        # Try to save error log
        try:
            log_path_container = os.path.join(
                settings.LOG_DIR, f"{submission.id}_error.log"
            )
            with open(log_path_container, "w") as f:
                f.write(str(e))
            submission.log_path = log_path_container
        except:
            pass
        db.commit()


def main():
    print("Worker started. Connecting to Redis...")
    # Ensure connections
    db = SessionLocal()

    while True:
        try:
            # Blocking pop
            # Returns tuple (queue_name, value)
            item = r.blpop("submission_queue", timeout=5)
            if item:
                submission_id = int(item[1])
                process_submission(db, submission_id)
            else:
                # Keep connection alive check or just loop
                pass
        except redis.exceptions.ConnectionError:
            print("Redis connection lost. Retrying in 5s...")
            time.sleep(5)
        except Exception as e:
            print(f"Worker Loop Error: {e}")
            time.sleep(1)


if __name__ == "__main__":
    main()
