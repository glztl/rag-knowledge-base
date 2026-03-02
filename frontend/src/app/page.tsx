"use client";

import { useState, useEffect } from "react";
import ChatBox from "@/components/ChatBox";
import FileUpload from "@/components/FileUpload";
import { healthApi } from "@/lib/api";
import { Database, Server, CheckCircle, XCircle } from "lucide-react";

export default function Home() {
  const [backendStatus, setBackendStatus] = useState<{
    healthy: boolean;
    dbConnected: boolean;
  } | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const health = await healthApi.check();
        const db = await healthApi.testDb();
        setBackendStatus({
          healthy: health.status === "healthy",
          dbConnected: db.status === "connected",
        });
      } catch (error) {
        setBackendStatus({
          healthy: false,
          dbConnected: false,
        });
      }
    };
    checkStatus();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* 顶部导航 */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              📚 RAG 知识库问答系统
            </h1>
            <div className="flex items-center space-x-4">
              {/* 后端状态 */}
              <div className="flex items-center space-x-2 text-sm">
                <Server className="w-4 h-4 text-gray-500" />
                {backendStatus?.healthy ? (
                  <span className="text-green-500 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1" />
                  </span>
                ) : (
                  <span className="text-red-500 flex items-center">
                    <XCircle className="w-4 h-4 mr-1" />
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Database className="w-4 h-4 text-gray-500" />
                {backendStatus?.dbConnected ? (
                  <span className="text-green-500 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1" />
                  </span>
                ) : (
                  <span className="text-red-500 flex items-center">
                    <XCircle className="w-4 h-4 mr-1" />
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
          {/* 左侧：文件上传 */}
          <div className="lg:col-span-1">
            <FileUpload />
          </div>

          {/* 右侧：聊天窗口 */}
          <div className="lg:col-span-2">
            <ChatBox />
          </div>
        </div>
      </div>
    </main>
  );
}