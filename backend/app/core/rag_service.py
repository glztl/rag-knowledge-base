import os
import json
from typing import List, Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from langchain_community.embeddings import DashScopeEmbeddings

from langchain_community.chat_models import QianfanChatEndpoint
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage

from langchain_core.output_parsers import StrOutputParser
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    PyPDFLoader,
    TextLoader,
    UnstructuredMarkdownLoader,
    Docx2txtLoader,
)

from app import db
from app.config import settings
from app.models.document import DocumentChunk
from langchain_core.documents import Document


class RAGService:
    """RAG 服务类，负责处理文档上传、文本分割、向量化和问答"""

    def __init__(self) -> None:
        # 初始化Embeddings
        self.embeddings = DashScopeEmbeddings(
            model=settings.QWEN_EMBEDDING_MODEL,
            dashscope_api_key=settings.DASHSCOPE_API_KEY,
        )

        # init LLM (QWen)
        # use DashScope compatible interface
        from langchain_community.llms import Tongyi

        self.llm = Tongyi(
            model_name=settings.QWEN_MODEL,
            dashscope_api_key=settings.DASHSCOPE_API_KEY,
            temperature=0.7,
            streaming=True,
        )

        # 文本分割器
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=300,
            chunk_overlap=50,
            length_function=len,
        )

        # upload folder
        os.makedirs(settings.UPLOAD_FOLDER, exist_ok=True)


    def load_document(self, file_path: str, file_type: str) -> List[Document]:
        """加载文档"""
        loaders = {
            "pdf": PyPDFLoader,
            "txt": TextLoader,
            "md": UnstructuredMarkdownLoader,
            "docx": Docx2txtLoader,
        }

        loader_class = loaders.get(file_type.lower())
        if not loader_class:
            raise ValueError(f"不支持的文件类型: {file_type}")
        
        loader = loader_class(file_path)
        return loader.load()

    def split_documents(self, documents: List[Document]) -> List[Document]:
        """文档分割"""
        return self.text_splitter.split_documents(documents)
        return self.text_splitter.split_documents(documents)
    
    
    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """生成向量"""
        return self.embeddings.embed_documents(texts)
    

    def embed_query(self, query: str) -> List[float]:
        """生成查询向量"""
        return self.embeddings.embed_query(query)
    

    async def store_chunks(
            self,
            db: AsyncSession,
            document_id: int,
            chunks: List[str],
            embeddings: List[List[float]],
    ):
        """存储文档块到数据库"""
        for i, (content, embedding) in enumerate(zip(chunks, embeddings)):
                    # 确保 embedding 是 list of float，不是字符串
            if isinstance(embedding, str):
                embedding = json.loads(embedding)
            
            # 转换为 float 列表
            embedding = [float(x) for x in embedding]
            chunk = DocumentChunk(
                document_id=document_id,
                content=content,
                embedding=embedding,  # 直接存储为向量
                chunk_index=i,
                chunk_metadata={"source": f"chunk_{i}"},
            )
            db.add(chunk)

        await db.commit()


    async def search_similar(
            self,
            db: AsyncSession,
            query: str,
            top_k: int = 5,
    ) -> List[dict]:
        """向量相似度搜索"""
        
        # 生成查询向量
        query_embedding = self.embed_query(query)

        # 使用余弦相似度搜索
        query_str = """
                    SELECT 
                        id, content, chunk_index, chunk_metadata,
                        1 - (embedding <=> :embedding) as score
                    FROM document_chunks
                    WHERE embedding IS NOT NULL
                    ORDER BY score DESC
                    LIMIT :top_k
                    """


        # 将 query_embedding 转为 JSON 字符串（如果数据库字段为 JSON/字符串类型）
        embedding_str = json.dumps(query_embedding)
        result = await db.execute(
            text(query_str),
            {"embedding": embedding_str, "top_k": top_k}
        )

        rows = result.fetchall()
        return [
            {
                "id": row.id,
                "content": row.content,
                "score": float(row.score),
                "chunk_metadata": row.chunk_metadata,
                "source": row.chunk_metadata.get("source") if row.chunk_metadata else None,
            }
            for row in rows
        ]


    async def generate_answer(
            self,
            query: str,
            contexts: List[str],
            stream: bool = True,
    ):
        """生成答案"""
        
        # 构建Prompt
        context_text = "\n\n".join(contexts)
        prompt = f"""你是一个智能助手。请基于以下上下文信息回答问题。如果上下文中没有相关信息，请说明你不知道。

                上下文信息：
                {context_text}

                问题：{query}

                请用简洁、准确的语言回答："""
        
        if stream:
            # 流式输出
            return self.llm.stream(prompt)
        else:
            reponse = await self.llm.ainvoke(prompt)
            return reponse
    

    async def chat_stream(self, query: str, contexts: List[str]):
        """聊天接口，流式输出"""
        context_text = "\n\n".join(contexts)
        prompt = f"""你是一个智能助手。请基于以下上下文信息回答问题。如果上下文中没有相关信息，请说明你不知道。

                上下文信息：
                {context_text}

                问题：{query}

                请用简洁、准确的语言回答："""
        
        for chunk in self.llm.stream(prompt):
            yield chunk

# 单例
rag_service = RAGService()