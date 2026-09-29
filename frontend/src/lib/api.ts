import axios, { AxiosError } from 'axios';
import type { FileValue } from './types';

export const TOKEN_KEY = 'playtech.token';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem(TOKEN_KEY);
      if (!location.pathname.startsWith('/login')) location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
    }
    return Promise.reject(err);
  },
);

/** Mensaje de error legible desde la respuesta de NestJS */
export function errorMessage(e: unknown): string {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const m = err?.response?.data?.message;
  if (Array.isArray(m)) return m[0];
  if (m) return m;
  if (err?.message === 'Network Error') return 'No hay conexión con el servidor';
  return 'Ocurrió un error inesperado';
}

export async function uploadFiles(files: File[]): Promise<FileValue[]> {
  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  const { data } = await api.post<FileValue[]>('/files', fd);
  return data;
}

/** URL absoluta para archivos servidos por el API */
export const fileUrl = (url?: string | null) =>
  !url ? '' : /^https?:|^data:/.test(url) ? url : `${import.meta.env.VITE_API_ORIGIN || ''}${url}`;
