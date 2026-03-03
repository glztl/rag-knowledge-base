# app/models/user.py
from __future__ import annotations  # 避免循环导入
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.sql import func
from app.db.session import Base

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .document import Document  
    from .chat import ChatSession

class User(Base):
    """用户表"""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # 关联文档 (使用字符串注解，避免循环导入)
    documents: Mapped[List["Document"]] = relationship(
        "Document",
        back_populates="owner",
        cascade="all, delete-orphan"
    )

    # 关联聊天会话
    chat_sessions: Mapped[List["ChatSession"]] = relationship(
        "ChatSession",
        back_populates="owner",
        cascade="all, delete-orphan"
    )