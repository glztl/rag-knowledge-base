from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    """应用配置"""

    DATABASE_URL: str
    ENVIRONMENT: str = "development"

    # AI model config - QWen
    DASHSCOPE_API_KEY: str
    QWEN_MODEL: str = "qwen-plus"
    QWEN_EMBEDDING_MODEL: str = "text-embedding-v2"

    # upload config
    MAX_FILE_SIZE: int = 10485760  # 10MB
    UPLOAD_FOLDER: str = "uploads"
    ALLOWED_EXTENSIONS: str = "pdf,txt,md,docx"

    # JWT 配置
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

 
    SIMILARITY_THRESHOLD: float = 0.5
    MAX_CONTEXT_LENGTH: int = 4000
    DEFAULT_TOP_K: int = 5


    RAG_PROMPT_WITH_CONTEXT: Optional[str] = None
    RAG_PROMPT_WITHOUT_CONTEXT: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
