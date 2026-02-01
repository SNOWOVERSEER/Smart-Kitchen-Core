import os
from sqlmodel import SQLModel, Session, create_engine

# Database URL Configuration
# Inside Docker, POSTGRES_HOST resolves to "db" (internal network)
USER = os.getenv("POSTGRES_USER", "user")
PASSWORD = os.getenv("POSTGRES_PASSWORD", "password")
DB_NAME = os.getenv("POSTGRES_DB", "db")
HOST = os.getenv("POSTGRES_HOST", "localhost")

DATABASE_URL = f"postgresql://{USER}:{PASSWORD}@{HOST}/{DB_NAME}"

# Create engine - the core connection to the database
engine = create_engine(DATABASE_URL, echo=True)


def create_db_and_tables() -> None:
    """Create all tables defined by SQLModel subclasses."""
    SQLModel.metadata.create_all(engine)


def get_db():
    """
    Dependency injection for FastAPI.
    Yields a database session for each request, auto-closes on completion.
    """
    with Session(engine) as session:
        yield session
