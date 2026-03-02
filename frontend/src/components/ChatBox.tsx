"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Loader2, User, Bot } from "lucide-react";
import { chatApi } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    id: number;
    content: string;
    score: number;
  }>;
}

export default function ChatBox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => scrollToBottom(), [messages, streamingContent]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    let accumulatedContent = "";

    try {
      await chatApi.chatStream(
        [...messages, userMessage].map((m) => ({ role: m.role, content: m.content })),
        5,
        (content) => {
          accumulatedContent += content;
          setStreamingContent(accumulatedContent);
        },
        () => {
          const assistantMessage: Message = { role: "assistant", content: accumulatedContent };
          setMessages((prev) => [...prev, assistantMessage]);
          setStreamingContent("");
          setIsLoading(false);
        },
        (error) => {
          const errorMessage: Message = { role: "assistant", content: `❌ 错误：${error}` };
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setStreamingContent("");
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">🤖 AI 助手</h2>
        <button
          onClick={clearChat}
          className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition"
        >
          清空对话
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-gray-900">
        {messages.length === 0 && !streamingContent && (
          <div className="text-center text-gray-400 mt-24">
            <p className="text-lg font-medium">👋 你好！我是你的 AI 知识库助手</p>
            <p className="text-sm mt-2">上传文档后，我可以基于文档内容回答问题</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex items-start space-x-3 ${message.role === "user" ? "flex-row-reverse space-x-reverse" : ""}`}
          >
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-md ${
                message.role === "user" ? "bg-blue-500" : "bg-green-500"
              }`}
            >
              {message.role === "user" ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
            </div>
            <div
              className={`flex-1 max-w-[80%] p-4 rounded-2xl shadow-inner transition-colors ${
                message.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-white dark:bg-gray-850 text-gray-900 dark:text-gray-200"
              }`}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>

              {message.sources && message.sources.length > 0 && (
                <div className="mt-2 text-xs opacity-70">
                  <p className="font-semibold mb-1">📚 参考来源：</p>
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

        {streamingContent && (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-md">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 max-w-[80%] p-4 rounded-2xl shadow-inner bg-white dark:bg-gray-850 text-gray-900 dark:text-gray-200">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
              {isLoading && <span className="inline-block w-2 h-4 ml-1 bg-gray-400 animate-pulse" />}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <div className="p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850">
        <div className="flex items-end space-x-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题，按 Enter 发送..."
            className="flex-1 p-4 border border-gray-300 dark:border-gray-600 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-850 dark:text-white transition-shadow shadow-sm"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="p-3 bg-blue-500 text-white rounded-2xl hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-shadow shadow-md"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">按 Enter 发送，Shift + Enter 换行</p>
      </div>
    </div>
  );
}