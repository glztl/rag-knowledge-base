from datetime import datetime, timedelta
from typing import Optional
import hashlib

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import TokenData



# 密码加密配置
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


def _preprocess_password(password: str) -> bytes:
    """
    bcrypt 只能处理最多 72 bytes。
    先用 SHA256 处理，得到固定长度 32 bytes。
    """
    return hashlib.sha256(password.encode("utf-8")).digest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return pwd_context.verify(
        _preprocess_password(plain_password),
        hashed_password
    )


def get_password_hash(password: str) -> str:
    """生成密码哈希"""
    return pwd_context.hash(
        _preprocess_password(password)
    )


# JWT 配置
SECRET_KEY = settings.SECRET_KEY  # ✅ 从环境变量读取
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES


# OAuth2
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
) -> str:
    """创建 JWT Token"""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({
        "exp": expire,
        "sub": str(data.get("sub"))  # 强制字符串
    })

    encoded_jwt = jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return encoded_jwt


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """获取当前用户"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
        username: str | None = payload.get("sub")

        if username is None:
            raise credentials_exception

        token_data = TokenData(username=username)

    except JWTError:
        raise credentials_exception

    result = await db.execute(
        select(User).where(User.username == token_data.username)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """获取当前活跃用户"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=400,
            detail="用户已禁用"
        )
    return current_user