from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ChatMessageCreate(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str
    sources: Optional[list] = None


class ChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    sources: Optional[list] = None
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class ChatSessionCreate(BaseModel):
    title: Optional[str] = "新对话"


class ChatSessionResponse(BaseModel):
    id: int
    title: str
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime]
    message_count: int | None = 0

    class Config:
        from_attributes = True


class ChatSessionDetail(ChatSessionResponse):
    messages: List[ChatMessageResponse] = []


class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    top_k: int = Field(default=3, ge=1, le=20) 
    stream: bool = Field(default=True) # 可选，默认检索 top 3
    session_id: Optional[int] = None  # ⚠️ 添加这行

class ChatSessionUpdate(BaseModel):
    """更新对话"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)