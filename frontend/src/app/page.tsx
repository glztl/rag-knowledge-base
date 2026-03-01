"use client";

import { useEffect, useState } from "react";
import axios from "axios";

interface BackendStatus {
  message?: string;
  status?: string;
  database?: string;
  pgvector?: string;
  error?: string;
}

export default function Home() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 测试后端连接
    const checkBackend = async () => {
      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/test-db`
        );
        setBackendStatus(response.data);
      } catch (error) {
        setBackendStatus({
          error: "无法连接到后端，请检查后端服务是否运行",
        });
      } finally {
        setLoading(false);
      }
    };

    checkBackend();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex lg:flex-col">
        <h1 className="text-4xl font-bold mb-8 text-gray-800">
          📚 RAG Knowledge Base
        </h1>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
            🔗 系统状态
          </h2>

          {loading ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500">正在检查后端连接...</p>
            </div>
          ) : backendStatus?.error ? (
            <div className="text-red-500 bg-red-50 p-4 rounded">
              <p className="font-semibold">❌ 连接失败</p>
              <p className="text-sm mt-1">{backendStatus.error}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-green-500">
                <span>✅</span>
                <span className="font-medium">后端连接成功</span>
              </div>
              {backendStatus?.message && (
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  {backendStatus.message}
                </p>
              )}
              {backendStatus?.database && (
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm">
                  <p className="text-gray-600 dark:text-gray-300">
                    🗄️ 数据库：{backendStatus.database}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    🔌 pgvector：{backendStatus.pgvector}
                  </p>
                </div>
              )}
              {backendStatus?.status && (
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  状态：{backendStatus.status}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-gray-500">
          <p className="text-sm">Phase 1: 骨架搭建完成 ✓</p>
          <p className="text-xs mt-2">
            Next.js + FastAPI + PostgreSQL + pgvector
          </p>
          <p className="text-xs mt-1 text-gray-400">
            API: {process.env.NEXT_PUBLIC_API_URL}
          </p>
        </div>

        {/* 快速链接 */}
        <div className="mt-8 flex space-x-4">
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL}/scalar`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-sm"
          >
            📖 API 文档
          </a>
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL}/health`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition text-sm"
          >
            💚 健康检查
          </a>
        </div>
      </div>
    </main>
  );
}