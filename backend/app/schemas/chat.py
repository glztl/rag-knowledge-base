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
    top_k: int = 3  # 可选，默认检索 top 3