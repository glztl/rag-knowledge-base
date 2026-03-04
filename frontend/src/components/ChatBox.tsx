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

interface ChatBoxProps {
  sessionId: number | null;
  onSessionChange: (sessionId: number | null) => void;
  onMessageSent?: () => void;
}

export default function ChatBox({
  sessionId,
  onSessionChange,
  onMessageSent
}: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");

  const streamingContentRef = useRef("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  // 加载历史消息
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }

    const loadHistory = async () => {
      try {
        console.log("📜 加载会话消息:", sessionId);
        const api = await import('@/lib/auth').then(m => m.getAuthApi());
        const response = await api.get(`/api/v1/chat/sessions/${sessionId}`);
        console.log("📥 会话详情:", response.data);
        console.log("📥 消息数量:", response.data.messages?.length);

        interface ApiMessage {
          role: "user" | "assistant";
          content: string;
          sources?: Array<{
            id: number;
            content: string;
            score: number;
          }>;
        }

        const historyMessages = response.data.messages.map((msg: ApiMessage) => ({
          role: msg.role,
          content: msg.content,
          sources: msg.sources,
        }));

        console.log("✅ 消息加载成功:", historyMessages.length, "条");
        setMessages(historyMessages);
      } catch (error: unknown) {
        if (error && typeof error === "object" && "response" in error) {
          // @ts-expect-error: error.response may exist
          console.error("❌ 加载历史消息失败:", error.response?.data);
        } else {
          console.error("❌ 加载历史消息失败:", error);
        }
      }
    };

    loadHistory();
  }, [sessionId]);

  // 发送消息部分 - 确保参数顺序正确
  const sendMessage = async () => {
    if (!input.trim() || isLoading || !sessionId) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");
    streamingContentRef.current = "";

    console.log('📤 发送消息:', userMessage.content);
    console.log('📤 会话 ID:', sessionId);

    try {
      // ⚠️ 参数顺序必须严格匹配：messages, top_k, session_id, onChunk, onDone, onError
      await chatApi.chatStream(
        // 1. messages
        [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        })),
        // 2. top_k
        5,
        // 3. session_id (必须是数字！)
        sessionId,
        // 4. onChunk
        (content) => {
          console.log('💬 收到内容:', content);
          setStreamingContent((prev) => {
            const newContent = prev + content;
            streamingContentRef.current = newContent;  // ⚠️ 同步更新 ref
            console.log('📝 累积内容:', streamingContentRef.current);
            return newContent;
          });
        },
        // 5. onDone
        () => {
          console.log('✅ onDone 调用');
          console.log('✅ 最终内容:', streamingContentRef.current);

          if (streamingContentRef.current) {
            const assistantMessage: Message = {
              role: "assistant",
              content: streamingContentRef.current,
            };
            setMessages((prev) => [...prev, assistantMessage]);
            console.log('✅ 消息已添加到列表');
          }

          setStreamingContent("");
          setIsLoading(false);
          onMessageSent?.();
        },
        // 6. onError
        (error) => {
          console.error('❌ onError 调用:', error);
          const errorMessage: Message = {
            role: "assistant",
            content: `❌ 错误：${error || '未知错误'}`,
          };
          setMessages((prev) => [...prev, errorMessage]);
          setStreamingContent("");
          setIsLoading(false);
          onMessageSent?.();
        }
      );
    } catch (error) {
      console.error('❌ 发送异常:', error);
      const errorMessage: Message = {
        role: "assistant",
        content: `❌ 请求失败：${error instanceof Error ? error.message : "未知错误"}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsLoading(false);
      onMessageSent?.();
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
    streamingContentRef.current = "";
    onSessionChange(null);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
          🤖 AI 助手
        </h2>
        <button
          onClick={clearChat}
          className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700"
        >
          清空对话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !streamingContent && (
          <div className="text-center text-gray-500 mt-20">
            <p>👋 你好！我是你的 AI 知识库助手</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex items-start space-x-3 ${message.role === "user" ? "flex-row-reverse space-x-reverse" : ""
              }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${message.role === "user" ? "bg-blue-500" : "bg-green-500"
              }`}>
              {message.role === "user" ? (
                <User className="w-5 h-5 text-white" />
              ) : (
                <Bot className="w-5 h-5 text-white" />
              )}
            </div>
            <div className={`flex-1 max-w-[80%] p-3 rounded-lg ${message.role === "user"
              ? "bg-blue-500 text-white"
              : "bg-gray-100 dark:bg-gray-700"
              }`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}

        {streamingContent && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 max-w-[80%] p-3 rounded-lg bg-gray-100 dark:bg-gray-700">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {streamingContent}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {isLoading && !streamingContent && (
          <div className="flex items-center space-x-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>思考中...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-end space-x-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题，按 Enter 发送..."
            className="flex-1 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            disabled={isLoading || !sessionId}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim() || !sessionId}
            className="p-3 bg-blue-500 text-white rounded-lg disabled:bg-gray-400"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}