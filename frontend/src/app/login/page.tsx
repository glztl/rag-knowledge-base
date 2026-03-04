"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, tokenStorage } from "@/lib/auth";
import { LogIn, Loader2, AlertCircle } from "lucide-react";
import axios from "axios";

export const createAuthApi = () => {
  const api = axios.create({ /* ... */ });
  // ...拦截器...
};
export const authAxios = createAuthApi();

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      console.log("🔐 尝试登录...", username);
      const data = await authApi.login(username, password);
      console.log("✅ 登录成功，Token:", data.access_token.substring(0, 20) + "...");
      
      // 存储 Token
      tokenStorage.setToken(data.access_token);
      
      // 验证 Token 是否存储成功
      const storedToken = tokenStorage.getToken();
      console.log("📦 Token 存储验证:", storedToken ? "成功" : "失败");
      
      // 跳转到首页
      window.location.href = "/";
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        console.error("❌ 登录失败:", err.response?.data);
        setError(err.response?.data?.detail || "登录失败，请检查用户名和密码");
      } else {
        console.error("❌ 登录失败:", err);
        setError("登录失败，请检查用户名和密码");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <LogIn className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-800">📚 RAG 知识库</h1>
            <p className="text-gray-600 mt-2">登录以继续</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入用户名"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入密码"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  登录中...
                </>
              ) : (
                "登录"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a
              href="/register"
              className="text-sm text-blue-500 hover:underline"
            >
              没有账号？立即注册
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}