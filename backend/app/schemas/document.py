from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class DocumentUploadResponse(BaseModel):
    """文档上传响应"""
    id: int
    filename: str
    file_size: int
    file_type: str
    status: str
    message: str


class DocumentListResponse(BaseModel):
    """文档列表响应"""
    id: int
    filename: str
    file_size: int
    file_type: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentDetailResponse(BaseModel):
    """文档详情响应"""
    id: int
    filename: str
    file_path: str
    file_size: int
    file_type: str
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    chunk_count: int = 0


class ChunkSearchRequest(BaseModel):
    """向量搜索请求"""
    query: str = Field(..., min_length=1, description="搜索查询")
    top_k: int = Field(default=5, ge=1, le=20, description="返回结果数量")


class ChunkSearchResult(BaseModel):
    """向量搜索结果"""
    id: int
    content: str
    score: float
    chunk_metadata: Optional[dict] = None


class ChatMessage(BaseModel):
    """聊天消息"""
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str


class ChatRequest(BaseModel):
    """聊天请求"""
    messages: List[ChatMessage]
    top_k: int = Field(default=5, ge=1, le=20)
    stream: bool = Field(default=True)


class ChatResponse(BaseModel):
    """聊天响应"""
    answer: str
    sources: List[ChunkSearchResult] = []