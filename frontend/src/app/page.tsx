"use client";

import React from "react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ChatBox from "@/components/ChatBox";
import FileUpload from "@/components/FileUpload";
import { healthApi } from "@/lib/api";
import { authApi, tokenStorage, createAuthApi } from "@/lib/auth";
import {
  Database,
  Server,
  CheckCircle,
  XCircle,
  LogOut,
  User,
  Plus,
  MessageSquare,
  Trash2,
  Menu,
  X,
} from "lucide-react";
import { AxiosInstance } from "axios";
// 对话会话类型
interface ChatSession {
  id: number;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

// 用户信息类型
interface UserInfo {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
}

export default function Home() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [backendStatus, setBackendStatus] = useState<{
    healthy: boolean;
    dbConnected: boolean;
  } | null>(null);

  // 对话历史相关
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // 认证 API 实例
  const [authApiInstance, setAuthApiInstance] = useState<AxiosInstance | null>(null);

  // 检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      const token = tokenStorage.getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const api = createAuthApi();
        setAuthApiInstance(api);
        const userData = await authApi.getCurrentUser(token);
        setUser(userData);
        setIsLoaded(true);
      } catch (error) {
        tokenStorage.removeToken();
        router.push("/login");
      }
    };

    checkAuth();
  }, [router]);

  // 检查后端状态
  useEffect(() => {
    if (!isLoaded) return;

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
  }, [isLoaded]);

  // 加载对话历史
  const loadSessions = useCallback(async () => {
    if (!authApiInstance) return;

    try {
      const response = await authApiInstance.get("/api/v1/chat/sessions");
      setSessions(response.data);
    } catch (error) {
      console.error("加载对话历史失败:", error);
    }
  }, [authApiInstance]);

useEffect(() => {
  if (!isLoaded) return;

  (async () => {
    await loadSessions();
  })();
}, [isLoaded, loadSessions]);

  // 创建新对话
  const createNewSession = async () => {
    if (!authApiInstance) return;

    try {
      const response = await authApiInstance.post("/api/v1/chat/sessions", {
        title: "新对话",
      });
      const newSession = response.data;
      setSessions([newSession, ...sessions]);
      setCurrentSessionId(newSession.id);
    } catch (error) {
      console.error("创建对话失败:", error);
    }
  };

  // 切换对话
  const switchSession = (sessionId: number) => {
    setCurrentSessionId(sessionId);
    // 在移动端自动关闭侧边栏
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  // 删除对话
  const deleteSession = async (
    sessionId: number,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (!confirm("确定要删除这个对话吗？")) return;

    if (!authApiInstance) return;

    try {
      await authApiInstance.delete(`/api/v1/chat/sessions/${sessionId}`);
      setSessions(sessions.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
      }
    } catch (error) {
      console.error("删除对话失败:", error);
    }
  };

  // 退出登录
  const handleLogout = () => {
    tokenStorage.removeToken();
    router.push("/login");
  };

  // 格式化时间
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "今天";
    if (days === 1) return "昨天";
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString("zh-CN");
  };

  // 加载时显示
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* 顶部导航 */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* 侧边栏切换按钮 */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg lg:hidden"
              >
                {isSidebarOpen ? (
                  <X className="w-5 h-5 text-gray-600" />
                ) : (
                  <Menu className="w-5 h-5 text-gray-600" />
                )}
              </button>

              <h1 className="text-xl font-bold text-gray-800 dark:text-white">
                📚 RAG 知识库
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              {/* 后端状态 */}
              <div className="hidden md:flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1">
                  <Server className="w-4 h-4 text-gray-500" />
                  {backendStatus?.healthy ? (
                    <span className="text-green-500 flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1" /> 后端
                    </span>
                  ) : (
                    <span className="text-red-500 flex items-center">
                      <XCircle className="w-3 h-3 mr-1" /> 后端
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  <Database className="w-4 h-4 text-gray-500" />
                  {backendStatus?.dbConnected ? (
                    <span className="text-green-500 flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1" /> 数据库
                    </span>
                  ) : (
                    <span className="text-red-500 flex items-center">
                      <XCircle className="w-3 h-3 mr-1" /> 数据库
                    </span>
                  )}
                </div>
              </div>

              {/* 用户信息 */}
              <div className="flex items-center space-x-3 pl-4 border-l border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 hidden sm:inline">
                    {user?.username}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                  title="退出登录"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="max-w-[1600px] mx-auto px-4 py-4">
        <div className="flex h-[calc(100vh-80px)] gap-4">
          {/* 左侧：对话历史侧边栏 */}
          <div
            className={`${
              isSidebarOpen ? "w-64" : "w-0"
            } transition-all duration-300 overflow-hidden flex-shrink-0`}
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg h-full flex flex-col">
              {/* 新建对话按钮 */}
              <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={createNewSession}
                  className="w-full py-2 px-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center justify-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>新对话</span>
                </button>
              </div>

              {/* 对话列表 */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sessions.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    暂无对话历史
                  </p>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => switchSession(session.id)}
                      className={`group p-3 rounded-lg cursor-pointer transition ${
                        currentSessionId === session.id
                          ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500"
                          : "hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                              {session.title}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(session.updated_at)} ·{" "}
                            {session.message_count} 条消息
                          </p>
                        </div>
                        <button
                          onClick={(e) => deleteSession(session.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 中间：聊天窗口 */}
          <div className="flex-1 min-w-0">
            <ChatBox sessionId={currentSessionId} onSessionChange={setCurrentSessionId} />
          </div>

          {/* 右侧：文件上传 */}
            <div className="w-80 flex-shrink-0 hidden xl:block">
            <FileUpload />
            </div>
        </div>
      </div>
    </main>
  );
}