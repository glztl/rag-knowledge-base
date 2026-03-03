"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Loader2, User, Bot } from "lucide-react";
import { chatApi, createAuthApi } from "@/lib/api";
import type { AxiosInstance } from "axios";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    id: number;
    content: string;
    score: number;
  }>;
}

interface ApiMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    id: number;
    content: string;
    score: number;
  }>;
}

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    id: number;
    content: string;
    score: number;
  }>;
}

interface ChatBoxProps {
  sessionId: number | null;
  onSessionChange: (sessionId: number | null) => void;
}

export default function ChatBox({ sessionId, onSessionChange }: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const authApiInstance = useRef<AxiosInstance | null>(null);

  // 初始化认证 API
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await authApiInstance.current!.get(
          `/api/v1/chat/sessions/${sessionId}`
        );
        const historyMessages = response.data.messages.map((msg: HistoryMessage) => ({
          role: msg.role,
          content: msg.content,
          sources: msg.sources,
        }));
        setMessages(historyMessages);
      } catch (error) {
        console.error("加载历史消息失败:", error);
      }
    };

    loadHistory();
  }, [sessionId]);
  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  // 发送消息
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    try {
      // 使用流式聊天
      await chatApi.chatStream(
        [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        })),
        5,
        // onChunk
        (content) => {
          setStreamingContent((prev) => prev + content);
        },
        // onDone
        () => {
          const assistantMessage: Message = {
            role: "assistant",
            content: streamingContent,
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setStreamingContent("");
          setIsLoading(false);
        },
        // onError
        (error) => {
          const errorMessage: Message = {
            role: "assistant",
            content: `❌ 错误：${error}`,
          };
          setMessages((prev) => [...prev, errorMessage]);
          setStreamingContent("");
          setIsLoading(false);
        }
      );
    } catch (error) {
      const errorMessage: Message = {
        role: "assistant",
        content: `❌ 请求失败：${error instanceof Error ? error.message : "未知错误"}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  // 处理回车发送
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 清空对话
  const clearChat = () => {
    setMessages([]);
    setStreamingContent("");
    onSessionChange(null);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
          🤖 AI 助手
          {sessionId && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              (会话中)
            </span>
          )}
        </h2>
        <button
          onClick={clearChat}
          className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          清空对话
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !streamingContent && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-20">
            <p className="text-lg">👋 你好！我是你的 AI 知识库助手</p>
            <p className="text-sm mt-2">
              上传文档后，我可以基于文档内容回答问题
            </p>
            {!sessionId && (
              <p className="text-xs mt-4 text-gray-400">
                💡 提示：创建或选择一个对话会话开始聊天
              </p>
            )}
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex items-start space-x-3 ${
              message.role === "user" ? "flex-row-reverse space-x-reverse" : ""
            }`}
          >
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.role === "user"
                  ? "bg-blue-500"
                  : "bg-green-500"
              }`}
            >
              {message.role === "user" ? (
                <User className="w-5 h-5 text-white" />
              ) : (
                <Bot className="w-5 h-5 text-white" />
              )}
            </div>
            <div
              className={`flex-1 max-w-[80%] p-3 rounded-lg ${
                message.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
              }`}
            >
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
              {message.sources && message.sources.length > 0 && (
                <div className="mt-2 text-xs opacity-70">
                  <p className="font-semibold">📚 参考来源：</p>
                  {message.sources.slice(0, 3).map((source, i) => (
                    <p key={i} className="truncate">
                      • {source.content.substring(0, 100)}...
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* 流式响应中 */}
        {streamingContent && (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 max-w-[80%] p-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {streamingContent}
                </ReactMarkdown>
              </div>
              {isLoading && (
                <span className="inline-block w-2 h-4 ml-1 bg-gray-400 animate-pulse" />
              )}
            </div>
          </div>
        )}

        {/* 加载状态 */}
        {isLoading && !streamingContent && (
          <div className="flex items-center space-x-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>思考中...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-end space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={sessionId ? "输入问题，按 Enter 发送..." : "请先创建或选择一个对话会话"}
            className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
            rows={2}
            disabled={isLoading || !sessionId}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim() || !sessionId}
            className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          按 Enter 发送，Shift + Enter 换行
        </p>
      </div>
    </div>
  );
}