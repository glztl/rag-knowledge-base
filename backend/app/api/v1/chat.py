from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional

from app.db.session import get_db
from app.models.user import User
from app.models.chat import ChatSession, ChatMessage
from app.core.security import get_current_active_user
from app.core.rag_service import rag_service

from app.schemas.chat import ChatSessionResponse, ChatMessageResponse, ChatSessionCreate, ChatSessionDetail, ChatRequest
from app.schemas.document import ChunkSearchResult

router = APIRouter()


@router.post("/sessions", response_model=ChatSessionResponse)
async def create_session(
    session_data: ChatSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """创建新对话"""
    session = ChatSession(
        title=session_data.title,
        user_id=current_user.id,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/sessions", response_model=list[ChatSessionResponse])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取对话列表"""
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
    )
    sessions = result.scalars().all()
    
    # 获取消息数量
    session_list = []
    for session in sessions:
        count_result = await db.execute(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.session_id == session.id
            )
        )
        message_count = count_result.scalar()
        session_dict = ChatSessionResponse.model_validate(session)
        session_dict.message_count = message_count
        session_list.append(session_dict)
    
    return session_list


@router.get("/sessions/{session_id}", response_model=ChatSessionDetail)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取对话详情"""
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="对话不存在")
    
    # 获取消息
    messages_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    messages = messages_result.scalars().all()
    
    return ChatSessionDetail(
        id=session.id,
        title=session.title,
        user_id=session.user_id,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[ChatMessageResponse.model_validate(m) for m in messages],
    )


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """删除对话"""
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="对话不存在")
    
    await db.delete(session)
    await db.commit()
    
    return {"message": "对话已删除"}


@router.post("/chat")
async def chat(
    request: ChatRequest,
    session_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """聊天问答（保存历史）"""
    # 获取用户消息
    user_message = None
    for msg in reversed(request.messages):
        if msg.role == "user":
            user_message = msg.content
            break
    
    if not user_message:
        raise HTTPException(status_code=400, detail="没有用户消息")
    
    # 向量搜索
    contexts = await rag_service.search_similar(db, user_message, request.top_k)
    context_texts = [c["content"] for c in contexts]
    
    # 生成答案
    answer = await rag_service.generate_answer(
        user_message, context_texts, stream=False
    )
    
    # 保存到数据库（如果有 session_id）
    if session_id:
        # 保存用户消息
        user_msg = ChatMessage(
            session_id=session_id,
            role="user",
            content=user_message,
        )
        db.add(user_msg)
        
        # 保存 AI 回复
        assistant_msg = ChatMessage(
            session_id=session_id,
            role="assistant",
            content=answer,
            sources=contexts,
        )
        db.add(assistant_msg)
        
        # 更新会话标题（如果是第一条消息）
        session_result = await db.execute(
            select(ChatSession).where(
                ChatSession.id == session_id,
                ChatSession.user_id == current_user.id
            )
        )
        session = session_result.scalar_one_or_none()
        if session and len(contexts) == 0:
            session.title = user_message[:50]
        
        await db.commit()
    
    return {
        "answer": answer,
        "sources": [
            ChunkSearchResult(
                id=c["id"],
                content=c["content"],
                score=c["score"],
                chunk_metadata=c.get("chunk_metadata"),
            )
            for c in contexts
        ],
    }