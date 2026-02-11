import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import type { ApiResponse } from '@shared/index';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - logout user
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error.response?.data || error.message);
  }
);

// API methods
export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/register', data),

  login: (data: { email: string; password: string }) => api.post('/auth/login', data),

  me: () => api.get('/auth/me'),
};

export const projectsApi = {
  getAll: (params?: { page?: number; pageSize?: number; status?: string }) =>
    api.get('/projects', { params }),

  getById: (id: string) => api.get(`/projects/${id}`),

  create: (data: any) => api.post('/projects', data),

  update: (id: string, data: any) => api.patch(`/projects/${id}`, data),

  delete: (id: string) => api.delete(`/projects/${id}`),
};

export const lyricsApi = {
  getByProject: (projectId: string) => api.get(`/lyrics/project/${projectId}`),

  save: (projectId: string, lines: any[]) => api.post(`/lyrics/project/${projectId}`, { lines }),

  autoSync: (data: { projectId: string; audioUrl: string; lyrics: string; language?: string }) =>
    api.post('/lyrics/auto-sync', data),

  search: (artist: string, title: string) =>
    api.get('/lyrics/search', { params: { artist, title } }),
};

export const templatesApi = {
  getPublic: (params?: { category?: string; page?: number; pageSize?: number }) =>
    api.get('/templates/public', { params }),

  getById: (id: string) => api.get(`/templates/${id}`),

  getUserTemplates: () => api.get('/templates/user/me'),

  create: (data: any) => api.post('/templates', data),

  update: (id: string, data: any) => api.patch(`/templates/${id}`, data),

  delete: (id: string) => api.delete(`/templates/${id}`),
};

export const exportApi = {
  getByProject: (projectId: string) => api.get(`/export/project/${projectId}`),

  getById: (id: string) => api.get(`/export/${id}`),

  create: (data: { projectId: string; resolution: string; format: string }) =>
    api.post('/export', data),

  getStatus: (id: string) => api.get(`/export/${id}/status`),

  cancel: (id: string) => api.delete(`/export/${id}`),
};

export const youtubeApi = {
  getAuthUrl: () => api.get('/youtube/auth-url'),

  getStatus: () => api.get('/youtube/status'),

  upload: (data: { exportId: string; metadata: any }) => api.post('/youtube/upload', data),

  disconnect: () => api.delete('/youtube/disconnect'),
};

export const mediaApi = {
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    // Don't set Content-Type manually - let the browser set it with the boundary
    return api.post('/media/image/upload', formData);
  },
};

export default api;
