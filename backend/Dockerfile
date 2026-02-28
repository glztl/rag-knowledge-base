FROM python:3.12-slim

# 安装 UV
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

# 复制项目配置
COPY pyproject.toml uv.lock .python-version ./

# 创建虚拟环境并安装依赖
RUN uv venv && \
    uv sync --frozen && \
    cp -r .venv /opt/venv

# 设置环境变量
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONPATH="/app"

# 复制应用代码
COPY app/ ./app/
COPY .env ./.env

# 暴露端口
EXPOSE 11000

# 启动命令
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "11000"]