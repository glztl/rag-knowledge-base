import os
import uuid
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import get_db, async_session_maker
from app.models.document import Document, DocumentChunk
from app.schemas.document import (
    DocumentUploadResponse,
    DocumentListResponse,
    DocumentDetailResponse,
)
from app.core.rag_service import rag_service

router = APIRouter()

# 上传目录
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../../../uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 允许的文件类型
ALLOWED_EXTENSIONS = {"pdf", "txt", "md", "docx"}


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    """上传文档"""
    # 验证文件类型
    if not file.filename or "." not in file.filename:
        raise HTTPException(status_code=400, detail="文件名无效或缺少扩展名")
    ext = file.filename.split(".")[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型：{ext}")

    # 生成唯一文件名
    file_id = str(uuid.uuid4())
    safe_filename = f"{file_id}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    # 保存文件
    try:
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件保存失败：{str(e)}")

    # 创建数据库记录
    document = Document(
        filename=file.filename,
        file_path=file_path,
        file_size=len(content),
        file_type=ext,
        status="processing",
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    # 异步处理文档（简化版：同步处理）
    try:
        # 加载文档
        documents = rag_service.load_document(file_path, ext)
        
        # 分割文档
        chunks = rag_service.split_documents(documents)
        chunk_texts = [chunk.page_content for chunk in chunks]
        
        # 生成向量
        if chunk_texts:
            embeddings = rag_service.embed_texts(chunk_texts)
            
            # 存储到数据库
            await rag_service.store_chunks(
                db, document.id, chunk_texts, embeddings
            )
        
        # 更新状态
        document.status = "completed"
        await db.commit()
        
        return DocumentUploadResponse(
            id=document.id,
            filename=document.filename,
            file_size=document.file_size,
            file_type=document.file_type,
            status=document.status,
            message=f"文档处理完成，共 {len(chunks)} 个片段",
        )
    except Exception as e:
        document.status = "failed"
        document.error_message = str(e)
        await db.commit()
        
        raise HTTPException(status_code=500, detail=f"文档处理失败：{str(e)}")


@router.get("/list", response_model=List[DocumentListResponse])
async def list_documents(db: AsyncSession = Depends(get_db)):
    """获取文档列表"""
    result = await db.execute(
        select(Document).order_by(Document.created_at.desc())
    )
    documents = result.scalars().all()
    return documents


@router.get("/{document_id}", response_model=DocumentDetailResponse)
async def get_document(document_id: int, db: AsyncSession = Depends(get_db)):
    """获取文档详情"""
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    # 获取片段数量
    chunk_result = await db.execute(
        select(func.count(DocumentChunk.id)).where(
            DocumentChunk.document_id == document_id
        )
    )
    chunk_count = chunk_result.scalar()
    if chunk_count is None:
        chunk_count = 0

    return DocumentDetailResponse(
        id=document.id,
        filename=document.filename,
        file_path=document.file_path,
        file_size=document.file_size,
        file_type=document.file_type,
        status=document.status,
        error_message=document.error_message,
        created_at=document.created_at,
        chunk_count=chunk_count,
    )


@router.delete("/{document_id}")
async def delete_document(document_id: int, db: AsyncSession = Depends(get_db)):
    """删除文档"""
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    # 删除文件
    if os.path.exists(document.file_path):
        os.remove(document.file_path)
    
    # 删除数据库记录
    await db.delete(document)
    await db.commit()
    
    return {"message": "文档已删除"}