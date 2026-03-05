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

from app.core import prompts


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
            if isinstance(embedding, str):
                embedding = json.loads(embedding)

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

        # 将 query_embedding 转为 JSON 字符串
        embedding_str = json.dumps(query_embedding)
        result = await db.execute(
            text(query_str), {"embedding": embedding_str, "top_k": top_k}
        )

        rows = result.fetchall()
        return [
            {
                "id": row.id,
                "content": row.content,
                "score": float(row.score),
                "chunk_metadata": row.chunk_metadata,
                "source": row.chunk_metadata.get("source")
                if row.chunk_metadata
                else None,
            }
            for row in rows
        ]

    def _build_prompt(self, query: str, contexts: List[dict]):
        """构建 Prompt"""
        # 获取 Prompt 模板
        prompt_with_context = settings.RAG_PROMPT_WITH_CONTEXT or prompts.RAG_PROMPT_WITH_CONTEXT
        prompt_without_context = settings.RAG_PROMPT_WITHOUT_CONTEXT or prompts.RAG_PROMPT_WITHOUT_CONTEXT
        
        # ⚠️ 修复：确保 contexts 是字典列表
        print(f"🔍 [RAG] contexts 类型：{type(contexts)}, 长度：{len(contexts)}")
        if contexts:
            print(f"🔍 [RAG] 第一个元素类型：{type(contexts[0])}")
        
        # ⚠️ 修复：安全地过滤相关内容
        threshold = settings.SIMILARITY_THRESHOLD
        relevant_contexts = []
        
        for c in contexts:
            try:
                # 如果是字典，获取 score
                if isinstance(c, dict):
                    score = c.get("score", 0)
                    if score >= threshold:
                        relevant_contexts.append(c)
                # 如果是字符串，直接使用（无相似度信息）
                elif isinstance(c, str):
                    relevant_contexts.append({"content": c, "score": 1.0})
            except Exception as e:
                print(f"⚠️ [RAG] 处理 context 失败：{e}")
                continue
        
        # ⚠️ 日志输出
        print(f"🔍 [RAG] 检索到 {len(contexts)} 条内容")
        print(f"🔍 [RAG] 相关内容 {len(relevant_contexts)} 条（阈值：{threshold}）")
        
        for i, c in enumerate(relevant_contexts[:3]):  # 只显示前 3 条
            print(f"   [{i}] 相似度：{c.get('score', 0):.3f}")
            print(f"       内容：{c.get('content', '')[:100]}...")
        
        if relevant_contexts:
            # 有相关内容
            context_text = "\n\n".join([c.get("content", str(c)) for c in relevant_contexts])
            
            # 限制上下文长度
            if len(context_text) > settings.MAX_CONTEXT_LENGTH:
                context_text = context_text[:settings.MAX_CONTEXT_LENGTH] + "..."
            
            print(f"✅ [RAG] 使用文档内容回答，上下文长度：{len(context_text)}")
            return prompt_with_context.format(
                context_text=context_text,
                query=query
            )
        else:
            # 无相关内容
            print(f"⚠️ [RAG] 无相关内容，使用通用知识")
            return prompt_without_context.format(query=query)
        
    async def chat_stream(self, query: str, contexts: List[dict]):
        """流式聊天生成器"""
        # 构建 Prompt
        prompt = self._build_prompt(query, contexts)
        
        print(f"🔍 [RAG] 流式生成，上下文数量：{len(contexts)}")
        print(f"🔍 [RAG] Prompt 长度：{len(prompt)}")
        
        try:
            for chunk in self.llm.stream(prompt):
                yield chunk
        except Exception as e:
            print(f"❌ [RAG] 流式生成失败：{e}")
            raise

    async def generate_answer(
            self,
            query: str,
            contexts: List[dict],
            stream: bool = True,
        ):
            """生成答案（非流式）"""
            prompt = self._build_prompt(query, contexts)
            
            if stream:
                return self.llm.stream(prompt)
            else:
                response = await self.llm.ainvoke(prompt)
                return response


# 单例
rag_service = RAGService()
