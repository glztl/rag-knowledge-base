from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
import json

from app.db.session import get_db
from app.models.user import User
from app.models.chat import ChatSession, ChatMessage
from app.core.security import get_current_active_user
from app.core.rag_service import rag_service

from app.schemas.chat import (
    ChatSessionResponse,
    ChatMessageResponse,
    ChatSessionCreate,
    ChatSessionDetail,
    ChatRequest,
    ChatSessionUpdate,
)
from app.schemas.document import ChunkSearchResult
from app.config import settings

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


@router.patch("/sessions/{session_id}", response_model=ChatSessionResponse)
async def update_session(
    session_id: int,
    session_data: ChatSessionUpdate,  # ⚠️ 包含 title 字段
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """更新对话（标题等）"""
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="对话不存在")

    # 更新标题
    if session_data.title is not None:
        session.title = session_data.title

    session.updated_at = func.now()
    await db.commit()
    await db.refresh(session)

    return session


@router.get("/sessions/{session_id}", response_model=ChatSessionDetail)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取对话详情"""
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.user_id == current_user.id
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
            ChatSession.id == session_id, ChatSession.user_id == current_user.id
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
    """聊天问答（非流式）"""
    user_message = None
    for msg in reversed(request.messages):
        if msg.role == "user":
            user_message = msg.content
            break

    if not user_message:
        raise HTTPException(status_code=400, detail="没有用户消息")

    contexts = await rag_service.search_similar(db, user_message, request.top_k)
    context_texts = [c["content"] for c in contexts]

    answer = await rag_service.generate_answer(
        user_message, context_texts, stream=False
    )

    if session_id:
        user_msg = ChatMessage(
            session_id=session_id,
            role="user",
            content=user_message,
        )
        db.add(user_msg)

        assistant_msg = ChatMessage(
            session_id=session_id,
            role="assistant",
            content=answer,
            sources=contexts,
        )
        db.add(assistant_msg)

        session_result = await db.execute(
            select(ChatSession).where(
                ChatSession.id == session_id, ChatSession.user_id == current_user.id
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


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """聊天问答（流式）"""
    session_id = request.session_id

    print(f"🔍 [STREAM] 收到请求，session_id={session_id}")

    # 获取用户消息
    user_message = None
    for msg in reversed(request.messages):
        if msg.role == "user":
            user_message = msg.content
            break

    if not user_message:
        raise HTTPException(status_code=400, detail="没有用户消息")

    # ⚠️ 向量搜索
    contexts = await rag_service.search_similar(
        db, user_message, settings.DEFAULT_TOP_K
    )

    # ⚠️ 日志输出
    print(f"🔍 [STREAM] 检索到 {len(contexts)} 条内容")
    print(f"🔍 [STREAM] contexts 类型：{type(contexts)}")
    if contexts:
        print(f"🔍 [STREAM] 第一个元素类型：{type(contexts[0])}")
        for i, c in enumerate(contexts[:3]):
            if isinstance(c, dict):
                print(f"   [{i}] 相似度：{c.get('score', 0):.3f}")

    # 收集完整回答
    full_answer = ""

    async def generate():
        nonlocal full_answer

        try:
            print("🔄 [STREAM] 开始生成回答...")

            # ⚠️ 传递 contexts 给 rag_service
            async for chunk in rag_service.chat_stream(user_message, contexts):
                full_answer += chunk
                yield f" {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"

            print(f"✅ [STREAM] 生成完成，完整回答：{repr(full_answer)}")
            yield " [DONE]\n\n"

            # 保存到数据库
            if session_id and full_answer:
                print(f"💾 [STREAM] 保存消息到会话 {session_id}...")

                try:
                    user_msg = ChatMessage(
                        session_id=session_id,
                        role="user",
                        content=user_message,
                    )
                    db.add(user_msg)

                    assistant_msg = ChatMessage(
                        session_id=session_id,
                        role="assistant",
                        content=full_answer,
                        sources=contexts,
                    )
                    db.add(assistant_msg)

                    session_result = await db.execute(
                        select(ChatSession).where(
                            ChatSession.id == session_id,
                            ChatSession.user_id == current_user.id,
                        )
                    )
                    session = session_result.scalar_one_or_none()

                    if session:
                        if session.title == "新对话" or not session.title:
                            session.title = user_message[:50]
                        session.updated_at = func.now()

                    await db.commit()
                    print(f"✅ [STREAM] 消息保存成功！")

                except Exception as save_error:
                    print(f"❌ [STREAM] 保存失败：{save_error}")
                    await db.rollback()
                    raise

        except Exception as e:
            print(f"❌ [STREAM] 生成异常：{e}")
            import traceback

            traceback.print_exc()
            await db.rollback()
            yield f" {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
