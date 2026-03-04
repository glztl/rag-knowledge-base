"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, File, CheckCircle, XCircle, Loader2, Trash2 } from "lucide-react";

interface Document {
  id: number;
  filename: string;
  file_size: number;
  file_type: string;
  status: string;
  created_at: string;
  chunk_count?: number;
}

interface FileUploadProps {
  onUploadComplete?: () => void;
}

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载文档列表
  const loadDocuments = async () => {
    try {
      console.log("📁 加载文档列表...");
      const api = await import('@/lib/auth').then(m => m.getAuthApi());
      const response = await api.get("/api/v1/documents/list");
      console.log("✅ 文档列表:", response.data);
      setDocuments(response.data);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "response" in error) {
        // @ts-expect-error: response may exist on error
        console.error("❌ 加载文档列表失败:", error.response?.data);
      } else {
        console.error("❌ 加载文档列表失败:", error);
      }
    }
  };

  // 初次加载
  useEffect(() => {
    loadDocuments();
  }, []);

  // 处理文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["pdf", "txt", "md", "docx"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !allowedTypes.includes(ext)) {
      setUploadProgress(`❌ 不支持的文件类型：${ext}`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadProgress("❌ 文件大小超过 10MB");
      return;
    }

    setIsUploading(true);
    setUploadProgress(`⏳ 正在上传：${file.name}...`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const api = await import('@/lib/auth').then(m => m.getAuthApi());
      const response = await api.post('/api/v1/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const result = response.data;
      setUploadProgress(`✅ ${result.message}`);
      await loadDocuments();
      onUploadComplete?.();
    } catch (error: unknown) {
      if (error && typeof error === "object" && "response" in error) {
        
        setUploadProgress(
          `❌ 上传失败：${
            error &&
            typeof error === "object" &&
            "response" in error &&
            error.response &&
            typeof error.response === "object" &&
            "data" in error.response &&
            (error.response as { data?: { detail?: string } }).data?.detail
              ? (error.response as { data?: { detail?: string } }).data?.detail
              : (typeof error === "object" && error !== null && "message" in error
                  ? (error as { message: string }).message
                  : "")
          }`
        );
      } else {
        setUploadProgress(`❌ 上传失败：${(error as Error).message}`);
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 删除文档
  const handleDelete = async (id: number, filename: string) => {
    if (!confirm(`确定要删除 "${filename}" 吗？`)) return;

    try {
      const api = await import('@/lib/auth').then(m => m.getAuthApi());
      await api.delete(`/api/v1/documents/${id}`);
      setUploadProgress(`✅ 已删除：${filename}`);
      await loadDocuments();
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "data" in error.response &&
        (error.response as { data?: { detail?: string } }).data?.detail
      ) {
        setUploadProgress(`❌ 删除失败：${(error.response as { data?: { detail?: string } }).data?.detail}`);
      } else if (
        error &&
        typeof error === "object" &&
        "message" in error
      ) {
        setUploadProgress(`❌ 删除失败：${(error as { message: string }).message}`);
      } else {
        setUploadProgress("❌ 删除失败：未知错误");
      }
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "processing":
        return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <File className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 h-full overflow-y-auto">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
        📁 文档管理
      </h2>

      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition mb-4"
      >
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          点击上传或拖拽文件到此处
        </p>
        <p className="text-xs text-gray-500 mt-1">
          支持 PDF, TXT, MD, DOCX (最大 10MB)
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.docx"
          onChange={handleFileUpload}
          className="hidden"
          disabled={isUploading}
        />
      </div>

      {uploadProgress && (
        <div
          className={`p-3 rounded mb-4 text-sm ${
            uploadProgress.startsWith("✅")
              ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
              : uploadProgress.startsWith("❌")
              ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
              : "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
          }`}
        >
          {uploadProgress}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          已上传文档 ({documents.length})
        </h3>

        {documents.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            暂无文档，请上传
          </p>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                {getStatusIcon(doc.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                    {doc.filename}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatSize(doc.file_size)} • {formatDate(doc.created_at)}
                    {doc.chunk_count ? ` • ${doc.chunk_count} 片段` : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(doc.id, doc.filename)}
                className="p-1 text-gray-400 hover:text-red-500 transition"
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}