from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.db.session import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    print("🚀 应用启动中...")
    print(f"📍 环境：{settings.ENVIRONMENT}")
    await init_db()
    yield
    # 关闭时
    print("👋 应用关闭")


app = FastAPI(
    title="RAG Knowledge Base API",
    description="个人知识库问答系统后端 API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS 配置 (允许前端调用)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境需要限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "👋 Hello from RAG Backend!",
        "status": "running",
        "version": "0.1.0"
    }


@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT
    }


@app.get("/api/v1/test-db")
async def test_database():
    """测试数据库连接"""
    from app.db.session import async_session_maker
    from sqlalchemy import text
    
    try:
        async with async_session_maker() as session:
            result = await session.execute(text("SELECT 1"))
            row = result.fetchone()
            if row and row[0] == 1:
                # 检查 pgvector 扩展
                ext_result = await session.execute(
                    text("SELECT extname FROM pg_extension WHERE extname = 'vector'")
                )
                ext_row = ext_result.fetchone()
                vector_enabled = bool(ext_row)
                
                return {
                    "status": "connected",
                    "database": "PostgreSQL",
                    "pgvector": "enabled" if vector_enabled else "not enabled",
                    "message": "数据库连接成功"
                }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }
    
    return {"status": "unknown"}