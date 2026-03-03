"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, File, CheckCircle, XCircle, Loader2, Trash2 } from "lucide-react";
import { documentApi } from "@/lib/api";

interface Document {
  id: number;
  filename: string;
  file_size: number;
  file_type: string;
  status: string;
  created_at: string;
  chunk_count?: number;
}

export default function FileUpload() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = async () => {
    try {
      const data = await documentApi.list();
      setDocuments(data);
    } catch (error) {
      console.error("加载文档列表失败:", error);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

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
      const result = await documentApi.upload(file);
      setUploadProgress(`✅ ${result.message}`);
      await loadDocuments();
      onUploadComplete?.();
    } catch (error: unknown) {
      let message = "上传失败";
      if (error instanceof Error) message = `❌ 上传失败：${error.message}`;
      setUploadProgress(message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: number, filename: string) => {
    if (!confirm(`确定要删除 "${filename}" 吗？`)) return;

    try {
      await documentApi.delete(id);
      setUploadProgress(`✅ 已删除：${filename}`);
      await loadDocuments();
    } catch (error: unknown) {
      let message = "删除失败";
      if (error instanceof Error) message = `❌ 删除失败：${error.message}`;
      setUploadProgress(message);
    }
  };

  const formatSize = (bytes: number) => (bytes < 1024 ? bytes + " B" : bytes < 1024 * 1024 ? (bytes / 1024).toFixed(1) + " KB" : (bytes / (1024 * 1024)).toFixed(1) + " MB");
  const formatDate = (dateString: string) => new Date(dateString).toLocaleString("zh-CN");

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "processing":
        return <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <File className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-5 h-full overflow-y-auto">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-5">📁 文档管理</h2>

      {/* 上传区域 */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors bg-gray-50 dark:bg-gray-850"
      >
        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <p className="text-sm text-gray-600 dark:text-gray-400">点击上传或拖拽文件到此处</p>
        <p className="text-xs text-gray-400 mt-1">支持 PDF, TXT, MD, DOCX (最大 10MB)</p>
        <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.docx" onChange={handleFileUpload} className="hidden" disabled={isUploading} />
      </div>

      {/* 上传状态 */}
      {uploadProgress && (
        <div
          className={`p-3 mt-4 rounded-2xl text-sm transition-colors ${
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

      {/* 文档列表 */}
      <div className="space-y-3 mt-5">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          已上传文档 ({documents.length})
        </h3>

        {documents.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">暂无文档，请上传</p>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-850 rounded-2xl shadow-sm">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {getStatusIcon(doc.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{doc.filename}</p>
                  <p className="text-xs text-gray-500">
                    {formatSize(doc.file_size)} • {formatDate(doc.created_at)}
                    {doc.chunk_count ? ` • ${doc.chunk_count} 片段` : ""}
                  </p>
                </div>
              </div>
              <button onClick={() => handleDelete(doc.id, doc.filename)} className="p-1 text-gray-400 hover:text-red-500 transition" title="删除">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function onUploadComplete() {
  throw new Error("Function not implemented.");
}
