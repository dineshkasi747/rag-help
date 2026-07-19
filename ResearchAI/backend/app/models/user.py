from sqlalchemy import Column, Integer, String, DateTime, func
from app.db.base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(320), unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String(120), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
