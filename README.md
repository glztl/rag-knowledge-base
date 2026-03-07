# rag-knowledge-base

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.134.0-green?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Docker-ready-blue?logo=docker)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql)](https://www.postgresql.org/)

A modern, full-stack Retrieval-Augmented Generation (RAG) knowledge base system, featuring a FastAPI backend and a Next.js (React) frontend. Supports document upload, semantic search, and conversational Q&A.

---

一个现代化的 RAG 知识库系统，前端基于 Next.js，后端基于 FastAPI，支持文档上传、语义检索与对话问答。

---

## Features | 功能亮点
- 📄 **Document Upload & Management** 文档上传与管理
- 🔍 **Semantic Search** 语义检索
- 💬 **Conversational Q&A** 对话式问答
- 🛡️ **User Authentication** 用户认证
- 🚀 **Modern UI** 现代化界面
- 🐳 **Dockerized Deployment** 一键 Docker 部署

## Project Structure | 项目结构
```
├── backend/      # FastAPI 后端服务
│   ├── app/      # 业务代码（API、核心、模型、数据库等）
│   ├── main.py   # 启动入口
│   └── ...
├── frontend/     # Next.js 前端应用
│   ├── src/      # 前端页面与组件
│   └── ...
├── uploads/      # 上传的文档存储
├── docker-compose.yml # 一键部署编排
└── README.md     # 项目说明
```

## Quick Start | 快速开始

### 1. Prerequisites | 先决条件
- Docker & Docker Compose
- Node.js 18+ (如需本地开发前端)
- Python 3.12+ (如需本地开发后端)

### 2. One-Click Deployment | 一键部署
```bash
# 在项目根目录运行
# Run in project root

docker-compose up --build
```
访问 [http://localhost](http://localhost) 即可体验。

### 3. Local Development | 本地开发
- 后端：
  ```bash
  cd backend
  pip install -r requirements.txt  # 或使用 poetry/pdm
  uvicorn app.main:app --reload --host 0.0.0.0 --port 11000
  ```
- 前端：
  ```bash
  cd frontend
  pnpm install  # 或 npm/yarn
  pnpm dev
  # 访问 http://localhost:3000
  ```

## Tech Stack | 技术栈
- **Backend:** FastAPI, SQLAlchemy, PostgreSQL, LangChain, asyncpg
- **Frontend:** Next.js, React, TailwindCSS, Headless UI
- **Auth:** JWT, Passlib
- **Deployment:** Docker, Nginx

## Online Demo | 在线演示
> Coming soon! 敬请期待！

## Community & Support | 社区与支持
- Issue 反馈与建议
- 邮箱：tianlunnn@gmail.com


## License | 许可证
MIT

---

> Made with ![alt text](frontend/public/milkcat.svg) by glztl
