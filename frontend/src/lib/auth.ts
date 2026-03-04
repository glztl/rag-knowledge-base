import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:11000';

// Token 管理（兼容服务端渲染）
export const tokenStorage = {
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  },

  setToken: (token: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('access_token', token);
  },

  removeToken: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('access_token');
  },

  isLoggedIn: (): boolean => {
    return !!tokenStorage.getToken();
  },
};

// 认证 API
export const authApi = {
  register: async (username: string, email: string, password: string) => {
    const response = await axios.post(`${API_BASE_URL}/api/v1/auth/register`, {
      username,
      email,
      password,
    });
    return response.data;
  },

  login: async (username: string, password: string) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    
    const response = await axios.post(`${API_BASE_URL}/api/v1/auth/login`, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },

  getCurrentUser: async (token: string) => {
    const response = await axios.get(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },
};

// 健康检查 API
export const healthApi = {
  check: async () => {
    const response = await axios.get(`${API_BASE_URL}/health`);
    return response.data;
  },

  testDb: async () => {
    const response = await axios.get(`${API_BASE_URL}/api/v1/test-db`);
    return response.data;
  },
};

// 创建带认证的 axios 实例（每个组件单独调用）
export function getAuthApi() {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 60000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // 请求拦截器 - 添加 Token
  instance.interceptors.request.use(
    (config) => {
      const token = tokenStorage.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // 响应拦截器 - 处理 401
  instance.interceptors.response.use(
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

  return instance;
}