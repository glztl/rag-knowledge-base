from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from app.config import settings

from sqlalchemy.orm import declarative_base

Base = declarative_base()

# 创建异步引擎
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",  # 开发环境打印 SQL
    pool_pre_ping=True,  # 连接前检查
)

# 创建会话工厂
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


from typing import AsyncGenerator

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """获取数据库会话 (依赖注入用)"""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


from app.models.document import Document, DocumentChunk

async def init_db():
    """初始化数据库"""
    try:
        async with engine.begin() as conn:
            # 启用 pgvector 扩展
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            
            # 创建所有表
            await conn.run_sync(Base.metadata.create_all)
            
        print("数据库初始化完成 - pgvector 扩展已启用")
        print("数据表已创建：documents, document_chunks")
    except Exception as e:
        print(f"数据库初始化警告：{e}")