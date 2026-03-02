import json
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.document import (
    ChunkSearchRequest,
    ChunkSearchResult,
    ChatRequest,
)
from app.core.rag_service import rag_service

router = APIRouter()


@router.post("/search")
async def search_chunks(
    request: ChunkSearchRequest,
    db: AsyncSession = Depends(get_db),
):
    """向量搜索"""
    results = await rag_service.search_similar(
        db, request.query, request.top_k
    )
    return [
        ChunkSearchResult(
            id=r["id"],
            content=r["content"],
            score=r["score"],
        )
        for r in results
    ]


@router.post("/chat")
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """聊天问答（非流式）"""
    # 获取最后一条用户消息
    user_message = None
    for msg in reversed(request.messages):
        if msg.role == "user":
            user_message = msg.content
            break
    
    if not user_message:
        raise HTTPException(status_code=400, detail="没有用户消息")
    
    # 向量搜索
    contexts = await rag_service.search_similar(
        db, user_message, request.top_k
    )
    context_texts = [c["content"] for c in contexts]
    
    # 生成答案
    answer = await rag_service.generate_answer(
        user_message, context_texts, stream=False
    )
    
    return {
        "answer": answer,
        "sources": [
            ChunkSearchResult(
                id=c["id"],
                content=c["content"],
                score=c["score"],
                chunk_metadata=c.get("chunk_metadata")
            )
            for c in contexts
        ],
    }


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """聊天问答（流式）"""
    # 获取最后一条用户消息
    user_message = None
    for msg in reversed(request.messages):
        if msg.role == "user":
            user_message = msg.content
            break
    
    if not user_message:
        raise HTTPException(status_code=400, detail="没有用户消息")
    
    # 向量搜索
    contexts = await rag_service.search_similar(
        db, user_message, request.top_k
    )
    context_texts = [c["content"] for c in contexts]
    
    # 流式生成
    async def generate():
        try:
            async for chunk in rag_service.chat_stream(user_message, context_texts):
                # SSE 格式
                yield f" {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
            yield " [DONE]\n\n"
        except Exception as e:
            yield f" {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )