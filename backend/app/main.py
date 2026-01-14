from app import models
from app.api.api_v1.api import api_router
from app.core import security
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME, openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # Default permissive CORS for development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.on_event("startup")
def init_db():
    db = SessionLocal()
    # Check if admin exists
    user = (
        db.query(models.User)
        .filter(models.User.username == settings.FIRST_SUPERUSER)
        .first()
    )
    if not user:
        user = models.User(
            username=settings.FIRST_SUPERUSER,
            hashed_password=security.get_password_hash(
                settings.FIRST_SUPERUSER_PASSWORD
            ),
            is_admin=True,
        )
        db.add(user)
        db.commit()
        print(f"Superuser {settings.FIRST_SUPERUSER} created.")
    db.close()


@app.get("/")
def read_root():
    return {"message": "Welcome to Leaderboard API"}
