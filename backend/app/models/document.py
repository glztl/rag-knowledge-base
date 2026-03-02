from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector



class Document(Base):
    """文档表"""
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    filename: Mapped[str] = mapped_column(
        String(255), nullable=False
    )

    file_path: Mapped[str] = mapped_column(
        String(500), nullable=False
    )

    file_size: Mapped[int] = mapped_column(
        Integer, nullable=False
    )

    file_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(50),
        default="processing"
    )

    error_message: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        onupdate=func.now()
    )

    # 关联文档块
    chunks: Mapped[List["DocumentChunk"]] = relationship(
        "DocumentChunk",
        back_populates="document",
        cascade="all, delete-orphan"
    )


class DocumentChunk(Base):
    """文档块表（向量存储）"""
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)

    document_id = Column(
        Integer,
        ForeignKey("documents.id"),
        nullable=False
    )

    content = Column(Text, nullable=False)

    embedding = Column(
        Vector(1536),
        nullable=True
    )

    chunk_index = Column(Integer, nullable=False)

    chunk_metadata = Column(   # ✅ 改名
        JSON,
        nullable=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    # 关联文档
    document = relationship(
        "Document",
        back_populates="chunks"
    )