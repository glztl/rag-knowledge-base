import axios from 'axios';
import { tokenStorage } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:11000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      tokenStorage.removeToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// 文档 API
export const documentApi = {
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

  list: async () => {
    const response = await api.get('/api/v1/documents/list');
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/api/v1/documents/${id}`);
    return response.data;
  },
};

// ⚠️ 完全重写的聊天 API - 修复参数顺序
export const chatApi = {
  chat: async (messages: { role: string; content: string }[], top_k: number = 5) => {
    const response = await api.post('/api/v1/chat/chat', {
      messages,
      top_k,
    });
    return response.data;
  },

  // ⚠️ 关键修复：session_id 放在请求体中，不作为单独参数
  chatStream: async (
    messages: { role: string; content: string }[],
    top_k: number,
    session_id: number | null,
    onChunk: (content: string) => void,
    onDone: () => void,
    onError: (error: string) => void
  ) => {
    const token = tokenStorage.getToken();

    console.log('🚀 开始流式请求...');
    console.log('🚀 session_id:', session_id, '类型:', typeof session_id);

    let isDone = false;  // ⚠️ 防止重复调用

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          messages,
          top_k,
          session_id,
        }),
      });

      console.log('📡 响应状态:', response.status);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: '请求失败' }));
        throw new Error(error.detail || '请求失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log('✅ 流式读取完成');
            if (!isDone) {
              isDone = true;
              onDone();
            }
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          console.log('📦 原始数据:', JSON.stringify(chunk));

          // 按行处理
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();  // ⚠️ 已经去掉了所有前导空格

            if (!trimmed) continue;

            console.log('📝 处理行:', JSON.stringify(trimmed));

            // ⚠️ 修复：trimmed 已经没有前导空格了，直接解析
            let jsonStr = trimmed;

            // 只去掉 "data:" 前缀（如果存在）
            if (trimmed.startsWith('data:')) {
              jsonStr = trimmed.substring(5).trim();
            }
            // ⚠️ 不要 substring(5)，因为空格已经被 trim() 去掉了

            console.log('📄 JSON 字符串:', JSON.stringify(jsonStr));

            // 检查结束标记
            if (jsonStr === '[DONE]') {
              console.log('✅ 收到结束标记');
              if (!isDone) {
                isDone = true;
                onDone();
              }
              return;  // ⚠️ 直接返回
            }

            // 解析 JSON
            try {
              const parsed = JSON.parse(jsonStr);
              console.log('🔍 解析结果:', parsed);

              if (parsed.content) {
                console.log('💬 调用 onChunk:', parsed.content);
                onChunk(parsed.content);
              }

              if (parsed.error) {
                console.error('❌ 服务端错误:', parsed.error);
                if (!isDone) {
                  isDone = true;
                  onError(parsed.error);
                }
              }
            } catch (e) {
              console.error('❌ JSON 解析失败:', e, '数据:', jsonStr);
            }
          }
        }
      } catch (readError) {
        console.error('❌ 读取流异常:', readError);
        if (!isDone) {
          isDone = true;
          onError(readError instanceof Error ? readError.message : '读取失败');
        }
      }
    } catch (error) {
      console.error('❌ 流式请求异常:', error);
      if (!isDone) {
        isDone = true;
        onError(error instanceof Error ? error.message : '未知错误');
      }
    }
  },
};

// 健康检查
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