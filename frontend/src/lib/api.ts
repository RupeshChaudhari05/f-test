import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// Always call the backend API directly.
// NEXT_PUBLIC_API_URL is baked at Docker build time → https://posh-api.fontgenerator.club
// In local dev it falls back to localhost:3000 via the Next.js rewrite in next.config.js.
const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: AxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('posh_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res: AxiosResponse) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('posh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (email: string, password: string) =>
  api.post('/api/v1/auth/login', { email, password });

export const register = (data: { name: string; email: string; password: string }) =>
  api.post('/api/v1/auth/register', data);

// User
export const getProfile = () => api.get('/api/v1/users/me');

// Sites
export const getSites = () => api.get('/api/v1/sites');
export const createSite = (data: { name: string; domain: string }) =>
  api.post('/api/v1/sites', data);
export const getSite = (id: string) => api.get(`/api/v1/sites/${id}`);
export const updateSite = (id: string, data: any) => api.put(`/api/v1/sites/${id}`, data);
export const deleteSite = (id: string) => api.delete(`/api/v1/sites/${id}`);
export const getSiteStats = (siteId: string) => api.get(`/api/v1/sites/${siteId}/stats`);
export const regenerateApiKey = (siteId: string) => api.post(`/api/v1/sites/${siteId}/regenerate-key`);

// Subscribers - Backend routes: /api/v1/sites/:siteId/subscribers
export const getSubscribers = (siteId: string, params?: any) =>
  api.get(`/api/v1/sites/${siteId}/subscribers`, { params });
export const getSubscriber = (siteId: string, id: string) =>
  api.get(`/api/v1/sites/${siteId}/subscribers/${id}`);
export const addSubscriberTags = (siteId: string, id: string, tags: string[]) =>
  api.put(`/api/v1/sites/${siteId}/subscribers/${id}/tags`, { tags });
export const removeSubscriberTags = (siteId: string, id: string, tags: string[]) =>
  api.delete(`/api/v1/sites/${siteId}/subscribers/${id}/tags`, { data: { tags } });
export const unsubscribeSubscriber = (siteId: string, id: string) =>
  api.post(`/api/v1/sites/${siteId}/subscribers/${id}/unsubscribe`);

// Notifications - Backend routes: /api/v1/sites/:siteId/notifications
export const getNotifications = (siteId: string, params?: any) =>
  api.get(`/api/v1/sites/${siteId}/notifications`, { params });
export const createNotification = (siteId: string, data: any) =>
  api.post(`/api/v1/sites/${siteId}/notifications`, data);
export const sendNotification = (siteId: string, data: any) =>
  api.post(`/api/v1/sites/${siteId}/notifications/send`, data);
export const getNotification = (siteId: string, id: string) =>
  api.get(`/api/v1/sites/${siteId}/notifications/${id}`);
export const cancelNotification = (siteId: string, id: string) =>
  api.post(`/api/v1/sites/${siteId}/notifications/${id}/cancel`);
export const getNotificationStats = (siteId: string, id: string) =>
  api.get(`/api/v1/sites/${siteId}/notifications/${id}/stats`);

// Segments - Backend routes: /api/v1/sites/:siteId/segments
export const getSegments = (siteId: string) =>
  api.get(`/api/v1/sites/${siteId}/segments`);
export const createSegment = (siteId: string, data: any) =>
  api.post(`/api/v1/sites/${siteId}/segments`, data);

// Automations - Backend routes: /api/v1/sites/:siteId/automations
export const getAutomations = (siteId: string) =>
  api.get(`/api/v1/sites/${siteId}/automations`);
export const createAutomation = (siteId: string, data: any) =>
  api.post(`/api/v1/sites/${siteId}/automations`, data);
export const toggleAutomation = (siteId: string, id: string) =>
  api.post(`/api/v1/sites/${siteId}/automations/${id}/toggle`);

// AB Tests - Backend routes: /api/v1/sites/:siteId/ab-tests
export const getAbTests = (siteId: string) =>
  api.get(`/api/v1/sites/${siteId}/ab-tests`);
export const createAbTest = (siteId: string, data: any) =>
  api.post(`/api/v1/sites/${siteId}/ab-tests`, data);
export const startAbTest = (siteId: string, id: string) =>
  api.post(`/api/v1/sites/${siteId}/ab-tests/${id}/start`);
export const getAbTestResults = (siteId: string, id: string) =>
  api.get(`/api/v1/sites/${siteId}/ab-tests/${id}/results`);

// Segment extras
export const deleteSegment = (siteId: string, id: string) =>
  api.delete(`/api/v1/sites/${siteId}/segments/${id}`);

// License
export const getLicenseLimits = () => api.get('/api/v1/license/limits');
export const getPlans = () => api.get('/api/v1/license/plans');

// Admin (Super Admin only)
export const getAdminDashboard = () => api.get('/api/v1/admin/dashboard');
export const getAdminUsers = (params?: any) => api.get('/api/v1/admin/users', { params });
export const getAdminUserDetail = (userId: string) => api.get(`/api/v1/admin/users/${userId}`);
export const toggleUserActive = (userId: string) => api.put(`/api/v1/admin/users/${userId}/toggle`);
export const updateUserPlan = (userId: string, plan: string, planExpiresAt?: string | null) =>
  api.put(`/api/v1/admin/users/${userId}/plan`, { plan, planExpiresAt });
export const setPlanExpiry = (userId: string, planExpiresAt: string | null) =>
  api.put(`/api/v1/admin/users/${userId}/plan-expiry`, { planExpiresAt });
export const updateUserRole = (userId: string, role: string) => api.put(`/api/v1/admin/users/${userId}/role`, { role });
export const getAdminSites = () => api.get('/api/v1/admin/sites');
// Client management (super admin)
export const getAdminClients = (params?: { page?: number; limit?: number; search?: string }) =>
  api.get('/api/v1/admin/clients', { params });
export const getAdminClientDetail = (userId: string) => api.get(`/api/v1/admin/clients/${userId}`);
export const suspendClient = (userId: string) => api.post(`/api/v1/admin/clients/${userId}/suspend`);
export const reactivateClient = (userId: string) => api.post(`/api/v1/admin/clients/${userId}/reactivate`);
export const getAdminSiteNotifications = (siteId: string, params?: { page?: number; limit?: number }) =>
  api.get(`/api/v1/admin/sites/${siteId}/notifications`, { params });
export const getAdminSiteSubscribers = (siteId: string, params?: { page?: number; limit?: number }) =>
  api.get(`/api/v1/admin/sites/${siteId}/subscribers`, { params });

// Analytics - Backend routes: /api/v1/sites/:siteId/analytics
export const getDashboard = (siteId: string, params?: any) =>
  api.get(`/api/v1/sites/${siteId}/analytics/dashboard`, { params });
export const getClickHeatmap = (siteId: string, notificationId: string) =>
  api.get(`/api/v1/sites/${siteId}/analytics/heatmap/${notificationId}`);
export const getGeoBreakdown = (siteId: string, limit?: number) =>
  api.get(`/api/v1/sites/${siteId}/analytics/geo`, { params: { limit } });
export const getDeviceBreakdown = (siteId: string) =>
  api.get(`/api/v1/sites/${siteId}/analytics/devices`);
export const getBrowserBreakdown = (siteId: string) =>
  api.get(`/api/v1/sites/${siteId}/analytics/browsers`);
export const getOsBreakdown = (siteId: string) =>
  api.get(`/api/v1/sites/${siteId}/analytics/os`);
export const getSubscriberGrowth = (siteId: string, days?: number) =>
  api.get(`/api/v1/sites/${siteId}/analytics/growth`, { params: { days } });

// Migration - Backend routes: /api/v1/sites/:siteId/migration
export const importFromOneSignal = (siteId: string, data: any) =>
  api.post(`/api/v1/sites/${siteId}/migration/onesignal`, data);
export const importFromFirebase = (siteId: string, data: any) =>
  api.post(`/api/v1/sites/${siteId}/migration/firebase`, data);
export const importFromCsv = (siteId: string, data: any) =>
  api.post(`/api/v1/sites/${siteId}/migration/csv`, data);

// Backup - Backend routes: /api/v1/sites/:siteId/backup
export const createBackup = (siteId: string, data: any) =>
  api.post(`/api/v1/sites/${siteId}/backup`, data);
export const restoreBackup = (siteId: string, backupData: any) =>
  api.post(`/api/v1/sites/${siteId}/backup/restore`, { backupData });

export default api;
