from app import models
from app.core import security
from app.core.config import settings
from app.core.database import SessionLocal


def reset_admin():
    db = SessionLocal()
    try:
        username = settings.FIRST_SUPERUSER
        password = settings.FIRST_SUPERUSER_PASSWORD

        print(f"Attempting to reset/create user: {username} with password: {password}")

        user = db.query(models.User).filter(models.User.username == username).first()

        if user:
            print("User found. Updating password...")
            user.hashed_password = security.get_password_hash(password)
            user.is_admin = True
        else:
            print("User not found. Creating new admin user...")
            user = models.User(
                username=username,
                hashed_password=security.get_password_hash(password),
                is_admin=True,
            )
            db.add(user)

        db.commit()
        print("Successfully reset admin user.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    reset_admin()
