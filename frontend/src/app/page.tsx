"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ChatBox from "@/components/ChatBox";
import FileUpload from "@/components/FileUpload";
import { healthApi } from "@/lib/api";
import { authApi, tokenStorage } from "@/lib/auth";
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
  ChevronLeft,
  ChevronRight,
  Edit2,
} from "lucide-react";

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
  
  // 侧边栏状态 - 默认展开
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // 编辑标题状态
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // ⚠️ 移除 api state，改用动态导入（与 FileUpload 保持一致）

  // 检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      const token = tokenStorage.getToken();
      console.log("🔑 检查认证，Token 存在:", !!token);

      if (!token) {
        console.log("⚠️ 无 Token，跳转到登录页");
        router.push("/login");
        return;
      }

      try {
        const userData = await authApi.getCurrentUser(token);
        console.log("✅ 用户信息:", userData);
        setUser(userData);
        setIsLoaded(true);
      } catch (error) {
        console.error("❌ 认证失败:", error);
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

  // ⚠️ 获取 API 实例的辅助函数
  const getApi = async () => {
    return await import('@/lib/auth').then(m => m.getAuthApi());
  };

  // ⚠️ 加载对话历史 - 动态导入 api
  const loadSessions = useCallback(async () => {
    try {
      console.log("📋 加载对话历史...");
      const api = await getApi();
      console.log("🔧 API 实例类型:", typeof api, typeof api.get);
      const response = await api.get("/api/v1/chat/sessions");
      console.log("✅ 对话历史:", response.data);
      setSessions(response.data);
    } catch (error: any) {
      console.error("❌ 加载对话历史失败:", error.response?.data || error);
    }
  }, []);  // ⚠️ 空依赖数组

  useEffect(() => {
    if (isLoaded) {
      loadSessions();
    }
  }, [isLoaded, loadSessions]);

  // ⚠️ 创建新对话 - 动态导入 api
  const createNewSession = async () => {
    try {
      console.log("➕ 创建新对话...");
      const api = await getApi();
      const response = await api.post("/api/v1/chat/sessions", {
        title: "新对话",
      });
      const newSession = response.data;
      setSessions([newSession, ...sessions]);
      setCurrentSessionId(newSession.id);
      console.log("✅ 新对话创建成功:", newSession.id);
    } catch (error: any) {
      console.error("❌ 创建对话失败:", error.response?.data || error);
    }
  };

  // 切换对话
  const switchSession = (sessionId: number) => {
    console.log("🔄 切换对话:", sessionId);
    setCurrentSessionId(sessionId);
    setEditingSessionId(null);
  };

  // ⚠️ 删除对话 - 动态导入 api
  const deleteSession = async (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定要删除这个对话吗？")) return;

    try {
      console.log("🗑️ 删除对话:", sessionId);
      const api = await getApi();
      await api.delete(`/api/v1/chat/sessions/${sessionId}`);
      setSessions(sessions.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
      }
      console.log("✅ 对话删除成功");
    } catch (error: any) {
      console.error("❌ 删除对话失败:", error.response?.data || error);
    }
  };

  // 开始编辑标题
  const startEditTitle = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  // ⚠️ 保存标题 - 动态导入 api
  const saveTitle = async (sessionId: number) => {
    if (!editingTitle.trim()) return;

    try {
      console.log("💾 保存标题:", sessionId, editingTitle);
      const api = await getApi();
      await api.patch(`/api/v1/chat/sessions/${sessionId}`, {
        title: editingTitle.trim(),
      });
      setSessions(sessions.map(s => 
        s.id === sessionId ? { ...s, title: editingTitle.trim() } : s
      ));
      setEditingSessionId(null);
      console.log("✅ 标题保存成功");
    } catch (error: any) {
      console.error("❌ 标题保存失败:", error.response?.data || error);
    }
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingSessionId(null);
    setEditingTitle("");
  };

  // 处理编辑回车
  const handleEditKeyDown = (e: React.KeyboardEvent, sessionId: number) => {
    if (e.key === "Enter") {
      saveTitle(sessionId);
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  // 退出登录
  const handleLogout = () => {
    console.log("👋 退出登录");
    tokenStorage.removeToken();
    router.push("/login");
  };

  // 格式化时间
  const formatDate = (dateString: string) => {
    if (!dateString) return "未知时间";
    
    try {
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        console.warn("无效日期:", dateString);
        return "未知时间";
      }
      
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (days === 0) return "今天";
      if (days === 1) return "昨天";
      if (days < 7) return `${days}天前`;
      return date.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
    } catch (error) {
      console.error("日期格式化失败:", error, dateString);
      return "未知时间";
    }
  };

  // 加载时显示
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">加载中...</p>
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
              {/* 侧边栏折叠按钮 */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                title={isSidebarOpen ? "收起侧边栏" : "展开侧边栏"}
              >
                {isSidebarOpen ? (
                  <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>

              <h1 className="text-xl font-bold text-gray-800 dark:text-white">
                📚 RAG 知识库
              </h1>
            </div>

            <div className="flex items-center space-x-4">
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
          {/* 左侧：对话历史侧边栏 - 可折叠 */}
          <div
            className={`${
              isSidebarOpen ? "w-64" : "w-0"
            } transition-all duration-300 overflow-hidden flex-shrink-0`}
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg h-full flex flex-col">
              <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={createNewSession}
                  className="w-full py-2 px-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center justify-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>新对话</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sessions.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
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
                          {/* 编辑模式 */}
                          {editingSessionId === session.id ? (
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => handleEditKeyDown(e, session.id)}
                              onBlur={() => saveTitle(session.id)}
                              className="w-full text-sm bg-white dark:bg-gray-600 border border-blue-500 rounded px-2 py-1 focus:outline-none"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <>
                              <div className="flex items-center space-x-2">
                                <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                                  {session.title}
                                </p>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {formatDate(session.updated_at)} ·{" "}
                                {session.message_count} 条消息
                              </p>
                            </>
                          )}
                        </div>
                        
                        {/* 操作按钮 */}
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={(e) => startEditTitle(session, e)}
                            className="p-1 text-gray-400 hover:text-blue-500 transition"
                            title="编辑标题"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => deleteSession(session.id, e)}
                            className="p-1 text-gray-400 hover:text-red-500 transition"
                            title="删除"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 中间：聊天窗口 */}
          <div className="flex-1 min-w-0">
            <ChatBox
              sessionId={currentSessionId}
              onSessionChange={setCurrentSessionId}
              onMessageSent={loadSessions}
            />
          </div>

          {/* 右侧：文件上传 */}
          <div className="w-80 flex-shrink-0 hidden xl:block">
            <FileUpload onUploadComplete={loadSessions} />
          </div>
        </div>
      </div>
    </main>
  );
}