import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:11000';

// 创建 axios 实例
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 文档 API
export const documentApi = {
  // 上传文档
  upload: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/api/v1/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // 获取文档列表
  list: async () => {
    const response = await api.get('/api/v1/documents/list');
    return response.data;
  },

  // 获取文档详情
  getDetail: async (id: number) => {
    const response = await api.get(`/api/v1/documents/${id}`);
    return response.data;
  },

  // 删除文档
  delete: async (id: number) => {
    const response = await api.delete(`/api/v1/documents/${id}`);
    return response.data;
  },
};

// 聊天 API
export const chatApi = {
  // 非流式聊天
  chat: async (messages: { role: string; content: string }[], top_k: number = 5) => {
    const response = await api.post('/api/v1/chat/chat', { messages, top_k });
    return response.data;
  },

  // 流式聊天
  chatStream: async (
    messages: { role: string; content: string }[],
    top_k: number = 5,
    onChunk: (content: string) => void,
    onDone: () => void,
    onError: (error: string) => void
  ) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/chat/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages, top_k }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: '请求失败' }));
        throw new Error(error.detail || `Http ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('无法读取响应流');

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          onDone();
          break;
        }

        // 解码并添加到缓冲区
        buffer += decoder.decode(value, { stream: true });

        // 按行分割
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 最后一行可能不完整，保留在缓冲区

        for (const line of lines) {
          const trimmedLine = line.trim();

          // 跳过空行
          if (!trimmedLine) continue;

          // 检查是否是结束标志
          if (trimmedLine === '[DONE]') {
            onDone();
            return;
          }

          // 尝试解析 JSON
          try {
            const parsed = JSON.parse(trimmedLine);
            if (parsed.content) onChunk(parsed.content);
            if (parsed.error) throw new Error(parsed.error);
          } catch (e) {
            console.warn('解析行失败：', trimmedLine, e);
          }
        }
      }
    } catch (error: unknown) {
      console.error('聊天流式请求失败：', error);
      onError(error instanceof Error ? error.message : '未知错误');
    }
  } // 注意：这里不要逗号
};

// 健康检查 API
export const healthApi = {
  check: async () => {
    const response = await api.get('/health');
    return response.data;
  },

  testDb: async () => {
    const response = await api.get('/api/v1/test-db');
    return response.data;
  },
};

export default api;