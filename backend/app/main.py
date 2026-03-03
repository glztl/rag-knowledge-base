from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from contextlib import asynccontextmanager

from app.config import settings
from app.db.session import init_db

from scalar_fastapi import get_scalar_api_reference, Layout, Theme

from app.api.v1 import chat, documents

from app.core.security import get_current_active_user
from app.api.v1 import auth, documents, chat

from app.models.user import User  # Adjust the import path as needed


# API 元数据配置 (类似 Knife4j 文档说明)
metadata = {
    "title": "RAG Knowledge Base API",  # 必须是 title，不是 name
    "description": """
## 📚 个人知识库问答系统后端 API

### 🎯 功能模块

| 模块 | 说明 | 状态 |
|------|------|------|
| 文档管理 | PDF/Markdown 上传、解析 | 🟡 开发中 |
| 向量检索 | 基于 pgvector 的语义搜索 | 🟡 开发中 |
| AI 问答 | LLM 智能问答 | 🟡 开发中 |
| 用户管理 | 认证与授权 | ⚪ 待开发 |

---

### 🔧 技术栈

- 框架: FastAPI + Python 3.12
- 数据库: PostgreSQL 16 + pgvector
- AI: LangChain + OpenAI
- 前端: Next.js 14 + TypeScript

---

### 📝 接口规范

- RESTful API
- JSON 统一返回格式
- 支持 CORS
- 支持 JWT (即将支持)

---
""",
    "version": "0.1.0",
    "contact": {
        "name": "开发者",
        "email": "your-email@example.com",
    },
    "license_info": {
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT",
    },
}


# 生命周期管理
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 应用启动中...")
    print(f"📍 当前环境: {settings.ENVIRONMENT}")

    await init_db()

    print("✅ 数据库初始化完成")

    yield

    print("👋 应用关闭")



# 创建 FastAPI 应用
app = FastAPI(
    **metadata,
    lifespan=lifespan,

    # 禁用默认 Swagger / ReDoc
    docs_url=None,
    redoc_url=None,
)


# 注册路由
app.include_router(documents.router, prefix="/api/v1/documents", tags=["Documents"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["Chat"])

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["Documents"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["Chat"])


@app.get("/scalar", include_in_schema=False)
async def scalar_docs(request: Request) -> HTMLResponse:
    return get_scalar_api_reference(
        openapi_url=app.openapi_url,
        title=app.title,
        theme=Theme.SATURN,
        layout=Layout.MODERN,
        show_sidebar=True,
        hide_models=False,
        dark_mode=False,
        with_default_fonts=True,
    )



# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境必须改为具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# 基础接口
@app.get("/", tags=["系统"])
async def root():
    """根接口"""
    return {
        "message": "👋 Hello from RAG Backend!",
        "status": "running",
        "version": metadata["version"],
    }


@app.get("/health", tags=["系统"])
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
    }


@app.get("/api/v1/test-db", tags=["系统"])
async def test_database():
    """测试数据库连接"""

    from app.db.session import async_session_maker
    from sqlalchemy import text

    try:
        async with async_session_maker() as session:

            # 测试连接
            result = await session.execute(text("SELECT 1"))
            row = result.fetchone()

            if not row or row[0] != 1:
                return {
                    "status": "error",
                    "message": "数据库连接失败",
                }

            # 检查 pgvector
            ext_result = await session.execute(
                text(
                    "SELECT extname FROM pg_extension WHERE extname = 'vector'"
                )
            )

            ext_row = ext_result.fetchone()

            return {
                "status": "connected",
                "database": "PostgreSQL",
                "pgvector": "enabled" if ext_row else "not enabled",
                "message": "数据库连接成功",
            }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
        }


@app.get("/api/v1/protected")
async def protected_route(
    current_user: User = Depends(get_current_active_user)
):
    return {"message": f"Hello, {current_user.username}!"}
